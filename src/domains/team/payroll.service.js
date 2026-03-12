/**
 * Payroll Service
 * Calculates staff payroll based on timesheets and hourly rates.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Calculate payroll for all staff in a business within a date range.
 * @param {string} businessId
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {Object} Payroll summary with per-staff breakdown.
 */
async function calculatePayroll(businessId, startDate, endDate) {
  const staff = await prisma.staff.findMany({
    where: { business_id: businessId },
    include: {
      timesheets: {
        where: {
          clock_in: { gte: new Date(startDate) },
          clock_out: { lte: new Date(endDate), not: null },
        },
      },
    },
  });

  const breakdown = staff.map((member) => {
    const totalHours = member.timesheets.reduce((sum, ts) => sum + (ts.total_hours || 0), 0);
    const grossPay = totalHours * member.hourly_rate;

    return {
      staff_id: member.id,
      name: member.name,
      role: member.role,
      hourly_rate: member.hourly_rate,
      total_hours: Math.round(totalHours * 100) / 100,
      timesheet_entries: member.timesheets.length,
      gross_pay: Math.round(grossPay * 100) / 100,
    };
  });

  const totalPayroll = breakdown.reduce((sum, b) => sum + b.gross_pay, 0);

  return {
    business_id: businessId,
    period: { start: startDate, end: endDate },
    total_payroll: Math.round(totalPayroll * 100) / 100,
    staff_count: breakdown.length,
    breakdown,
  };
}

module.exports = { calculatePayroll };