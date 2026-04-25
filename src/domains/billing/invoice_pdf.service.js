function pdfEscape(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(amount || 0));
}

function formatDate(value) {
  if (!value) return 'N/A';
  return new Date(value).toISOString().slice(0, 10);
}

function buildInvoiceLines(invoice) {
  const customer = invoice.job?.customer;
  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || 'Unknown Customer';
  const businessName = invoice.job?.business?.name || 'Ajicore';
  const invoiceLines = invoice.line_items || [];
  const subtotal = invoiceLines.reduce((sum, line) => sum + (line.is_credit ? -line.total : line.total), 0);
  const paid = (invoice.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
  const balance = subtotal - paid;

  const lines = [
    `${businessName}`,
    `Invoice ${invoice.id}`,
    `Status: ${invoice.status}`,
    `Customer: ${customerName}`,
    `Due Date: ${formatDate(invoice.due_date)}`,
    '',
    'Line Items:',
  ];

  if (invoiceLines.length === 0) {
    lines.push('No line items');
  } else {
    invoiceLines.forEach((line) => {
      lines.push(`- ${line.description} x${line.quantity} ${formatCurrency(line.total)}`);
    });
  }

  lines.push('');
  lines.push(`Subtotal: ${formatCurrency(subtotal)}`);
  lines.push(`Paid: ${formatCurrency(paid)}`);
  lines.push(`Balance Due: ${formatCurrency(balance)}`);

  if (invoice.notes) {
    lines.push('');
    lines.push(`Notes: ${invoice.notes}`);
  }

  return lines;
}

function buildPdfBuffer(lines) {
  const textOperations = [];
  let y = 770;
  const step = 16;

  lines.forEach((line) => {
    textOperations.push(`1 0 0 1 50 ${y} Tm (${pdfEscape(line)}) Tj`);
    y -= step;
  });

  const stream = `BT\n/F1 12 Tf\n${textOperations.join('\n')}\nET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += object;
  });

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

function generateInvoicePdf(invoice) {
  return buildPdfBuffer(buildInvoiceLines(invoice));
}

module.exports = {
  generateInvoicePdf,
};
