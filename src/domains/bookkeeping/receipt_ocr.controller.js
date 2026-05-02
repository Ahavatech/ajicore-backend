const receiptOcrService = require('./receipt_ocr.service');

async function processReceipt(req, res, next) {
  try {
    if (!req.body?.business_id || !req.body?.file_url) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'business_id and file_url are required.',
      });
    }

    const result = await receiptOcrService.processReceipt(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  processReceipt,
};
