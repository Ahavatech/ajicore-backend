function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function normalizeLineItems(lineItems) {
  if (!Array.isArray(lineItems)) return [];

  return lineItems.map((item) => {
    const quantity = toNumber(item.quantity ?? item.qty, 1);
    const unitPrice = toNumber(item.unit_price ?? item.price ?? item.rate, 0);
    const total = item.total !== undefined
      ? toNumber(item.total)
      : quantity * unitPrice;

    return {
      ...item,
      quantity,
      unit_price: unitPrice,
      total: roundMoney(total),
    };
  });
}

function calculateFinancials(payload = {}) {
  const lineItems = normalizeLineItems(payload.line_items);
  const lineSubtotal = lineItems.reduce((sum, item) => sum + toNumber(item.total), 0);
  const manualSubtotal = toNumber(payload.manual_subtotal, 0);
  const subtotal = roundMoney(lineItems.length > 0 ? lineSubtotal : manualSubtotal);
  const discountPercent = toNumber(payload.discount_percent, 0);
  const taxPercent = toNumber(payload.tax_percent, 0);
  const depositPercent = toNumber(payload.deposit_percent, 0);

  const discountAmount = roundMoney(subtotal * (discountPercent / 100));
  const taxableAmount = roundMoney(subtotal - discountAmount);
  const taxAmount = roundMoney(taxableAmount * (taxPercent / 100));
  const totalAmount = roundMoney(taxableAmount + taxAmount);
  const depositAmount = roundMoney(totalAmount * (depositPercent / 100));
  const dueAmount = roundMoney(totalAmount - depositAmount);

  return {
    line_items: lineItems,
    manual_subtotal: manualSubtotal,
    subtotal,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    tax_percent: taxPercent,
    tax_amount: taxAmount,
    deposit_percent: depositPercent,
    deposit_amount: depositAmount,
    total_amount: totalAmount,
    due_amount: dueAmount,
  };
}

module.exports = {
  calculateFinancials,
  normalizeLineItems,
  roundMoney,
  toNumber,
};
