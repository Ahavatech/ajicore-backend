/**
 * Payment Service
 * Records payments against invoices. Integrates with Stripe when available.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const stripeGateway = require('../../integrations/payments/stripe_gateway');
const logger = require('../../utils/logger');

async function processPayment(invoiceId, paymentData) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { line_items: true, payments: true },
  });

  if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });
  if (['Refunded', 'Voided', 'Cancelled'].includes(invoice.status)) {
    throw Object.assign(new Error(`Cannot apply payment to a ${invoice.status} invoice`), { statusCode: 400 });
  }

  const subtotal = invoice.line_items.reduce((sum, l) => sum + (l.is_credit ? -l.total : l.total), 0);
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = subtotal - totalPaid;

  if (remaining <= 0) throw Object.assign(new Error('Invoice is already fully paid'), { statusCode: 400 });

  const amount = Math.min(paymentData.amount, remaining);
  let stripePaymentId = null;

  // Try Stripe if payment_method_id provided
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
    await prisma.job.updateMany({ where: { invoices: { some: { id: invoiceId } } }, data: { status: 'Invoiced' } }).catch(() => {});
  }

  logger.info(`Payment of $${amount} applied to invoice ${invoiceId} → ${newStatus}`);
  return { payment, invoice: updatedInvoice };
}

async function getPaymentsByInvoice(invoiceId) {
  return prisma.payment.findMany({ where: { invoice_id: invoiceId }, orderBy: { paid_at: 'desc' } });
}

module.exports = { processPayment, getPaymentsByInvoice };
