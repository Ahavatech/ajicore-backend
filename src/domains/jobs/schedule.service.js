/**
 * Schedule Service
 * Handles schedule queries, availability checks, and conflict detection.
 */
const prisma = require('../../lib/prisma');
const { ValidationError } = require('../../utils/errors');

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
async function checkStaffAvailability(staffId, startTime, endTime, options = {}) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ValidationError('start_time and end_time must be valid ISO date-time values.');
  }

  if (end <= start) {
    throw new ValidationError('end_time must be later than start_time.');
  }

  const { exclude_job_id } = options;

  const conflicts = await prisma.job.findMany({
    where: {
      assigned_staff_id: staffId,
      status: { in: ['Scheduled', 'InProgress'] },
      ...(exclude_job_id ? { id: { not: exclude_job_id } } : {}),
      OR: [
        {
          scheduled_start_time: { lt: end },
          scheduled_end_time: { gt: start },
        },
        {
          scheduled_start_time: { gte: start, lt: end },
          scheduled_end_time: null,
        },
      ],
    },
    include: {
      customer: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
        },
      },
      assigned_staff: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: { scheduled_start_time: 'asc' },
  });

  return {
    available: conflicts.length === 0,
    staff_id: staffId,
    requested_window: {
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    },
    conflicts,
  };
}

module.exports = { getSchedule, checkStaffAvailability };
