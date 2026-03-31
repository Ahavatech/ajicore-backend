/**
 * Invoice Service
 * Invoice lifecycle: Draft → Sent → Paid/PartiallyPaid/Overdue/Refunded/Voided
 * Supports line items, edit audit log, and refunds.
 *
 * Edit rules:
 *   Draft: Full edit
 *   Sent: Full edit (link updated in-place)
 *   Paid: Notes/photos only
 *   Refunded/Voided: Locked
 */
const prisma = require('../../lib/prisma');
const logger = require('../../utils/logger');
const { logActivitySafe } = require('../ai_logs/activity_log.service');
const { NotFoundError, ValidationError } = require('../../utils/errors');

function buildCustomerName(customer) {
  if (!customer) return 'Unknown Customer';
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return fullName || 'Unknown Customer';
}

async function getInvoices({ business_id, job_id, status, page = 1, limit = 20 }) {
  const where = {};
  if (job_id) where.job_id = job_id;
  if (status) where.status = status;
  if (business_id) where.job = { business_id };

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where, skip, take: limit,
      include: { line_items: true, payments: true, job: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.count({ where }),
  ]);
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getById(id) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      line_items: true,
      payments: true,
      edit_logs: { include: { user: { select: { id: true, email: true, first_name: true, last_name: true } } }, orderBy: { edited_at: 'desc' } },
      job: { include: { customer: true, business: true } },
    },
  });

  if (invoice?.job?.business) {
    const { internal_api_token, ...safeBusiness } = invoice.job.business;
    invoice.job.business = safeBusiness;
  }

  return invoice;
}

async function getByJobId(jobId) {
  return prisma.invoice.findMany({
    where: { job_id: jobId },
    include: { line_items: true, payments: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function create(data) {
  const invoice = await prisma.invoice.create({
    data: {
      job_id: data.job_id,
      business_id: data.business_id,
      status: data.status || 'Draft',
      notes: data.notes || null,
      due_date: data.due_date ? new Date(data.due_date) : null,
    },
    include: { line_items: true },
  });

  // Add line items if provided
  if (data.line_items && data.line_items.length > 0) {
    await prisma.invoiceLine.createMany({
      data: data.line_items.map((li) => ({
        invoice_id: invoice.id,
        description: li.description,
        quantity: li.quantity ?? 1,
        unit_price: li.unit_price,
        total: (li.quantity ?? 1) * li.unit_price,
        is_credit: li.is_credit ?? false,
      })),
    });
  }

  const createdInvoice = await getById(invoice.id);

  await logActivitySafe({
    business_id: data.business_id,
    customer_id: createdInvoice.job?.customer?.id,
    job_id: createdInvoice.job_id,
    event_type: 'invoice.created',
    title: `Invoice created for ${buildCustomerName(createdInvoice.job?.customer)}`,
    details: {
      invoice_id: createdInvoice.id,
      status: createdInvoice.status,
    },
  });

  return createdInvoice;
}

/**
 * Edit an invoice. Enforces status-based edit rules:
 * - Draft/Sent: full edit allowed
 * - Paid: only internal_notes allowed
 * - Refunded/Voided: locked entirely
 */
async function update(id, data, userId) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new NotFoundError('Invoice not found.');

  if (['Refunded', 'Voided'].includes(invoice.status)) {
    throw new ValidationError(`Invoice is ${invoice.status} and cannot be edited.`);
  }

  const isPaid = invoice.status === 'Paid';
  const updateData = {};
  const changes = {};

  if (!isPaid) {
    if (data.notes !== undefined) { changes.notes = { from: invoice.notes, to: data.notes }; updateData.notes = data.notes; }
    if (data.due_date !== undefined) { changes.due_date = { from: invoice.due_date, to: data.due_date }; updateData.due_date = data.due_date ? new Date(data.due_date) : null; }
    if (data.status !== undefined) { changes.status = { from: invoice.status, to: data.status }; updateData.status = data.status; }
    if (data.status === 'Sent') updateData.sent_at = invoice.sent_at || new Date();
  }

  if (data.internal_notes !== undefined) {
    changes.internal_notes = { from: invoice.internal_notes, to: data.internal_notes };
    updateData.internal_notes = data.internal_notes;
  }

  // Update line items (only allowed on non-paid invoices)
  if (!isPaid && data.line_items !== undefined) {
    await prisma.invoiceLine.deleteMany({ where: { invoice_id: id } });
    if (data.line_items.length > 0) {
      await prisma.invoiceLine.createMany({
        data: data.line_items.map((li) => ({
          invoice_id: id,
          description: li.description,
          quantity: li.quantity ?? 1,
          unit_price: li.unit_price,
          total: (li.quantity ?? 1) * li.unit_price,
          is_credit: li.is_credit ?? false,
        })),
      });
    }
    changes.line_items = 'updated';
  }

  const updated = await prisma.invoice.update({ where: { id }, data: updateData });

  // Audit log if anything changed
  if (Object.keys(changes).length > 0) {
    await prisma.invoiceEditLog.create({
      data: { invoice_id: id, edited_by: userId || null, changes },
    });
    logger.info(`Invoice ${id} edited`, { userId, changes });
  }

  const updatedInvoiceWithRelations = await getById(id);

  await logActivitySafe({
    business_id: updatedInvoiceWithRelations.business_id,
    customer_id: updatedInvoiceWithRelations.job?.customer?.id,
    job_id: updatedInvoiceWithRelations.job_id,
    event_type: 'invoice.updated',
    title: `Invoice updated for ${buildCustomerName(updatedInvoiceWithRelations.job?.customer)}`,
    details: {
      invoice_id: updatedInvoiceWithRelations.id,
      status: updatedInvoiceWithRelations.status,
      changes,
    },
  });

  return updatedInvoiceWithRelations;
}

async function send(id) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  await prisma.invoice.update({ where: { id }, data: { status: 'Sent', sent_at: new Date() } });
  const sentInvoice = await getById(id);

  await logActivitySafe({
    business_id: sentInvoice.business_id,
    customer_id: sentInvoice.job?.customer?.id,
    job_id: sentInvoice.job_id,
    event_type: 'invoice.sent',
    title: `Invoice sent to ${buildCustomerName(sentInvoice.job?.customer)}`,
    details: {
      invoice_id: sentInvoice.id,
      status: sentInvoice.status,
    },
  });

  return sentInvoice;
}

async function voidInvoice(id, userId) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  if (invoice.status === 'Paid') throw new ValidationError('Cannot void a paid invoice. Issue a refund instead.');

  const updated = await prisma.invoice.update({ where: { id }, data: { status: 'Voided', voided_at: new Date() } });
  await prisma.invoiceEditLog.create({ data: { invoice_id: id, edited_by: userId || null, changes: { action: 'voided' } } });
  const voidedInvoice = await getById(id);

  await logActivitySafe({
    business_id: voidedInvoice.business_id,
    customer_id: voidedInvoice.job?.customer?.id,
    job_id: voidedInvoice.job_id,
    event_type: 'invoice.voided',
    title: `Invoice voided for ${buildCustomerName(voidedInvoice.job?.customer)}`,
    details: {
      invoice_id: voidedInvoice.id,
      status: voidedInvoice.status,
    },
  });

  return updated;
}

async function refundInvoice(id, { amount, reason, userId }) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  if (!['Paid', 'PartiallyPaid'].includes(invoice.status)) {
    throw new ValidationError('Invoice must be paid to issue a refund.');
  }

  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const refundAmt = amount || totalPaid;

  if (refundAmt > totalPaid) {
    throw new ValidationError('Refund amount cannot exceed amount paid.');
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: 'Refunded', refunded_at: new Date(), refund_amount: refundAmt, refund_reason: reason || null },
  });

  await prisma.invoiceEditLog.create({
    data: { invoice_id: id, edited_by: userId || null, changes: { action: 'refunded', amount: refundAmt, reason } },
  });

  logger.info(`Invoice ${id} refunded: $${refundAmt}`);
  const refundedInvoice = await getById(id);

  await logActivitySafe({
    business_id: refundedInvoice.business_id,
    customer_id: refundedInvoice.job?.customer?.id,
    job_id: refundedInvoice.job_id,
    event_type: 'invoice.refunded',
    title: `Invoice refunded for ${buildCustomerName(refundedInvoice.job?.customer)}`,
    details: {
      invoice_id: refundedInvoice.id,
      amount: refundAmt,
      reason: reason || null,
      status: refundedInvoice.status,
    },
  });

  return updated;
}

async function getInvoiceTotal(id) {
  const lines = await prisma.invoiceLine.findMany({ where: { invoice_id: id } });
  const subtotal = lines.reduce((sum, l) => sum + (l.is_credit ? -l.total : l.total), 0);
  const payments = await prisma.payment.findMany({ where: { invoice_id: id } });
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  return { subtotal, total_paid: totalPaid, balance_due: subtotal - totalPaid };
}

module.exports = { getInvoices, getById, getByJobId, create, update, send, voidInvoice, refundInvoice, getInvoiceTotal };
