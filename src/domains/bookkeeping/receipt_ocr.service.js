const path = require('path');
const uploadService = require('../upload/upload.service');

function titleCase(value = '') {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

function extractFromFilename(originalname = '') {
  const stem = path.basename(originalname, path.extname(originalname));
  const amountMatch = stem.match(/(\d+(?:[._]\d{1,2})?)/);
  const amount = amountMatch
    ? parseFloat(amountMatch[1].replace('_', '.'))
    : 0;
  const vendorStem = stem
    .replace(amountMatch ? amountMatch[0] : '', ' ')
    .replace(/\b(receipt|invoice|img|image|scan)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    vendor: titleCase(vendorStem || 'Unknown Vendor'),
    amount: Number.isFinite(amount) ? amount : 0,
  };
}

async function processReceipt(req, file) {
  const url = await uploadService.resolveUploadUrl(req, file);
  const extracted_data = extractFromFilename(file.originalname || file.filename);
  return { url, extracted_data };
}

module.exports = {
  processReceipt,
  extractFromFilename,
};
