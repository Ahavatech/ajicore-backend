/**
 * Staff Controller
 * Handles HTTP logic for staff and payroll management.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const payrollService = require('./payroll.service');

async function getAllStaff(req, res, next) {
  try {
    const { business_id } = req.query;
    const where = {};
    if (business_id) where.business_id = business_id;

    const staff = await prisma.staff.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json(staff);
  } catch (err) {
    next(err);
  }
}

async function getStaffById(req, res, next) {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: req.params.id },
      include: { timesheets: { orderBy: { clock_in: 'desc' }, take: 20 } },
    });
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });
    res.json(staff);
  } catch (err) {
    next(err);
  }
}

async function createStaff(req, res, next) {
  try {
    const staff = await prisma.staff.create({
      data: {
        business_id: req.body.business_id,
        name: req.body.name,
        role: req.body.role || 'Technician',
        hourly_rate: req.body.hourly_rate,
        email: req.body.email || null,
        phone: req.body.phone || null,
      },
    });
    res.status(201).json(staff);
  } catch (err) {
    next(err);
  }
}

async function updateStaff(req, res, next) {
  try {
    const updateData = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.role) updateData.role = req.body.role;
    if (req.body.hourly_rate !== undefined) updateData.hourly_rate = req.body.hourly_rate;
    if (req.body.email !== undefined) updateData.email = req.body.email;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;

    const staff = await prisma.staff.update({ where: { id: req.params.id }, data: updateData });
    res.json(staff);
  } catch (err) {
    next(err);
  }
}

async function clockIn(req, res, next) {
  try {
    const timesheet = await prisma.timesheet.create({
      data: {
        staff_id: req.params.id,
        clock_in: new Date(),
      },
    });
    res.status(201).json(timesheet);
  } catch (err) {
    next(err);
  }
}

async function clockOut(req, res, next) {
  try {
    const timesheet = await prisma.timesheet.findFirst({
      where: { staff_id: req.params.id, clock_out: null },
      orderBy: { clock_in: 'desc' },
    });

    if (!timesheet) {
      return res.status(400).json({ error: 'No active clock-in found for this staff member.' });
    }

    const clockOut = new Date();
    const totalHours = (clockOut.getTime() - timesheet.clock_in.getTime()) / (1000 * 60 * 60);

    const updated = await prisma.timesheet.update({
      where: { id: timesheet.id },
      data: { clock_out: clockOut, total_hours: Math.round(totalHours * 100) / 100 },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function calculatePayroll(req, res, next) {
  try {
    const { business_id, start_date, end_date } = req.query;
    const payroll = await payrollService.calculatePayroll(business_id, start_date, end_date);
    res.json(payroll);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllStaff, getStaffById, createStaff, updateStaff, clockIn, clockOut, calculatePayroll };