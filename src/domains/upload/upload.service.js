/**
 * Upload Service
 * Local-disk implementation for /api/upload with optional Cloudinary mirroring.
 */
const crypto = require('crypto');
const fs = require('fs/promises');
const env = require('../../config/env');
const logger = require('../../utils/logger');

function buildPublicUrl(req, filename) {
  const configuredBase = env.BACKEND_URL;
  const inferredBase = `${req.protocol}://${req.get('host')}`;
  const base = String(configuredBase || inferredBase).replace(/\/$/, '');
  return `${base}/uploads/${encodeURIComponent(filename)}`;
}

function isCloudinaryConfigured() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
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

async function resolveUploadUrl(req, file) {
  const localUrl = buildPublicUrl(req, file.filename);

  if (!isCloudinaryConfigured()) {
    return localUrl;
  }

  try {
    const cloudinaryUrl = await uploadToCloudinary(file);
    return env.UPLOAD_RETURN_CLOUDINARY_URL && cloudinaryUrl ? cloudinaryUrl : localUrl;
  } catch (err) {
    logger.warn(`Cloudinary upload mirror failed, using local upload URL: ${err.message}`);
    return localUrl;
  }
}

module.exports = {
  buildPublicUrl,
  isCloudinaryConfigured,
  uploadToCloudinary,
  resolveUploadUrl,
};
