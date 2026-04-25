const receiptOcrService = require('./receipt_ocr.service');

async function processReceipt(req, res, next) {
  try {
    const file = (req.files && req.files[0]) || req.file;
    if (!file) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'No receipt uploaded. Attach a file in multipart/form-data.',
      });
    }

    const result = await receiptOcrService.processReceipt(req, file);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  processReceipt,
};
