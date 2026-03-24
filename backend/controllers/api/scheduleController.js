import EmployeeSchedule from '../../models/EmployeeSchedule.js';
import EmployeeScheduleException from '../../models/EmployeeScheduleException.js';
import EmployeeTimeOff from '../../models/EmployeeTimeOff.js';
import AvailabilityService from '../../services/AvailabilityService.js';
import UserBusiness from '../../models/UserBusiness.js';
import { ERRORS } from '../../utils/errors.js';

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Verifies the caller has owner or admin role in the given business.
 * Used for write operations (schedule creation, update, delete).
 */
async function assertAdminAccess(req) {
    const businessId = Number(req.params.id);
    const userId = req.session.userId;
    const membership = await UserBusiness.findByUserAndBusiness(userId, businessId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
        throw ERRORS.FORBIDDEN('Administrative access required to manage employee schedules');
    }
    return businessId;
}

/**
 * Verifies the caller has any membership in the business.
 * Used for read operations (viewing schedule, availability).
 * An employee can view their own schedule; admin can view any.
 */
async function assertMemberAccess(req) {
    const businessId = Number(req.params.id);
    const userId = req.session.userId;
    const access = await UserBusiness.checkAccess(userId, businessId);
    if (!access) throw ERRORS.FORBIDDEN('You do not have access to this business');
    return businessId;
}

/**
 * Parses and validates the :userId param from the route.
 * Ensures the target worker actually belongs to the business.
 */
async function resolveWorkerId(businessId, req) {
    const workerId = Number(req.params.userId);
    if (isNaN(workerId)) throw ERRORS.VALIDATION('Worker ID must be a number');
    const membership = await UserBusiness.findByUserAndBusiness(workerId, businessId);
    if (!membership) throw ERRORS.NOT_FOUND('Worker not found in this business');
    return workerId;
}

// ─────────────────────────────────────────────────────────────────────────────

const ScheduleController = {

    // ── Recurring Schedule ────────────────────────────────────────────────────

    /**
     * GET /api/v1/business/:id/team/:userId/schedule
     * Returns all recurring schedule rows (with breaks) for a worker.
     * Accessible to any business member.
     */
    getSchedule: async (req, res, next) => {
        try {
            const businessId = await assertMemberAccess(req);
            const workerId   = await resolveWorkerId(businessId, req);

            const schedule = await EmployeeSchedule.findByWorker(businessId, workerId);

            res.json({ success: true, data: schedule });
        } catch (err) { next(err); }
    },

    /**
     * POST /api/v1/business/:id/team/:userId/schedule
     * Creates a new recurring schedule row for a specific day of week.
     * Runs conflict detection and returns warnings for existing appointments
     * that fall outside the new schedule window.
     * Requires admin/owner.
     */
    createScheduleRow: async (req, res, next) => {
        try {
            const businessId = await assertAdminAccess(req);
            const workerId   = await resolveWorkerId(businessId, req);

            const {
                day_of_week,
                start_time,
                end_time,
                is_day_off = false,
                effective_from = null,
                effective_to   = null,
                breaks = []
            } = req.body;

            // Input validation
            const day = Number(day_of_week);
            if (!day || day < 1 || day > 7) {
                throw ERRORS.VALIDATION('day_of_week must be a number 1–7 (1=Monday)');
            }
            if (!is_day_off) {
                if (!start_time || !end_time) throw ERRORS.VALIDATION('start_time and end_time are required');
                if (start_time >= end_time) throw ERRORS.VALIDATION('start_time must be before end_time');
            }
            if (breaks && !Array.isArray(breaks)) {
                throw ERRORS.VALIDATION('breaks must be an array');
            }
            _validateBreaks(breaks);

            // Retroactive conflict check — runs BEFORE creating the schedule row
            const conflicts = await EmployeeSchedule.detectConflicts(
                businessId, workerId, day, start_time, end_time, is_day_off ? 1 : 0
            );

            const scheduleId = await EmployeeSchedule.create({
                business_id: businessId,
                user_id: workerId,
                day_of_week: day,
                start_time,
                end_time,
                is_day_off: is_day_off ? 1 : 0,
                effective_from,
                effective_to,
                breaks
            });

            res.status(201).json({
                success: true,
                message: 'Schedule row created',
                data: { id: scheduleId },
                // Non-empty warnings = existing appointments outside new schedule
                warnings: conflicts.map(c => ({
                    appointmentId:       c.id,
                    appointmentDatetime: c.appointment_datetime,
                    clientName:          c.client_name,
                    message:             `This appointment is now outside the new schedule window`
                }))
            });
        } catch (err) { next(err); }
    },

    /**
     * PUT /api/v1/business/:id/team/:userId/schedule/:scheduleId
     * Replaces a recurring schedule row (times + breaks).
     * Returns conflict warnings for appointments affected by the change.
     * Requires admin/owner.
     */
    updateScheduleRow: async (req, res, next) => {
        try {
            const businessId = await assertAdminAccess(req);
            const workerId   = await resolveWorkerId(businessId, req);
            const scheduleId = Number(req.params.scheduleId);
            if (isNaN(scheduleId)) throw ERRORS.VALIDATION('Schedule ID must be a number');

            const {
                start_time,
                end_time,
                is_day_off = false,
                effective_from = null,
                effective_to   = null,
                breaks = []
            } = req.body;

            if (!is_day_off) {
                if (!start_time || !end_time) throw ERRORS.VALIDATION('start_time and end_time are required');
                if (start_time >= end_time) throw ERRORS.VALIDATION('start_time must be before end_time');
            }
            _validateBreaks(breaks);

            // Fetch existing row to get day_of_week for conflict check
            const existing = await _getScheduleRowOrThrow(scheduleId, businessId);

            const conflicts = await EmployeeSchedule.detectConflicts(
                businessId, workerId, existing.day_of_week, start_time, end_time, is_day_off ? 1 : 0
            );

            await EmployeeSchedule.update(scheduleId, businessId, {
                start_time, end_time, is_day_off: is_day_off ? 1 : 0,
                effective_from, effective_to, breaks
            });

            res.json({
                success: true,
                message: 'Schedule row updated',
                warnings: conflicts.map(c => ({
                    appointmentId:       c.id,
                    appointmentDatetime: c.appointment_datetime,
                    clientName:          c.client_name,
                    message:             `This appointment is now outside the updated schedule window`
                }))
            });
        } catch (err) { next(err); }
    },

    /**
     * DELETE /api/v1/business/:id/team/:userId/schedule/:scheduleId
     * Deletes a schedule row and its breaks.
     * Requires admin/owner.
     */
    deleteScheduleRow: async (req, res, next) => {
        try {
            const businessId = await assertAdminAccess(req);
            await resolveWorkerId(businessId, req); // ownership check
            const scheduleId = Number(req.params.scheduleId);
            if (isNaN(scheduleId)) throw ERRORS.VALIDATION('Schedule ID must be a number');

            await EmployeeSchedule.delete(scheduleId, businessId);
            res.json({ success: true, message: 'Schedule row deleted' });
        } catch (err) { next(err); }
    },

    // ── Schedule Exceptions ───────────────────────────────────────────────────

    /**
     * GET /api/v1/business/:id/team/:userId/schedule/exceptions
     * Returns all date-specific exceptions for a worker.
     * Optional query params: from=YYYY-MM-DD&to=YYYY-MM-DD
     */
    getExceptions: async (req, res, next) => {
        try {
            const businessId = await assertMemberAccess(req);
            const workerId   = await resolveWorkerId(businessId, req);

            const { from, to } = req.query;

            const exceptions = await EmployeeScheduleException.findByWorker(
                businessId, workerId, { fromDate: from, toDate: to }
            );

            res.json({ success: true, data: exceptions });
        } catch (err) { next(err); }
    },

    /**
     * POST /api/v1/business/:id/team/:userId/schedule/exceptions
     * Creates or replaces a date-specific exception.
     * Returns conflict warnings for booked appointments on that date.
     * Requires admin/owner.
     */
    createException: async (req, res, next) => {
        try {
            const businessId = await assertAdminAccess(req);
            const workerId   = await resolveWorkerId(businessId, req);

            const {
                exception_date,
                is_day_off = false,
                start_time = null,
                end_time   = null,
                reason     = null,
                breaks     = []
            } = req.body;

            if (!exception_date || !/^\d{4}-\d{2}-\d{2}$/.test(exception_date)) {
                throw ERRORS.VALIDATION('exception_date must be YYYY-MM-DD');
            }
            if (!is_day_off) {
                if (!start_time || !end_time) throw ERRORS.VALIDATION('start_time and end_time required');
                if (start_time >= end_time) throw ERRORS.VALIDATION('start_time must be before end_time');
            }
            _validateBreaks(breaks);

            // Detect conflicts for this specific date
            const conflicts = await _detectExceptionConflicts(
                businessId, workerId, exception_date, start_time, end_time, is_day_off
            );

            const exceptionId = await EmployeeScheduleException.create({
                business_id: businessId,
                user_id: workerId,
                exception_date,
                is_day_off: is_day_off ? 1 : 0,
                start_time,
                end_time,
                reason,
                created_by: req.session.userId,
                breaks
            });

            res.status(201).json({
                success: true,
                message: 'Schedule exception created',
                data: { id: exceptionId },
                warnings: conflicts
            });
        } catch (err) { next(err); }
    },

    /**
     * PUT /api/v1/business/:id/team/:userId/schedule/exceptions/:exceptionId
     * Updates an existing exception.
     * Requires admin/owner.
     */
    updateException: async (req, res, next) => {
        try {
            const businessId   = await assertAdminAccess(req);
            await resolveWorkerId(businessId, req);
            const exceptionId  = Number(req.params.exceptionId);
            if (isNaN(exceptionId)) throw ERRORS.VALIDATION('Exception ID must be a number');

            const {
                is_day_off = false,
                start_time = null,
                end_time   = null,
                reason     = null,
                breaks     = []
            } = req.body;

            if (!is_day_off) {
                if (!start_time || !end_time) throw ERRORS.VALIDATION('start_time and end_time required');
                if (start_time >= end_time) throw ERRORS.VALIDATION('start_time must be before end_time');
            }
            _validateBreaks(breaks);

            await EmployeeScheduleException.update(exceptionId, businessId, {
                is_day_off: is_day_off ? 1 : 0, start_time, end_time, reason, breaks
            });

            res.json({ success: true, message: 'Schedule exception updated' });
        } catch (err) { next(err); }
    },

    /**
     * DELETE /api/v1/business/:id/team/:userId/schedule/exceptions/:exceptionId
     * Deletes a date-specific exception. Breaks are removed via FK CASCADE.
     * Requires admin/owner.
     */
    deleteException: async (req, res, next) => {
        try {
            const businessId  = await assertAdminAccess(req);
            await resolveWorkerId(businessId, req);
            const exceptionId = Number(req.params.exceptionId);
            if (isNaN(exceptionId)) throw ERRORS.VALIDATION('Exception ID must be a number');

            await EmployeeScheduleException.delete(exceptionId, businessId);
            res.json({ success: true, message: 'Schedule exception deleted' });
        } catch (err) { next(err); }
    },

    // ── Time Off ──────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/business/:id/team/:userId/time-off
     * Returns all time-off records for a worker.
     * Optional query params: from=YYYY-MM-DD&to=YYYY-MM-DD
     */
    getTimeOff: async (req, res, next) => {
        try {
            const businessId = await assertMemberAccess(req);
            const workerId   = await resolveWorkerId(businessId, req);

            const { from, to } = req.query;

            const records = await EmployeeTimeOff.findByWorker(
                businessId, workerId, { fromDate: from, toDate: to }
            );

            res.json({ success: true, data: records });
        } catch (err) { next(err); }
    },

    /**
     * POST /api/v1/business/:id/team/:userId/time-off
     * Creates a new time-off record.
     * Returns conflict warnings for any already-booked appointments in the date range.
     * Requires admin/owner.
     */
    createTimeOff: async (req, res, next) => {
        try {
            const businessId = await assertAdminAccess(req);
            const workerId   = await resolveWorkerId(businessId, req);

            const {
                start_date,
                end_date,
                type       = 'vacation',
                status     = 'approved',
                note       = null,
            } = req.body;

            if (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
                throw ERRORS.VALIDATION('start_date must be YYYY-MM-DD');
            }
            if (!end_date || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
                throw ERRORS.VALIDATION('end_date must be YYYY-MM-DD');
            }
            if (start_date > end_date) {
                throw ERRORS.VALIDATION('start_date must be on or before end_date');
            }

            const validTypes = ['vacation', 'sick_leave', 'personal', 'other'];
            if (!validTypes.includes(type)) {
                throw ERRORS.VALIDATION(`type must be one of: ${validTypes.join(', ')}`);
            }

            // Conflict detection: booked appointments in the requested date range
            const conflicts = await _detectTimeOffConflicts(businessId, workerId, start_date, end_date);

            const id = await EmployeeTimeOff.create({
                business_id:  businessId,
                user_id:      workerId,
                start_date,
                end_date,
                type,
                status,
                note,
                approved_by: status === 'approved' ? req.session.userId : null
            });

            res.status(201).json({
                success: true,
                message: 'Time-off record created',
                data: { id },
                warnings: conflicts
            });
        } catch (err) { next(err); }
    },

    /**
     * PATCH /api/v1/business/:id/team/:userId/time-off/:timeOffId
     * Updates status, dates, or note of a time-off record.
     * Requires admin/owner.
     */
    updateTimeOff: async (req, res, next) => {
        try {
            const businessId = await assertAdminAccess(req);
            await resolveWorkerId(businessId, req);
            const timeOffId  = Number(req.params.timeOffId);
            if (isNaN(timeOffId)) throw ERRORS.VALIDATION('Time-off ID must be a number');

            const { status, note, start_date, end_date } = req.body;

            const validStatuses = ['pending', 'approved', 'rejected', 'cancelled'];
            if (status && !validStatuses.includes(status)) {
                throw ERRORS.VALIDATION(`status must be one of: ${validStatuses.join(', ')}`);
            }

            await EmployeeTimeOff.update(timeOffId, businessId, {
                status,
                note,
                start_date,
                end_date,
                approved_by: status === 'approved' ? req.session.userId : undefined
            });

            res.json({ success: true, message: 'Time-off record updated' });
        } catch (err) { next(err); }
    },

    /**
     * DELETE /api/v1/business/:id/team/:userId/time-off/:timeOffId
     * Hard deletes a time-off record.
     * Use the PATCH endpoint to cancel instead if you want an audit trail.
     * Requires admin/owner.
     */
    deleteTimeOff: async (req, res, next) => {
        try {
            const businessId = await assertAdminAccess(req);
            await resolveWorkerId(businessId, req);
            const timeOffId  = Number(req.params.timeOffId);
            if (isNaN(timeOffId)) throw ERRORS.VALIDATION('Time-off ID must be a number');

            await EmployeeTimeOff.delete(timeOffId, businessId);
            res.json({ success: true, message: 'Time-off record deleted' });
        } catch (err) { next(err); }
    },

    // ── Computed Availability ─────────────────────────────────────────────────

    /**
     * GET /api/v1/business/:id/team/:userId/availability?date=YYYY-MM-DD&service_id=N
     * Returns computed available time slots for a worker on a specific date.
     * Used by the admin calendar (internal) to preview worker availability.
     */
    getAvailability: async (req, res, next) => {
        try {
            const businessId = await assertMemberAccess(req);
            const workerId   = await resolveWorkerId(businessId, req);

            const { date, service_id } = req.query;

            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                throw ERRORS.VALIDATION('date query param must be YYYY-MM-DD');
            }
            if (!service_id || isNaN(Number(service_id))) {
                throw ERRORS.VALIDATION('service_id query param is required');
            }

            const slots = await AvailabilityService.getAvailableSlots(
                businessId, workerId, Number(service_id), date
            );

            // Also return the working window for admin calendar rendering
            const window = await AvailabilityService.getWorkingWindow(businessId, workerId, date);

            res.json({
                success: true,
                data: {
                    date,
                    worker_id: workerId,
                    working_window: window,
                    slots
                }
            });
        } catch (err) { next(err); }
    },

    /**
     * GET /api/v1/business/:id/team/:userId/schedule/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
     * Returns a summary of schedule, exceptions, and time-off for a date range.
     * Used by the admin weekly calendar view.
     */
    getScheduleOverview: async (req, res, next) => {
        try {
            const businessId = await assertMemberAccess(req);
            const workerId   = await resolveWorkerId(businessId, req);

            const { from, to } = req.query;
            if (!from || !to) throw ERRORS.VALIDATION('from and to query params are required (YYYY-MM-DD)');
            if (from > to) throw ERRORS.VALIDATION('from must be before to');

            // Limit range to 90 days to prevent runaway queries
            const daysDiff = Math.ceil((new Date(to) - new Date(from)) / 86400000);
            if (daysDiff > 90) throw ERRORS.VALIDATION('Date range cannot exceed 90 days');

            const [schedule, exceptions, timeOff] = await Promise.all([
                EmployeeSchedule.findByWorker(businessId, workerId),
                EmployeeScheduleException.findByWorker(businessId, workerId, { fromDate: from, toDate: to }),
                EmployeeTimeOff.findByWorker(businessId, workerId, { fromDate: from, toDate: to })
            ]);

            res.json({
                success: true,
                data: {
                    worker_id: workerId,
                    range: { from, to },
                    schedule,
                    exceptions,
                    time_off: timeOff
                }
            });
        } catch (err) { next(err); }
    },
};

// ── Private Helpers ────────────────────────────────────────────────────────────

function _validateBreaks(breaks) {
    if (!breaks || breaks.length === 0) return;
    for (const br of breaks) {
        if (!br.start_time || !br.end_time) {
            throw ERRORS.VALIDATION('Each break must have start_time and end_time');
        }
        if (br.start_time >= br.end_time) {
            throw ERRORS.VALIDATION('Break start_time must be before end_time');
        }
    }
}

async function _getScheduleRowOrThrow(scheduleId, businessId) {
    const pool = (await import('../../config/database.js')).default;
    const [rows] = await pool.query(
        'SELECT * FROM employee_schedules WHERE id = ? AND business_id = ?',
        [scheduleId, businessId]
    );
    if (rows.length === 0) throw ERRORS.NOT_FOUND('Schedule row not found');
    return rows[0];
}

/**
 * Finds future scheduled appointments for the worker on a specific date that
 * would fall outside the proposed exception window.
 */
async function _detectExceptionConflicts(businessId, workerId, date, newStart, newEnd, isDayOff) {
    const pool = (await import('../../config/database.js')).default;
    const [rows] = await pool.query(
        `SELECT a.id, a.appointment_datetime, s.duration_minutes,
                c.name AS client_name
         FROM appointment a
         JOIN services s ON a.service_id = s.id
         LEFT JOIN clients c ON a.client_id = c.id
         WHERE a.business_id = ?
           AND a.assigned_to_user_id = ?
           AND DATE(a.appointment_datetime) = ?
           AND a.status = 'scheduled'
           AND a.deleted_at IS NULL
           AND (
             ? = 1
             OR TIME(a.appointment_datetime) < ?
             OR ADDTIME(TIME(a.appointment_datetime), SEC_TO_TIME(s.duration_minutes * 60)) > ?
           )`,
        [businessId, workerId, date,
         isDayOff ? 1 : 0,
         isDayOff ? '00:00:00' : (newStart || '00:00:00'),
         isDayOff ? '23:59:59' : (newEnd   || '23:59:59')]
    );
    return rows.map(r => ({
        appointmentId:       r.id,
        appointmentDatetime: r.appointment_datetime,
        clientName:          r.client_name,
        message:             `This appointment is now outside the new schedule for ${date}`
    }));
}

/**
 * Finds future scheduled appointments that fall within a proposed time-off range.
 */
async function _detectTimeOffConflicts(businessId, workerId, startDate, endDate) {
    const pool = (await import('../../config/database.js')).default;
    const [rows] = await pool.query(
        `SELECT a.id, a.appointment_datetime, s.name AS service_name, c.name AS client_name
         FROM appointment a
         JOIN services s ON a.service_id = s.id
         LEFT JOIN clients c ON a.client_id = c.id
         WHERE a.business_id = ?
           AND a.assigned_to_user_id = ?
           AND DATE(a.appointment_datetime) BETWEEN ? AND ?
           AND a.status = 'scheduled'
           AND a.deleted_at IS NULL`,
        [businessId, workerId, startDate, endDate]
    );
    return rows.map(r => ({
        appointmentId:       r.id,
        appointmentDatetime: r.appointment_datetime,
        serviceName:         r.service_name,
        clientName:          r.client_name,
        message:             'This appointment falls within the time-off period and may need to be rescheduled'
    }));
}

export default ScheduleController;
