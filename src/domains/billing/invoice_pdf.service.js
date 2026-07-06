const PDFDocument = require('pdfkit');

const PAGE_MARGIN = 48;
const BRAND_BLUE = '#2F80C4';
const TEXT_DARK = '#1F2937';
const TEXT_MUTED = '#6B7280';
const BORDER = '#D9E2EC';
const SURFACE = '#F5F8FC';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(amount));
}

function formatDate(value) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function collectLineItems(invoice) {
  return Array.isArray(invoice.line_items) ? invoice.line_items : [];
}

function getBusiness(invoice) {
  return invoice.business || invoice.job?.business || {};
}

function getCustomer(invoice) {
  return invoice.customer || invoice.job?.customer || {};
}

function getBusinessName(business) {
  return business.name || 'Ajicore';
}

function getCustomerName(customer) {
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return fullName || customer.company_name || 'Unknown Customer';
}

function getCustomerAddress(customer) {
  return customer.location_main || customer.address || [customer.street, customer.city, customer.postal_code, customer.country]
    .filter(Boolean)
    .join(', ');
}

function getBusinessAddress(business) {
  return [business.street, business.city, business.postal_code, business.country]
    .filter(Boolean)
    .join(', ');
}

function getBusinessWebsite(business) {
  return business.website
    || business.company_website
    || business.site_url
    || business.communication_settings?.website
    || null;
}

function normalizeImageBuffer(contentType, buffer) {
  if (!buffer || !contentType) return null;
  if (contentType.includes('png') || contentType.includes('jpeg') || contentType.includes('jpg')) {
    return buffer;
  }
  return null;
}

async function loadLogoBuffer(logoUrl) {
  if (!logoUrl) return null;

  if (logoUrl.startsWith('data:image/')) {
    const [, base64] = logoUrl.split(',', 2);
    return base64 ? Buffer.from(base64, 'base64') : null;
  }

  if (!/^https?:\/\//i.test(logoUrl)) {
    return null;
  }

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return normalizeImageBuffer(response.headers.get('content-type') || '', buffer);
  } catch (_error) {
    return null;
  }
}

function writeLabelValue(doc, x, y, label, value, width) {
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(TEXT_MUTED)
    .text(label, x, y, { width });
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(TEXT_DARK)
    .text(value, x, y + 12, { width });
}

function drawRoundedCard(doc, x, y, width, height, fillColor = 'white', strokeColor = BORDER, radius = 10) {
  doc.save();
  doc.roundedRect(x, y, width, height, radius).fillAndStroke(fillColor, strokeColor);
  doc.restore();
}

function buildSummary(invoice) {
  const subtotal = invoice.subtotal ?? collectLineItems(invoice).reduce((sum, item) => {
    const amount = toNumber(item.total ?? (toNumber(item.quantity, 1) * toNumber(item.unit_price)));
    return sum + (item.is_credit ? -amount : amount);
  }, 0);
  const paid = Array.isArray(invoice.payments)
    ? invoice.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0)
    : 0;
  const discountAmount = invoice.discount_amount ?? 0;
  const taxAmount = invoice.tax_amount ?? 0;
  const depositAmount = invoice.deposit_amount ?? 0;
  const totalAmount = invoice.total_amount ?? subtotal;
  const dueAmount = invoice.due_amount ?? Math.max(totalAmount - paid, 0);

  return {
    subtotal,
    paid,
    discountAmount,
    taxAmount,
    depositAmount,
    totalAmount,
    dueAmount,
  };
}

function drawLineItemsTable(doc, invoice, startY, pageWidth) {
  const left = PAGE_MARGIN;
  const tableWidth = pageWidth - PAGE_MARGIN * 2;
  const columns = [
    { key: 'description', label: 'Description', width: tableWidth * 0.48, align: 'left' },
    { key: 'quantity', label: 'Qty', width: tableWidth * 0.12, align: 'right' },
    { key: 'unit_price', label: 'Unit Price', width: tableWidth * 0.18, align: 'right' },
    { key: 'total', label: 'Total', width: tableWidth * 0.22, align: 'right' },
  ];

  drawRoundedCard(doc, left, startY, tableWidth, 28, SURFACE, BORDER, 8);
  let cursorX = left + 12;
  columns.forEach((column) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(TEXT_MUTED)
      .text(column.label.toUpperCase(), cursorX, startY + 10, {
        width: column.width - 12,
        align: column.align,
      });
    cursorX += column.width;
  });

  let y = startY + 36;
  const lineItems = collectLineItems(invoice);
  if (lineItems.length === 0) {
    drawRoundedCard(doc, left, y, tableWidth, 36, 'white', BORDER, 8);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(TEXT_MUTED)
      .text('No line items added.', left + 12, y + 12, { width: tableWidth - 24 });
    return y + 48;
  }

  lineItems.forEach((item) => {
    drawRoundedCard(doc, left, y, tableWidth, 42, 'white', BORDER, 8);
    let rowX = left + 12;
    const row = {
      description: item.description || item.name || 'Line item',
      quantity: String(toNumber(item.quantity, 1)),
      unit_price: formatCurrency(item.unit_price),
      total: formatCurrency(item.total),
    };
    columns.forEach((column) => {
      doc
        .font(column.key === 'description' ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10)
        .fillColor(TEXT_DARK)
        .text(row[column.key], rowX, y + 14, {
          width: column.width - 12,
          align: column.align,
        });
      rowX += column.width;
    });
    y += 50;
  });

  return y;
}

function drawTotals(doc, invoice, startY, pageWidth) {
  const summary = buildSummary(invoice);
  const cardWidth = 230;
  const x = pageWidth - PAGE_MARGIN - cardWidth;
  const rows = [
    ['Subtotal', formatCurrency(summary.subtotal)],
    ['Discount', summary.discountAmount ? `-${formatCurrency(summary.discountAmount)}` : formatCurrency(0)],
    ['Tax', summary.taxAmount ? formatCurrency(summary.taxAmount) : formatCurrency(0)],
    ['Deposit', summary.depositAmount ? formatCurrency(summary.depositAmount) : formatCurrency(0)],
    ['Amount Paid', formatCurrency(summary.paid)],
    ['Balance Due', formatCurrency(summary.dueAmount)],
  ];

  const height = 28 + rows.length * 24;
  drawRoundedCard(doc, x, startY, cardWidth, height, SURFACE, BORDER, 10);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(TEXT_DARK)
    .text('Payment Summary', x + 14, startY + 10);

  let y = startY + 34;
  rows.forEach(([label, value], index) => {
    const isFinal = index === rows.length - 1;
    doc
      .font(isFinal ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isFinal ? 11 : 10)
      .fillColor(isFinal ? TEXT_DARK : TEXT_MUTED)
      .text(label, x + 14, y, { width: 110 });
    doc
      .font(isFinal ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isFinal ? 11 : 10)
      .fillColor(TEXT_DARK)
      .text(value, x + 120, y, { width: 96, align: 'right' });
    y += 24;
  });

  return startY + height;
}

async function generateInvoicePdf(invoice) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, compress: false });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const pageWidth = doc.page.width;
  const business = getBusiness(invoice);
  const customer = getCustomer(invoice);
  const businessName = getBusinessName(business);
  const businessWebsite = getBusinessWebsite(business);
  const businessAddress = getBusinessAddress(business);
  const customerAddress = getCustomerAddress(customer);
  const customerName = getCustomerName(customer);
  const summary = buildSummary(invoice);
  const logoBuffer = await loadLogoBuffer(business.logo_url || null);
  const invoiceNumber = invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`;
  const issuedDate = formatDate(invoice.createdAt || invoice.sent_at || new Date());
  const dueDate = formatDate(invoice.due_date);

  doc.rect(0, 0, pageWidth, 150).fill('#F7FAFE');

  doc
    .font('Helvetica-Bold')
    .fontSize(24)
    .fillColor(TEXT_DARK)
    .text(businessName, PAGE_MARGIN, 40, { width: 300 });

  const businessMeta = [businessWebsite, business.company_email, business.company_phone, businessAddress].filter(Boolean);
  if (businessMeta.length > 0) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(TEXT_MUTED)
      .text(businessMeta.join('  |  '), PAGE_MARGIN, 74, { width: 360 });
  }

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, pageWidth - PAGE_MARGIN - 70, 28, {
        fit: [70, 70],
        align: 'right',
        valign: 'center',
      });
    } catch (_error) {
      // Ignore unsupported or malformed images and continue rendering.
    }
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(BRAND_BLUE)
    .text(summary.paid > 0 && summary.dueAmount <= 0 ? 'Receipt' : 'Invoice', PAGE_MARGIN, 110);

  drawRoundedCard(doc, PAGE_MARGIN, 170, pageWidth - PAGE_MARGIN * 2, 98, BRAND_BLUE, BRAND_BLUE, 16);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#DCEAF7')
    .text('INVOICE TO', PAGE_MARGIN + 18, 188);
  doc
    .font('Helvetica-Bold')
    .fontSize(15)
    .fillColor('white')
    .text(customerName, PAGE_MARGIN + 18, 202, { width: 270 });
  if (customer.email || customer.phone_number || customerAddress) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#EAF4FF')
      .text([customer.email, customer.phone_number, customerAddress].filter(Boolean).join('\n'), PAGE_MARGIN + 18, 224, {
        width: 320,
      });
  }

  drawRoundedCard(doc, pageWidth - PAGE_MARGIN - 110, 192, 92, 60, 'white', 'white', 10);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(TEXT_MUTED)
    .text('AMOUNT DUE', pageWidth - PAGE_MARGIN - 98, 204, { width: 70, align: 'center' });
  doc
    .font('Helvetica-Bold')
    .fontSize(19)
    .fillColor(TEXT_DARK)
    .text(formatCurrency(summary.dueAmount), pageWidth - PAGE_MARGIN - 102, 217, { width: 80, align: 'center' });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(TEXT_MUTED)
    .text(dueDate, pageWidth - PAGE_MARGIN - 98, 240, { width: 70, align: 'center' });

  const infoY = 288;
  const cardWidth = (pageWidth - PAGE_MARGIN * 2 - 12) / 3;
  [ 
    ['Invoice Number', invoiceNumber],
    ['Issued', issuedDate],
    ['Due Date', dueDate],
  ].forEach(([label, value], index) => {
    const x = PAGE_MARGIN + (cardWidth + 6) * index;
    drawRoundedCard(doc, x, infoY, cardWidth, 48, SURFACE, BORDER, 8);
    writeLabelValue(doc, x + 12, infoY + 8, label.toUpperCase(), value, cardWidth - 24);
  });

  let cursorY = drawLineItemsTable(doc, invoice, infoY + 66, pageWidth) + 4;
  const totalsBottom = drawTotals(doc, invoice, cursorY, pageWidth);
  cursorY = Math.max(cursorY, totalsBottom) + 18;

  if (invoice.notes) {
    drawRoundedCard(doc, PAGE_MARGIN, cursorY, pageWidth - PAGE_MARGIN * 2, 54, 'white', BORDER, 8);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(TEXT_DARK)
      .text(invoice.notes, PAGE_MARGIN + 12, cursorY + 16, {
        width: pageWidth - PAGE_MARGIN * 2 - 24,
      });
    cursorY += 68;
  }

  const footerY = Math.max(cursorY + 10, doc.page.height - 78);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(TEXT_MUTED)
    .text(businessName, PAGE_MARGIN, footerY);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(TEXT_MUTED)
    .text([businessWebsite, business.company_email, business.company_phone].filter(Boolean).join('  |  '), PAGE_MARGIN, footerY + 12, {
      width: 320,
    });

  doc.end();
  await new Promise((resolve) => doc.on('end', resolve));
  return Buffer.concat(chunks);
}

module.exports = {
  formatCurrency,
  generateInvoicePdf,
};
