/**
 * Staff Controller
 * Handles HTTP logic for staff management, staff self-service, timesheets, and payroll.
 */
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');
const prisma = require('../../lib/prisma');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const payrollService = require('./payroll.service');
const scheduleService = require('../jobs/schedule.service');
const {
  ConflictError,
  NotFoundError,
  ValidationError,
} = require('../../utils/errors');

const SALT_ROUNDS = 12;
const STAFF_TIME_ACTIONS = ['Clock In', 'Clock Out', 'Start Break', 'End Break'];
const STAFF_STATUS = {
  CLOCKED_IN: 'Clocked In',
  CLOCKED_OUT: 'Clocked Out',
  ON_BREAK: 'On Break',
};
const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

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

function splitName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    return { first_name: null, last_name: null };
  }

  const parts = trimmed.split(/\s+/);
  return {
    first_name: parts.shift() || null,
    last_name: parts.join(' ') || null,
  };
}

function generateTemporaryPassword() {
  return `Aj!${randomBytes(6).toString('base64url')}`;
}

function roundHours(value) {
  return Math.round(value * 100) / 100;
}

function calculateBreakMinutes(timesheet, referenceTime = new Date()) {
  let minutes = Number(timesheet.accumulated_break_minutes || 0);

  if (timesheet.break_started_at) {
    minutes += Math.max(0, Math.round((referenceTime - new Date(timesheet.break_started_at)) / (1000 * 60)));
  }

  return minutes;
}

function calculateTimesheetHours(timesheet, referenceTime = new Date()) {
  if (timesheet.total_hours !== null && timesheet.total_hours !== undefined) {
    return Number(timesheet.total_hours);
  }

  const endTime = timesheet.clock_out ? new Date(timesheet.clock_out) : referenceTime;
  const totalMinutes = Math.max(0, Math.round((endTime - new Date(timesheet.clock_in)) / (1000 * 60)));
  const workedMinutes = Math.max(0, totalMinutes - calculateBreakMinutes(timesheet, referenceTime));
  return roundHours(workedMinutes / 60);
}

function formatScheduleTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildDispatchItem(item, type) {
  const customerName = item.customer
    ? [item.customer.first_name, item.customer.last_name].filter(Boolean).join(' ').trim()
      || item.customer.company_name
      || 'Unknown Customer'
    : 'Unknown Customer';
  const scheduledAt = item.scheduled_start_time || item.scheduled_estimate_date || null;

  return {
    id: item.id,
    type,
    title: item.title || item.service_name || item.service_type || item.description || type,
    customer_name: customerName,
    address: item.address || item.customer?.location_main || item.customer?.address || null,
    time: formatScheduleTime(scheduledAt),
    status: item.status,
    scheduled_at: scheduledAt,
  };
}

async function sendStaffInviteEmail({ email, name, temporaryPassword }) {
  const appUrl = process.env.FRONTEND_URL || env.BACKEND_URL || 'http://localhost:3000';
  logger.warn('Staff invite email provider is not configured. Logging invite payload instead.', {
    email,
    name,
    temporaryPassword,
    appUrl,
  });

  return {
    status: env.isProduction ? 'logged' : 'preview',
    app_url: appUrl,
  };
}

function getRequestBusinessId(req) {
  return req.body.business_id || req.query.business_id || req.user.business_id || null;
}

async function getCurrentStaffMember(req) {
  if (!req.user?.staff_id) {
    throw new ValidationError('This endpoint requires a staff account.');
  }

  const staff = await prisma.staff.findUnique({
    where: { id: req.user.staff_id },
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

  if (!staff) {
    throw new NotFoundError('Staff member');
  }

  return staff;
}

function validateAvailabilitySchedule(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    throw new ValidationError('schedule must be an object keyed by weekday.');
  }

  for (const day of WEEKDAY_KEYS) {
    const value = schedule[day];
    if (!value) continue;

    if (typeof value.available !== 'boolean') {
      throw new ValidationError(`schedule.${day}.available must be a boolean.`);
    }

    if (value.available) {
      if (!value.start || !value.end) {
        throw new ValidationError(`schedule.${day}.start and schedule.${day}.end are required when available is true.`);
      }
    }
  }
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

    const isFutureScheduling = start_time && new Date(start_time) > new Date() && include_future === 'true';

    const staff = await prisma.staff.findMany({
      where: {
        business_id,
        active_job_id: null,
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
    if (!req.body.email) {
      throw new ValidationError('email is required to provision a staff login.');
    }

    const normalizedEmail = String(req.body.email).trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      throw new ConflictError('A user with this email already exists.');
    }

    const temporaryPassword = generateTemporaryPassword();
    const password_hash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
    const staffName = String(req.body.name || '').trim();
    const split = splitName(staffName);

    const result = await prisma.$transaction(async (tx) => {
      const staff = await tx.staff.create({
        data: {
          business_id: req.body.business_id,
          name: staffName,
          role: req.body.role || 'Technician',
          hourly_rate: req.body.hourly_rate,
          employment_type: req.body.employment_type || null,
          entry_level: req.body.entry_level || null,
          notes: req.body.notes || null,
          email: normalizedEmail,
          phone: req.body.phone || null,
          check_in_frequency_hours: req.body.check_in_frequency_hours ?? null,
          current_status: STAFF_STATUS.CLOCKED_OUT,
        },
      });

      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password_hash,
          role: 'staff',
          business_id: req.body.business_id,
          staff_id: staff.id,
          first_name: split.first_name,
          last_name: split.last_name,
          phone_number: req.body.phone || null,
          onboarding_step: 6,
          onboarding_completed: true,
          auth_provider: 'Email',
        },
      });

      return { staff, user };
    });

    const inviteDelivery = await sendStaffInviteEmail({
      email: normalizedEmail,
      name: result.staff.name,
      temporaryPassword,
    });

    const response = {
      ...result.staff,
      user_id: result.user.id,
      login_email: result.user.email,
      invitation_delivery: inviteDelivery.status,
      invitation_app_url: inviteDelivery.app_url,
    };

    if (!env.isProduction) {
      response.temporary_password = temporaryPassword;
    }

    res.status(201).json(response);
  } catch (err) { next(err); }
}

async function updateStaff(req, res, next) {
  try {
    const updateData = {};
    const fields = ['name', 'role', 'hourly_rate', 'employment_type', 'entry_level', 'notes', 'email', 'phone', 'check_in_frequency_hours'];
    fields.forEach((f) => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });

    if (updateData.email) {
      updateData.email = String(updateData.email).trim().toLowerCase();
      const linkedUser = await prisma.user.findFirst({
        where: {
          email: updateData.email,
          NOT: { staff_id: req.params.id },
        },
        select: { id: true },
      });
      if (linkedUser) {
        throw new ConflictError('A user with this email already exists.');
      }
    }

    const staff = await prisma.staff.update({ where: { id: req.params.id }, data: updateData });

    const linkedUser = await prisma.user.findFirst({
      where: { staff_id: staff.id },
      select: { id: true },
    });

    if (linkedUser) {
      const userUpdate = {};
      if (updateData.email !== undefined) userUpdate.email = staff.email;
      if (updateData.phone !== undefined) userUpdate.phone_number = staff.phone;
      if (updateData.name !== undefined) {
        const split = splitName(staff.name);
        userUpdate.first_name = split.first_name;
        userUpdate.last_name = split.last_name;
      }

      if (Object.keys(userUpdate).length > 0) {
        await prisma.user.update({
          where: { id: linkedUser.id },
          data: userUpdate,
        });
      }
    }

    res.json(staff);
  } catch (err) { next(err); }
}

async function deleteStaff(req, res, next) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { staff_id: req.params.id },
        data: { staff_id: null, business_id: null },
      });
      await tx.staff.delete({ where: { id: req.params.id } });
    });
    res.status(204).send();
  } catch (err) { next(err); }
}

async function clockIn(req, res, next) {
  try {
    const { job_id } = req.body;
    const active = await prisma.timesheet.findFirst({ where: { staff_id: req.params.id, clock_out: null } });
    if (active) return res.status(400).json({ error: 'Staff member is already clocked in.' });

    const timesheet = await prisma.$transaction(async (tx) => {
      const created = await tx.timesheet.create({
        data: { staff_id: req.params.id, job_id: job_id || null, clock_in: new Date() },
      });
      await tx.staff.update({
        where: { id: req.params.id },
        data: { current_status: STAFF_STATUS.CLOCKED_IN },
      }).catch(() => {});
      return created;
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

    const clockOutTime = new Date();
    const totalHours = calculateTimesheetHours({ ...timesheet, clock_out: clockOutTime }, clockOutTime);
    const breakMinutes = calculateBreakMinutes(timesheet, clockOutTime);

    const updated = await prisma.$transaction(async (tx) => {
      const closed = await tx.timesheet.update({
        where: { id: timesheet.id },
        data: {
          clock_out: clockOutTime,
          total_hours: totalHours,
          break_started_at: null,
          accumulated_break_minutes: breakMinutes,
        },
      });
      await tx.staff.update({
        where: { id: req.params.id },
        data: { current_status: STAFF_STATUS.CLOCKED_OUT },
      }).catch(() => {});
      return closed;
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

    const timesheetToday = await prisma.timesheet.findMany({
      where: {
        staff: { business_id },
        clock_in: { gte: today, lt: tomorrow },
      },
    });

    const totalHoursToday = timesheetToday.reduce((sum, ts) => sum + calculateTimesheetHours(ts), 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const jobsLast30Days = await prisma.job.findMany({
      where: {
        business_id,
        status: { in: ['Completed', 'Invoiced'] },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const avgJobsPerDay = roundHours(jobsLast30Days.length / 30);

    res.json({
      totalHoursToday: roundHours(totalHoursToday),
      avgJobsPerDay,
    });
  } catch (err) { next(err); }
}

async function getDashboardSummary(req, res, next) {
  try {
    const staff = await getCurrentStaffMember(req);
    const requestedBusinessId = getRequestBusinessId(req);
    if (requestedBusinessId && requestedBusinessId !== staff.business_id) {
      throw new ValidationError('business_id does not match the authenticated staff account.');
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = day === 0 ? 6 : day - 1;
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    const [jobsToday, estimatesToday, timesheetsThisWeek, todayJobs, todayQuotes, upcomingJobs, upcomingQuotes] = await Promise.all([
      prisma.job.count({
        where: {
          business_id: staff.business_id,
          assigned_staff_id: staff.id,
          scheduled_start_time: { gte: todayStart, lt: todayEnd },
        },
      }),
      prisma.quote.count({
        where: {
          business_id: staff.business_id,
          assigned_staff_id: staff.id,
          is_estimate_appointment: true,
          OR: [
            { scheduled_start_time: { gte: todayStart, lt: todayEnd } },
            { scheduled_estimate_date: { gte: todayStart, lt: todayEnd } },
          ],
        },
      }),
      prisma.timesheet.findMany({
        where: {
          staff_id: staff.id,
          clock_in: { gte: weekStart },
        },
      }),
      prisma.job.findMany({
        where: {
          business_id: staff.business_id,
          assigned_staff_id: staff.id,
          scheduled_start_time: { gte: todayStart, lt: todayEnd },
        },
        include: {
          customer: true,
        },
        orderBy: { scheduled_start_time: 'asc' },
      }),
      prisma.quote.findMany({
        where: {
          business_id: staff.business_id,
          assigned_staff_id: staff.id,
          is_estimate_appointment: true,
          OR: [
            { scheduled_start_time: { gte: todayStart, lt: todayEnd } },
            { scheduled_estimate_date: { gte: todayStart, lt: todayEnd } },
          ],
        },
        include: {
          customer: true,
        },
        orderBy: { scheduled_start_time: 'asc' },
      }),
      prisma.job.findMany({
        where: {
          business_id: staff.business_id,
          assigned_staff_id: staff.id,
          scheduled_start_time: { gte: now },
        },
        include: { customer: true },
        orderBy: { scheduled_start_time: 'asc' },
        take: 1,
      }),
      prisma.quote.findMany({
        where: {
          business_id: staff.business_id,
          assigned_staff_id: staff.id,
          is_estimate_appointment: true,
          OR: [
            { scheduled_start_time: { gte: now } },
            { scheduled_estimate_date: { gte: now } },
          ],
        },
        include: { customer: true },
        orderBy: { scheduled_start_time: 'asc' },
        take: 1,
      }),
    ]);

    const hoursLoggedThisWeek = roundHours(
      timesheetsThisWeek.reduce((sum, timesheet) => sum + calculateTimesheetHours(timesheet, now), 0)
    );

    const schedule = [
      ...todayJobs.map((job) => buildDispatchItem(job, 'Job')),
      ...todayQuotes.map((quote) => buildDispatchItem(quote, 'Estimate')),
    ].sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0));

    const nextDispatchCandidates = [
      ...upcomingJobs.map((job) => buildDispatchItem(job, 'Job')),
      ...upcomingQuotes.map((quote) => buildDispatchItem(quote, 'Estimate')),
    ].sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0));

    const nextDispatch = nextDispatchCandidates[0]
      ? (({ scheduled_at, ...item }) => item)(nextDispatchCandidates[0])
      : null;

    res.json({
      kpis: {
        jobs_today: jobsToday,
        estimates_today: estimatesToday,
        hours_logged_this_week: hoursLoggedThisWeek,
      },
      current_status: staff.current_status || STAFF_STATUS.CLOCKED_OUT,
      next_dispatch: nextDispatch,
      todays_schedule: schedule.map(({ scheduled_at, ...item }) => item),
    });
  } catch (err) { next(err); }
}

async function timeTracking(req, res, next) {
  try {
    const { action } = req.body;
    if (!STAFF_TIME_ACTIONS.includes(action)) {
      throw new ValidationError(`action must be one of: ${STAFF_TIME_ACTIONS.join(', ')}`);
    }

    const staff = await getCurrentStaffMember(req);
    const openTimesheet = await prisma.timesheet.findFirst({
      where: { staff_id: staff.id, clock_out: null },
      orderBy: { clock_in: 'desc' },
    });
    const now = new Date();

    if (action === 'Clock In') {
      if (openTimesheet) {
        throw new ValidationError('You are already clocked in.');
      }

      const created = await prisma.$transaction(async (tx) => {
        const timesheet = await tx.timesheet.create({
          data: {
            staff_id: staff.id,
            clock_in: now,
          },
        });

        await tx.staff.update({
          where: { id: staff.id },
          data: { current_status: STAFF_STATUS.CLOCKED_IN },
        });

        return timesheet;
      });

      return res.status(201).json({
        action,
        current_status: STAFF_STATUS.CLOCKED_IN,
        timesheet: created,
      });
    }

    if (!openTimesheet) {
      throw new ValidationError('No active clock-in found.');
    }

    if (action === 'Start Break') {
      if (openTimesheet.break_started_at) {
        throw new ValidationError('Break already started.');
      }

      const updated = await prisma.$transaction(async (tx) => {
        const timesheet = await tx.timesheet.update({
          where: { id: openTimesheet.id },
          data: { break_started_at: now },
        });

        await tx.staff.update({
          where: { id: staff.id },
          data: { current_status: STAFF_STATUS.ON_BREAK },
        });

        return timesheet;
      });

      return res.json({
        action,
        current_status: STAFF_STATUS.ON_BREAK,
        timesheet: updated,
      });
    }

    if (action === 'End Break') {
      if (!openTimesheet.break_started_at) {
        throw new ValidationError('No active break found.');
      }

      const breakMinutes = calculateBreakMinutes({
        ...openTimesheet,
        accumulated_break_minutes: 0,
      }, now);

      const updated = await prisma.$transaction(async (tx) => {
        const timesheet = await tx.timesheet.update({
          where: { id: openTimesheet.id },
          data: {
            accumulated_break_minutes: Number(openTimesheet.accumulated_break_minutes || 0) + breakMinutes,
            break_started_at: null,
          },
        });

        await tx.staff.update({
          where: { id: staff.id },
          data: { current_status: STAFF_STATUS.CLOCKED_IN },
        });

        return timesheet;
      });

      return res.json({
        action,
        current_status: STAFF_STATUS.CLOCKED_IN,
        timesheet: updated,
      });
    }

    const finalBreakMinutes = calculateBreakMinutes(openTimesheet, now);
    const totalHours = calculateTimesheetHours({
      ...openTimesheet,
      accumulated_break_minutes: finalBreakMinutes,
      break_started_at: null,
      clock_out: now,
    }, now);

    const closed = await prisma.$transaction(async (tx) => {
      const timesheet = await tx.timesheet.update({
        where: { id: openTimesheet.id },
        data: {
          clock_out: now,
          total_hours: totalHours,
          accumulated_break_minutes: finalBreakMinutes,
          break_started_at: null,
        },
      });

      await tx.staff.update({
        where: { id: staff.id },
        data: { current_status: STAFF_STATUS.CLOCKED_OUT },
      });

      return timesheet;
    });

    return res.json({
      action,
      current_status: STAFF_STATUS.CLOCKED_OUT,
      timesheet: closed,
    });
  } catch (err) { next(err); }
}

async function updateAvailability(req, res, next) {
  try {
    validateAvailabilitySchedule(req.body.schedule);

    const staff = await getCurrentStaffMember(req);
    const updated = await prisma.staff.update({
      where: { id: staff.id },
      data: { availability_schedule: req.body.schedule },
    });

    res.json({
      id: updated.id,
      availability_schedule: updated.availability_schedule,
    });
  } catch (err) { next(err); }
}

module.exports = {
  getAllStaff,
  getAvailableStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  clockIn,
  clockOut,
  getTimesheets,
  calculatePayroll,
  getStaffTimesheets,
  getStaffPayroll,
  getStaffMetrics,
  getDashboardSummary,
  timeTracking,
  updateAvailability,
};
