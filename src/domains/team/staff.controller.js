/**
 * Staff Controller
 * Handles HTTP logic for staff management, timesheets, and payroll.
 */
const prisma = require('../../lib/prisma');
const payrollService = require('./payroll.service');
const scheduleService = require('../jobs/schedule.service');

function buildStaffResponse(staff) {
  const activeJob = staff.active_job || null;
  const openTimesheet = Array.isArray(staff.timesheets) && staff.timesheets.length > 0 ? staff.timesheets[0] : null;

  return {
    ...staff,
    has_open_timesheet: Boolean(openTimesheet),
    open_timesheet: openTimesheet,
    active_job_summary: activeJob
      ? {
          id: activeJob.id,
          title: activeJob.title,
          status: activeJob.status,
          address: activeJob.address,
          scheduled_start_time: activeJob.scheduled_start_time,
          customer: activeJob.customer || null,
        }
      : null,
  };
}

async function getAllStaff(req, res, next) {
  try {
    const { business_id } = req.query;
    const where = {};
    if (business_id) where.business_id = business_id;
    const staff = await prisma.staff.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        active_job: {
          include: {
            customer: { select: { id: true, first_name: true, last_name: true } },
          },
        },
        timesheets: {
          where: { clock_out: null },
          orderBy: { clock_in: 'desc' },
          take: 1,
        },
      },
    });
    res.json(staff.map(buildStaffResponse));
  } catch (err) { next(err); }
}

async function getAvailableStaff(req, res, next) {
  try {
    const { business_id, start_time, end_time, exclude_job_id, include_future } = req.query;
    if ((start_time && !end_time) || (!start_time && end_time)) {
      return res.status(400).json({ error: 'start_time and end_time must be provided together.' });
    }

    // Allow future scheduling if start_time is in future and flag is set
    const isFutureScheduling = start_time && new Date(start_time) > new Date() && include_future === 'true';

    const staff = await prisma.staff.findMany({
      where: {
        business_id,
        active_job_id: null,
        // Only require clocked-in for immediate assignments
        ...(isFutureScheduling ? {} : {
          timesheets: {
            some: { clock_out: null },
          },
        }),
      },
      orderBy: { name: 'asc' },
      include: {
        active_job: {
          include: {
            customer: { select: { id: true, first_name: true, last_name: true } },
          },
        },
        timesheets: {
          where: { clock_out: null },
          orderBy: { clock_in: 'desc' },
          take: 1,
        },
      },
    });

    if (!start_time || !end_time) {
      return res.json(staff.map(buildStaffResponse));
    }

    const availabilityChecks = await Promise.all(
      staff.map(async (member) => {
        const availability = await scheduleService.checkStaffAvailability(member.id, start_time, end_time, { exclude_job_id });
        return { member, availability };
      })
    );

    const availableStaff = availabilityChecks
      .filter(({ availability }) => availability.available)
      .map(({ member }) => buildStaffResponse(member));

    res.json(availableStaff);
  } catch (err) { next(err); }
}

async function getStaffById(req, res, next) {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: req.params.id },
      include: {
        active_job: {
          include: {
            customer: { select: { id: true, first_name: true, last_name: true } },
          },
        },
        timesheets: { orderBy: { clock_in: 'desc' }, take: 20, include: { job: true } },
      },
    });
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });
    res.json(buildStaffResponse(staff));
  } catch (err) { next(err); }
}

async function createStaff(req, res, next) {
  try {
    const staff = await prisma.staff.create({
      data: {
        business_id: req.body.business_id,
        name: req.body.name,
        role: req.body.role || 'Technician',
        hourly_rate: req.body.hourly_rate,
        employment_type: req.body.employment_type || null,
        entry_level: req.body.entry_level || null,
        notes: req.body.notes || null,
        email: req.body.email || null,
        phone: req.body.phone || null,
        check_in_frequency_hours: req.body.check_in_frequency_hours ?? null,
      },
    });
    res.status(201).json(staff);
  } catch (err) { next(err); }
}

async function updateStaff(req, res, next) {
  try {
    const updateData = {};
    const fields = ['name', 'role', 'hourly_rate', 'employment_type', 'entry_level', 'notes', 'email', 'phone', 'check_in_frequency_hours'];
    fields.forEach((f) => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });
    const staff = await prisma.staff.update({ where: { id: req.params.id }, data: updateData });
    res.json(staff);
  } catch (err) { next(err); }
}

async function deleteStaff(req, res, next) {
  try {
    await prisma.staff.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}

async function clockIn(req, res, next) {
  try {
    const { job_id } = req.body;
    // Check if already clocked in
    const active = await prisma.timesheet.findFirst({ where: { staff_id: req.params.id, clock_out: null } });
    if (active) return res.status(400).json({ error: 'Staff member is already clocked in.' });

    const timesheet = await prisma.timesheet.create({
      data: { staff_id: req.params.id, job_id: job_id || null, clock_in: new Date() },
    });
    res.status(201).json(timesheet);
  } catch (err) { next(err); }
}

async function clockOut(req, res, next) {
  try {
    const timesheet = await prisma.timesheet.findFirst({
      where: { staff_id: req.params.id, clock_out: null },
      orderBy: { clock_in: 'desc' },
    });
    if (!timesheet) return res.status(400).json({ error: 'No active clock-in found.' });

    const clockOut = new Date();
    const totalHours = (clockOut - timesheet.clock_in) / (1000 * 60 * 60);
    const updated = await prisma.timesheet.update({
      where: { id: timesheet.id },
      data: { clock_out: clockOut, total_hours: Math.round(totalHours * 100) / 100 },
    });
    res.json(updated);
  } catch (err) { next(err); }
}

async function getTimesheets(req, res, next) {
  try {
    const { business_id, staff_id, job_id, start_date, end_date } = req.query;
    const where = {};
    if (staff_id) where.staff_id = staff_id;
    if (job_id) where.job_id = job_id;
    if (business_id) where.staff = { business_id };
    if (start_date || end_date) {
      where.clock_in = {};
      if (start_date) where.clock_in.gte = new Date(start_date);
      if (end_date) where.clock_in.lte = new Date(end_date);
    }
    const timesheets = await prisma.timesheet.findMany({
      where,
      include: { staff: true, job: { include: { customer: true } } },
      orderBy: { clock_in: 'desc' },
    });
    res.json(timesheets);
  } catch (err) { next(err); }
}

async function calculatePayroll(req, res, next) {
  try {
    const { business_id, start_date, end_date } = req.query;
    const payroll = await payrollService.calculatePayroll(business_id, start_date, end_date);
    res.json(payroll);
  } catch (err) { next(err); }
}

async function getStaffTimesheets(req, res, next) {
  try {
    const { id } = req.params;
    const timesheets = await prisma.timesheet.findMany({
      where: { staff_id: id },
      include: { job: { include: { customer: true } } },
      orderBy: { clock_in: 'desc' },
    });
    res.json(timesheets);
  } catch (err) { next(err); }
}

async function getStaffPayroll(req, res, next) {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;
    const payroll = await payrollService.calculateStaffPayroll(id, start_date, end_date);
    res.json(payroll);
  } catch (err) { next(err); }
}

async function getStaffMetrics(req, res, next) {
  try {
    const { business_id } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Total hours today
    const timesheetToday = await prisma.timesheet.findMany({
      where: {
        staff: { business_id },
        clock_in: { gte: today, lt: tomorrow },
      },
    });

    const totalHoursToday = timesheetToday.reduce((sum, ts) => sum + (ts.total_hours || 0), 0);

    // Average jobs per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const jobsLast30Days = await prisma.job.findMany({
      where: {
        business_id,
        status: { in: ['Completed', 'Invoiced'] },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const avgJobsPerDay = Math.round((jobsLast30Days.length / 30) * 100) / 100;

    res.json({
      totalHoursToday: Math.round(totalHoursToday * 100) / 100,
      avgJobsPerDay,
    });
  } catch (err) { next(err); }
}

module.exports = { getAllStaff, getAvailableStaff, getStaffById, createStaff, updateStaff, deleteStaff, clockIn, clockOut, getTimesheets, calculatePayroll, getStaffTimesheets, getStaffPayroll, getStaffMetrics };
