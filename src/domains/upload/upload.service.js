/**
 * Upload Service
 * Local-disk implementation for /api/upload.
 *
 * Production note:
 *   Replace this with an S3/Cloudinary adapter and keep response shape { url }.
 */

function buildPublicUrl(req, filename) {
  const configuredBase = process.env.BACKEND_URL;
  const inferredBase = `${req.protocol}://${req.get('host')}`;
  const base = String(configuredBase || inferredBase).replace(/\/$/, '');
  return `${base}/uploads/${encodeURIComponent(filename)}`;
}

module.exports = { buildPublicUrl };
