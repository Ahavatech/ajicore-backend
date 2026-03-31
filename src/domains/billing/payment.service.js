/**
 * Payment Service
 * Records payments against invoices. Integrates with Stripe when available.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const stripeGateway = require('../../integrations/payments/stripe_gateway');
const logger = require('../../utils/logger');
const { logActivitySafe } = require('../ai_logs/activity_log.service');
const { NotFoundError, ValidationError } = require('../../utils/errors');

function buildCustomerName(customer) {
  if (!customer) return 'Unknown Customer';
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return fullName || 'Unknown Customer';
}

async function processPayment(invoiceId, paymentData) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      line_items: true,
      payments: true,
      job: {
        include: {
          customer: true,
        },
      },
    },
  });

  if (!invoice) throw new NotFoundError('Invoice not found.');
  if (['Refunded', 'Voided', 'Cancelled'].includes(invoice.status)) {
    throw new ValidationError(`Cannot apply payment to a ${invoice.status} invoice.`);
  }

  const subtotal = invoice.line_items.reduce((sum, line) => sum + (line.is_credit ? -line.total : line.total), 0);
  const totalPaid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = subtotal - totalPaid;

  if (remaining <= 0) throw new ValidationError('Invoice is already fully paid.');

  const amount = Math.min(paymentData.amount, remaining);
  let stripePaymentId = null;

  if (paymentData.payment_method_id && stripeGateway.isConfigured()) {
    try {
      const charge = await stripeGateway.createPaymentIntent({
        amount: Math.round(amount * 100),
        currency: 'usd',
        payment_method: paymentData.payment_method_id,
        confirm: true,
      });
      stripePaymentId = charge.id;
    } catch (stripeErr) {
      logger.warn('Stripe payment failed, recording manually', { error: stripeErr.message });
    }
  }

  const payment = await prisma.payment.create({
    data: {
      invoice_id: invoiceId,
      amount,
      payment_method: paymentData.payment_method || 'manual',
      stripe_payment_id: stripePaymentId,
      notes: paymentData.notes || null,
    },
  });

  const newTotalPaid = totalPaid + amount;
  const newStatus = newTotalPaid >= subtotal ? 'Paid' : 'PartiallyPaid';
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: newStatus, paid_at: newStatus === 'Paid' ? new Date() : undefined },
    include: { line_items: true, payments: true },
  });

  if (newStatus === 'Paid') {
    await prisma.job.updateMany({
      where: { invoices: { some: { id: invoiceId } } },
      data: { status: 'Invoiced' },
    }).catch(() => {});
  }

  logger.info(`Payment of $${amount} applied to invoice ${invoiceId} -> ${newStatus}`);

  await logActivitySafe({
    business_id: invoice.job.business_id,
    customer_id: invoice.job.customer_id,
    job_id: invoice.job_id,
    event_type: 'invoice.payment_received',
    title: `Payment received from ${buildCustomerName(invoice.job.customer)}`,
    details: {
      invoice_id: invoiceId,
      amount,
      status: newStatus,
      payment_method: payment.payment_method,
    },
  });

  return { payment, invoice: updatedInvoice };
}

async function getPaymentsByInvoice(invoiceId) {
  return prisma.payment.findMany({ where: { invoice_id: invoiceId }, orderBy: { paid_at: 'desc' } });
}

module.exports = { processPayment, getPaymentsByInvoice };
