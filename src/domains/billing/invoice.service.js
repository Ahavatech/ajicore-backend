/**
 * Invoice Service
 * Business logic for quote/invoice lifecycle management.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getByJobId(jobId) {
  return prisma.quote_Invoice.findMany({
    where: { job_id: jobId },
    orderBy: { createdAt: 'desc' },
  });
}

async function create(data) {
  return prisma.quote_Invoice.create({
    data: {
      job_id: data.job_id,
      type: data.type,
      status: data.status || 'Draft',
      total_amount: data.total_amount,
      amount_paid: data.amount_paid || 0,
      due_date: data.due_date ? new Date(data.due_date) : null,
      notes: data.notes || null,
    },
  });
}

async function update(id, data) {
  const updateData = {};
  if (data.status) updateData.status = data.status;
  if (data.total_amount !== undefined) updateData.total_amount = data.total_amount;
  if (data.amount_paid !== undefined) updateData.amount_paid = data.amount_paid;
  if (data.due_date) updateData.due_date = new Date(data.due_date);
  if (data.notes !== undefined) updateData.notes = data.notes;

  return prisma.quote_Invoice.update({ where: { id }, data: updateData });
}

async function getById(id) {
  return prisma.quote_Invoice.findUnique({
    where: { id },
    include: { job: true },
  });
}

module.exports = { getByJobId, create, update, getById };