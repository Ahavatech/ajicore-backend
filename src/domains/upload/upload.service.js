/**
 * Upload Service
 * Supports: Local disk, Google Cloud Storage (GCS), and optional Cloudinary mirroring.
 * 
 * Modes:
 * - 'local': Store on local disk (/uploads directory)
 * - 'gcs': Store in Google Cloud Storage bucket
 * 
 * Fallback: If GCS is unavailable, falls back to local disk.
 */
const crypto = require('crypto');
const fs = require('fs/promises');
const env = require('../../config/env');
const logger = require('../../utils/logger');

let Storage = null;
try {
  ({ Storage } = require('@google-cloud/storage'));
} catch (err) {
  Storage = null;
}

let gcsClient = null;
let gcsBucket = null;

/**
 * Initialize Google Cloud Storage client
 */
function initializeGCS() {
  if (gcsClient) return gcsClient;
  
  if (!env.GCS_PROJECT_ID || !env.GCS_BUCKET_NAME) {
    logger.warn('GCS not configured: missing GCS_PROJECT_ID or GCS_BUCKET_NAME');
    return null;
  }
  if (!Storage) {
    logger.warn('GCS not available: @google-cloud/storage is not installed');
    return null;
  }

  try {
    const options = {
      projectId: env.GCS_PROJECT_ID,
    };

    // If GCS_KEY_FILE is provided, use service account key file
    if (env.GCS_KEY_FILE) {
      options.keyFilename = env.GCS_KEY_FILE;
      logger.info(`Initializing GCS with service account key: ${env.GCS_KEY_FILE}`);
    } else {
      // Use default credentials (from GOOGLE_APPLICATION_CREDENTIALS env var or application default credentials)
      logger.info('Initializing GCS with default credentials');
    }

    gcsClient = new Storage(options);
    gcsBucket = gcsClient.bucket(env.GCS_BUCKET_NAME);
    logger.info(`GCS initialized successfully for bucket: ${env.GCS_BUCKET_NAME}`);
    return gcsClient;
  } catch (err) {
    logger.error(`Failed to initialize GCS: ${err.message}`);
    return null;
  }
}

function isGCSConfigured() {
  return env.STORAGE_MODE === 'gcs' && Boolean(env.GCS_PROJECT_ID && env.GCS_BUCKET_NAME);
}

function isCloudinaryConfigured() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/**
 * Upload file to Google Cloud Storage
 * Returns: public URL (gs:// or https://)
 */
async function uploadToGCS(file) {
  if (!isGCSConfigured()) return null;

  try {
    if (!gcsClient) {
      initializeGCS();
    }

    if (!gcsBucket) {
      logger.error('GCS bucket not initialized');
      return null;
    }

    const gcsFilename = `uploads/${Date.now()}-${file.originalname || 'file'}`;
    const gcsFile = gcsBucket.file(gcsFilename);

    // Read file from multer temp location
    const fileBuffer = await fs.readFile(file.path);

    // Upload to GCS
    await gcsFile.save(fileBuffer, {
      metadata: {
        contentType: file.mimetype || 'application/octet-stream',
      },
    });

    logger.info(`File uploaded to GCS: gs://${env.GCS_BUCKET_NAME}/${gcsFilename}`);

    // Make file public (if bucket is configured for public access)
    // Return public HTTPS URL
    const publicUrl = `https://storage.googleapis.com/${env.GCS_BUCKET_NAME}/${gcsFilename}`;
    return publicUrl;
  } catch (err) {
    logger.error(`GCS upload failed: ${err.message}`);
    return null;
  }
}

/**
 * Build local public URL (for /uploads endpoint)
 */
function buildLocalUrl(req, filename) {
  const configuredBase = env.BACKEND_URL;
  const inferredBase = `${req.protocol}://${req.get('host')}`;
  const base = String(configuredBase || inferredBase).replace(/\/$/, '');
  return `${base}/uploads/${encodeURIComponent(filename)}`;
}

function signCloudinaryParams(params) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHash('sha1')
    .update(`${payload}${env.CLOUDINARY_API_SECRET}`)
    .digest('hex');
}

async function uploadToCloudinary(file) {
  if (!isCloudinaryConfigured()) return null;
  if (typeof fetch !== 'function' || typeof FormData !== 'function' || typeof Blob !== 'function') {
    logger.warn('Cloudinary upload skipped because fetch/FormData/Blob is unavailable in this Node runtime.');
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder: env.CLOUDINARY_FOLDER,
  };
  const signature = signCloudinaryParams(paramsToSign);
  const fileBuffer = await fs.readFile(file.path);

  const form = new FormData();
  form.append('file', new Blob([fileBuffer], { type: file.mimetype || 'application/octet-stream' }), file.filename);
  form.append('api_key', env.CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', env.CLOUDINARY_FOLDER);
  form.append('signature', signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.secure_url) {
    const message = payload.error?.message || `Cloudinary upload failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload.secure_url;
}

/**
 * Resolve upload URL based on storage mode
 * Priority: GCS (if configured) → Local (fallback) → Cloudinary mirror (optional)
 */
async function resolveUploadUrl(req, file) {
  let primaryUrl = null;

  // Try primary storage mode
  if (isGCSConfigured()) {
    try {
      primaryUrl = await uploadToGCS(file);
      if (primaryUrl) {
        logger.info(`Resolved URL via GCS: ${primaryUrl}`);
        return primaryUrl;
      }
    } catch (err) {
      logger.warn(`GCS upload failed, falling back to local: ${err.message}`);
    }
  }

  // Fallback to local storage
  primaryUrl = buildLocalUrl(req, file.filename);
  logger.info(`Resolved URL via local disk: ${primaryUrl}`);

  // Optional Cloudinary mirror (regardless of primary storage)
  if (isCloudinaryConfigured()) {
    try {
      const cloudinaryUrl = await uploadToCloudinary(file);
      if (env.UPLOAD_RETURN_CLOUDINARY_URL && cloudinaryUrl) {
        logger.info(`Resolved URL via Cloudinary: ${cloudinaryUrl}`);
        return cloudinaryUrl;
      }
    } catch (err) {
      logger.warn(`Cloudinary mirror failed, using primary URL: ${err.message}`);
    }
  }

  return primaryUrl;
}

module.exports = {
  initializeGCS,
  isGCSConfigured,
  isCloudinaryConfigured,
  uploadToGCS,
  uploadToCloudinary,
  buildLocalUrl,
  resolveUploadUrl,
};
