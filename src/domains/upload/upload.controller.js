/**
 * Upload Controller
 * Returns a URL that the frontend can attach to Jobs (photo_urls).
 */

const uploadService = require('./upload.service');

async function upload(req, res, next) {
  try {
    const file = (req.files && req.files[0]) || req.file;
    if (!file) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'No file uploaded. Attach a file in multipart/form-data.',
      });
    }

    const url = await uploadService.resolveUploadUrl(req, file);
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload };
