/**
 * Invoice Service
 * Invoice lifecycle: Draft -> Sent/Pending -> Paid/PartiallyPaid/Overdue/Refunded/Voided
 * Supports direct customer invoices, optional job linking, line items, edit audit log, and refunds.
 */
const prisma = require('../../lib/prisma');
const logger = require('../../utils/logger');
const { logActivitySafe } = require('../ai_logs/activity_log.service');
const { recordLedgerTransaction } = require('../bookkeeping/ledger.service');
const { calculateFinancials } = require('../../utils/financial_calculator');
const { NotFoundError, ValidationError } = require('../../utils/errors');

const PAYMENT_DUE_TERMS = ['Upon receipt', 'Net 15', 'Net 30', 'Net 45'];

function buildCustomerName(customer) {
  if (!customer) return 'Unknown Customer';
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return fullName || customer.company_name || 'Unknown Customer';
}

function getInvoiceCustomer(invoice) {
  return invoice.customer || invoice.job?.customer || null;
}

function invoiceSubtotal(invoice) {
  if (invoice.total_amount !== undefined && invoice.total_amount !== null) {
    return Number(invoice.total_amount) || 0;
  }
  return (invoice.line_items || []).reduce((sum, line) => {
    const amount = Number(line.total ?? ((line.quantity || 1) * (line.unit_price || 0))) || 0;
    return sum + (line.is_credit ? -amount : amount);
  }, 0);
}

function paidAmount(invoice) {
  return (invoice.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

function validateDueTerms(value) {
  if (value !== undefined && value !== null && !PAYMENT_DUE_TERMS.includes(value)) {
    throw new ValidationError(`payment_due_terms must be one of: ${PAYMENT_DUE_TERMS.join(', ')}.`);
  }
}

async function nextInvoiceNumber(businessId) {
  const count = await prisma.invoice.count({ where: { business_id: businessId } }).catch(() => 0);
  return `INV-${String(count + 1).padStart(4, '0')}`;
}

async function resolveInvoiceOwnership(data) {
  if (!data.business_id) throw new ValidationError('business_id is required.');
  let customerId = data.customer_id || null;

  if (data.job_id) {
    const job = await prisma.job.findFirst({
      where: { id: data.job_id, business_id: data.business_id },
      select: { id: true, customer_id: true },
    });
    if (!job) throw new ValidationError('Job does not belong to this business.');
    customerId = customerId || job.customer_id;
    if (data.customer_id && data.customer_id !== job.customer_id) {
      throw new ValidationError('customer_id does not match the selected job.');
    }
  }

  if (!customerId) throw new ValidationError('customer_id is required when job_id is not provided.');

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, business_id: data.business_id },
    select: { id: true },
  });
  if (!customer) throw new ValidationError('Customer does not belong to this business.');

  return customerId;
}

function mapInvoiceListRow(invoice) {
  const customer = getInvoiceCustomer(invoice);
  return {
    ...invoice,
    invoice_number: invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`,
    customer_name: buildCustomerName(customer),
    service_name: invoice.service_name || invoice.job?.title || invoice.job?.service_type || null,
    total_amount: invoice.total_amount ?? invoiceSubtotal(invoice),
    due_date: invoice.due_date,
    status: invoice.status,
  };
}

function buildInvoiceData(data, existing = null) {
  validateDueTerms(data.payment_due_terms);
  const shouldRecalculate = data.line_items !== undefined
    || data.manual_subtotal !== undefined
    || data.discount_percent !== undefined
    || data.tax_percent !== undefined
    || data.deposit_percent !== undefined
    || data.total_amount !== undefined;
  const financials = calculateFinancials(data);
  const serviceCategory = data.custom_category_name || data.service_category;

  const invoiceData = {
    job_id: data.job_id ?? undefined,
    customer_id: data.customer_id ?? undefined,
    invoice_number: data.invoice_number ?? undefined,
    status: data.status ?? undefined,
    service_name: data.service_name ?? undefined,
    service_category: serviceCategory ?? undefined,
    contract_type: data.contract_type ?? undefined,
    warranty_due: data.warranty_due ? new Date(data.warranty_due) : undefined,
    description: data.description ?? undefined,
    photos: data.photos ?? undefined,
    notes: data.notes ?? undefined,
    internal_notes: data.internal_notes ?? undefined,
    due_date: data.due_date ? new Date(data.due_date) : undefined,
    payment_due_terms: data.payment_due_terms ?? undefined,
    manual_subtotal: shouldRecalculate ? financials.manual_subtotal : undefined,
    subtotal: shouldRecalculate ? financials.subtotal : undefined,
    discount_percent: shouldRecalculate ? financials.discount_percent : undefined,
    discount_amount: shouldRecalculate ? financials.discount_amount : undefined,
    tax_percent: shouldRecalculate ? financials.tax_percent : undefined,
    tax_amount: shouldRecalculate ? financials.tax_amount : undefined,
    deposit_percent: shouldRecalculate ? financials.deposit_percent : undefined,
    deposit_amount: shouldRecalculate ? financials.deposit_amount : undefined,
    total_amount: shouldRecalculate ? financials.total_amount : undefined,
    due_amount: shouldRecalculate ? financials.due_amount : undefined,
  };

  if (data.status === 'Sent' && existing) invoiceData.sent_at = existing.sent_at || new Date();
  Object.keys(invoiceData).forEach((key) => invoiceData[key] === undefined && delete invoiceData[key]);
  return { invoiceData, financials };
}

async function getInvoices({ business_id, job_id, status, page = 1, limit = 20 }) {
  const where = {};
  if (job_id) where.job_id = job_id;
  if (status) where.status = status;
  if (business_id) where.business_id = business_id;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;
  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: parsedLimit,
      include: {
        line_items: true,
        payments: true,
        customer: true,
        job: { include: { customer: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.count({ where }),
  ]);
  return { data: data.map(mapInvoiceListRow), total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) };
}

async function getById(id) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      line_items: true,
      payments: true,
      customer: true,
      edit_logs: { include: { user: { select: { id: true, email: true, first_name: true, last_name: true } } }, orderBy: { edited_at: 'desc' } },
      job: { include: { customer: true, business: true } },
    },
  });

  if (invoice?.job?.business) {
    const { internal_api_token, ...safeBusiness } = invoice.job.business;
    invoice.job.business = safeBusiness;
  }

  return invoice ? mapInvoiceListRow(invoice) : null;
}

async function getByJobId(jobId) {
  return prisma.invoice.findMany({
    where: { job_id: jobId },
    include: { line_items: true, payments: true, customer: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function create(data) {
  const customerId = await resolveInvoiceOwnership(data);
  const { invoiceData, financials } = buildInvoiceData({ ...data, customer_id: customerId });

  const invoice = await prisma.invoice.create({
    data: {
      business_id: data.business_id,
      customer_id: customerId,
      invoice_number: data.invoice_number || await nextInvoiceNumber(data.business_id),
      status: data.status || 'Draft',
      ...invoiceData,
    },
    include: { line_items: true },
  });

  if (financials.line_items.length > 0) {
    await prisma.invoiceLine.createMany({
      data: financials.line_items.map((li) => ({
        invoice_id: invoice.id,
        description: li.description || li.name || 'Line item',
        quantity: li.quantity ?? 1,
        unit_price: li.unit_price,
        total: li.total,
        is_credit: li.is_credit ?? false,
      })),
    });
  }

  const createdInvoice = await getById(invoice.id);
  await logActivitySafe({
    business_id: data.business_id,
    customer_id: customerId,
    job_id: createdInvoice.job_id,
    event_type: 'invoice.created',
    title: `Invoice created for ${buildCustomerName(getInvoiceCustomer(createdInvoice))}`,
    details: { invoice_id: createdInvoice.id, status: createdInvoice.status },
  });

  return createdInvoice;
}

async function update(id, data, userId) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new NotFoundError('Invoice');
  if (['Refunded', 'Voided'].includes(invoice.status)) {
    throw new ValidationError(`Invoice is ${invoice.status} and cannot be edited.`);
  }

  const isPaid = invoice.status === 'Paid';
  const changes = {};
  const { invoiceData, financials } = buildInvoiceData(data, invoice);
  if (isPaid) {
    Object.keys(invoiceData).forEach((key) => {
      if (key !== 'internal_notes') delete invoiceData[key];
    });
  }

  Object.keys(invoiceData).forEach((key) => {
    changes[key] = { from: invoice[key], to: invoiceData[key] };
  });

  if (!isPaid && data.line_items !== undefined) {
    await prisma.invoiceLine.deleteMany({ where: { invoice_id: id } });
    if (financials.line_items.length > 0) {
      await prisma.invoiceLine.createMany({
        data: financials.line_items.map((li) => ({
          invoice_id: id,
          description: li.description || li.name || 'Line item',
          quantity: li.quantity ?? 1,
          unit_price: li.unit_price,
          total: li.total,
          is_credit: li.is_credit ?? false,
        })),
      });
    }
    changes.line_items = 'updated';
  }

  await prisma.invoice.update({ where: { id }, data: invoiceData });
  if (Object.keys(changes).length > 0) {
    await prisma.invoiceEditLog.create({
      data: { invoice_id: id, edited_by: userId || null, changes },
    });
    logger.info(`Invoice ${id} edited`, { userId, changes });
  }

  const updatedInvoice = await getById(id);
  await logActivitySafe({
    business_id: updatedInvoice.business_id,
    customer_id: updatedInvoice.customer_id || updatedInvoice.job?.customer?.id,
    job_id: updatedInvoice.job_id,
    event_type: 'invoice.updated',
    title: `Invoice updated for ${buildCustomerName(getInvoiceCustomer(updatedInvoice))}`,
    details: { invoice_id: updatedInvoice.id, status: updatedInvoice.status, changes },
  });

  return updatedInvoice;
}

async function send(id) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new NotFoundError('Invoice');
  await prisma.invoice.update({ where: { id }, data: { status: 'Sent', sent_at: new Date() } });
  const sentInvoice = await getById(id);

  await logActivitySafe({
    business_id: sentInvoice.business_id,
    customer_id: sentInvoice.customer_id || sentInvoice.job?.customer?.id,
    job_id: sentInvoice.job_id,
    event_type: 'invoice.sent',
    title: `Invoice sent to ${buildCustomerName(getInvoiceCustomer(sentInvoice))}`,
    details: { invoice_id: sentInvoice.id, status: sentInvoice.status },
  });

  return sentInvoice;
}

async function voidInvoice(id, userId) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new NotFoundError('Invoice');
  if (invoice.status === 'Paid') throw new ValidationError('Cannot void a paid invoice. Issue a refund instead.');

  const updated = await prisma.invoice.update({ where: { id }, data: { status: 'Voided', voided_at: new Date() } });
  await prisma.invoiceEditLog.create({ data: { invoice_id: id, edited_by: userId || null, changes: { action: 'voided' } } });
  const voidedInvoice = await getById(id);

  await logActivitySafe({
    business_id: voidedInvoice.business_id,
    customer_id: voidedInvoice.customer_id || voidedInvoice.job?.customer?.id,
    job_id: voidedInvoice.job_id,
    event_type: 'invoice.voided',
    title: `Invoice voided for ${buildCustomerName(getInvoiceCustomer(voidedInvoice))}`,
    details: { invoice_id: voidedInvoice.id, status: voidedInvoice.status },
  });

  return updated;
}

async function refundInvoice(id, { amount, reason, userId }) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
  if (!invoice) throw new NotFoundError('Invoice');
  if (!['Paid', 'PartiallyPaid'].includes(invoice.status)) {
    throw new ValidationError('Invoice must be paid to issue a refund.');
  }

  const totalPaid = paidAmount(invoice);
  const refundAmt = amount || totalPaid;
  if (refundAmt > totalPaid) throw new ValidationError('Refund amount cannot exceed amount paid.');

  const nextStatus = refundAmt >= totalPaid ? 'Refunded' : 'PartiallyPaid';
  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: nextStatus, refunded_at: new Date(), refund_amount: refundAmt, refund_reason: reason || null },
  });

  await prisma.invoiceEditLog.create({
    data: { invoice_id: id, edited_by: userId || null, changes: { action: 'refunded', amount: refundAmt, reason } },
  });

  const refundedInvoice = await getById(id);
  await recordLedgerTransaction({
    business_id: refundedInvoice.business_id,
    source: 'invoice',
    is_income: false,
    amount: -Math.abs(refundAmt),
    category: 'Job Income',
    description: `Refund recorded for invoice ${id}${reason ? `: ${reason}` : ''}`,
    reference_id: id,
    transaction_date: refundedInvoice.refunded_at || new Date(),
  });

  await logActivitySafe({
    business_id: refundedInvoice.business_id,
    customer_id: refundedInvoice.customer_id || refundedInvoice.job?.customer?.id,
    job_id: refundedInvoice.job_id,
    event_type: 'invoice.refunded',
    title: `Invoice refunded for ${buildCustomerName(getInvoiceCustomer(refundedInvoice))}`,
    details: { invoice_id: refundedInvoice.id, amount: refundAmt, reason: reason || null, status: refundedInvoice.status },
  });

  return updated;
}

async function getInvoiceTotal(id) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { line_items: true, payments: true },
  });
  if (!invoice) throw new NotFoundError('Invoice');
  const subtotal = invoiceSubtotal(invoice);
  const totalPaid = paidAmount(invoice);
  return { subtotal, total_paid: totalPaid, balance_due: subtotal - totalPaid };
}

module.exports = { getInvoices, getById, getByJobId, create, update, send, voidInvoice, refundInvoice, getInvoiceTotal };
