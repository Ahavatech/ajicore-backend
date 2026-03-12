/**
 * Payment Service
 * Handles payment processing logic, integrating with Stripe gateway.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const stripeGateway = require('../../integrations/payments/stripe_gateway');
const logger = require('../../utils/logger');

/**
 * Process a payment for an invoice.
 * @param {string} invoiceId - The invoice UUID.
 * @param {Object} paymentData - { amount, payment_method_id }
 */
async function processPayment(invoiceId, paymentData) {
  const invoice = await prisma.quote_Invoice.findUnique({ where: { id: invoiceId } });

  if (!invoice) {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    throw err;
  }

  if (invoice.type !== 'Invoice') {
    const err = new Error('Payments can only be applied to invoices, not quotes.');
    err.statusCode = 400;
    throw err;
  }

  const remaining = invoice.total_amount - invoice.amount_paid;
  const amount = Math.min(paymentData.amount, remaining);

  if (amount <= 0) {
    const err = new Error('Invoice is already fully paid.');
    err.statusCode = 400;
    throw err;
  }

  // Process via Stripe
  const charge = await stripeGateway.createPaymentIntent({
    amount: Math.round(amount * 100), // cents
    currency: 'usd',
    payment_method: paymentData.payment_method_id,
    confirm: true,
  });

  // Update invoice
  const newAmountPaid = invoice.amount_paid + amount;
  const newStatus = newAmountPaid >= invoice.total_amount ? 'Paid' : 'PartiallyPaid';

  const updatedInvoice = await prisma.quote_Invoice.update({
    where: { id: invoiceId },
    data: { amount_paid: newAmountPaid, status: newStatus },
  });

  logger.info(`Payment of $${amount} applied to invoice ${invoiceId}`, { newStatus });

  return { invoice: updatedInvoice, charge };
}

module.exports = { processPayment };