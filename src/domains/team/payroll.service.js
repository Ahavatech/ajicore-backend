/**
 * Payroll Service
 * Calculates staff payroll based on timesheets and hourly rates.
 */
const prisma = require('../../lib/prisma');
const { NotFoundError } = require('../../utils/errors');

function getDefaultCurrentCycle() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = now;
  return { start, end };
}

function resolvePayrollPeriod(startDate, endDate) {
  const defaults = getDefaultCurrentCycle();
  return {
    start: startDate ? new Date(startDate) : defaults.start,
    end: endDate ? new Date(endDate) : defaults.end,
  };
}

function summarizeStaffPayroll(member, timesheets, period) {
  const totalHours = timesheets.reduce((sum, ts) => {
    if (typeof ts.total_hours === 'number') return sum + ts.total_hours;
    if (ts.clock_out) return sum + ((new Date(ts.clock_out) - new Date(ts.clock_in)) / (1000 * 60 * 60));
    return sum;
  }, 0);
  const grossPay = totalHours * member.hourly_rate;

  return {
    staff_id: member.id,
    name: member.name,
    role: member.role,
    hourly_rate: member.hourly_rate,
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    total_hours: Math.round(totalHours * 100) / 100,
    timesheet_entries: timesheets.length,
    gross_pay: Math.round(grossPay * 100) / 100,
  };
}

/**
 * Calculate payroll for all staff in a business within a date range.
 * @param {string} businessId
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {Object} Payroll summary with per-staff breakdown.
 */
async function calculatePayroll(businessId, startDate, endDate) {
  const period = resolvePayrollPeriod(startDate, endDate);
  const staff = await prisma.staff.findMany({
    where: { business_id: businessId },
    include: {
      timesheets: {
        where: {
          clock_in: { gte: period.start },
          clock_out: { lte: period.end, not: null },
        },
      },
    },
  });

  const breakdown = staff.map((member) => {
    const { period: _period, ...summary } = summarizeStaffPayroll(member, member.timesheets, period);
    return summary;
  });

  const totalPayroll = breakdown.reduce((sum, b) => sum + b.gross_pay, 0);

  return {
    business_id: businessId,
    period: { start: period.start.toISOString(), end: period.end.toISOString() },
    total_payroll: Math.round(totalPayroll * 100) / 100,
    staff_count: breakdown.length,
    breakdown,
  };
}

async function calculateStaffPayroll(staffId, startDate, endDate) {
  const period = resolvePayrollPeriod(startDate, endDate);
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    include: {
      timesheets: {
        where: {
          clock_in: { gte: period.start },
          clock_out: { lte: period.end, not: null },
        },
        orderBy: { clock_in: 'desc' },
      },
    },
  });

  if (!staff) {
    throw new NotFoundError('Staff member');
  }

  return summarizeStaffPayroll(staff, staff.timesheets, period);
}

module.exports = { calculatePayroll, calculateStaffPayroll };
