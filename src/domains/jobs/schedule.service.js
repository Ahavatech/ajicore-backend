/**
 * Schedule Service
 * Handles schedule queries, availability checks, and conflict detection.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get all scheduled jobs within a date range for a business.
 */
async function getSchedule(businessId, startDate, endDate) {
  const where = {
    business_id: businessId,
    status: { in: ['Scheduled', 'InProgress'] },
  };

  if (startDate || endDate) {
    where.scheduled_start_time = {};
    if (startDate) where.scheduled_start_time.gte = new Date(startDate);
    if (endDate) where.scheduled_start_time.lte = new Date(endDate);
  }

  return prisma.job.findMany({
    where,
    include: { customer: true, assigned_staff: true },
    orderBy: { scheduled_start_time: 'asc' },
  });
}

/**
 * Check if a staff member is available during a given time window.
 */
async function checkStaffAvailability(staffId, startTime, endTime) {
  const conflicts = await prisma.job.findMany({
    where: {
      assigned_staff_id: staffId,
      status: { in: ['Scheduled', 'InProgress'] },
      OR: [
        {
          scheduled_start_time: { lt: new Date(endTime) },
          scheduled_end_time: { gt: new Date(startTime) },
        },
      ],
    },
  });

  return { available: conflicts.length === 0, conflicts };
}

module.exports = { getSchedule, checkStaffAvailability };