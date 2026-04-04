import pool from '../config/database.js';
import BusinessHour from '../models/BusinessHour.js';
import EmployeeSchedule from '../models/EmployeeSchedule.js';
import EmployeeScheduleException from '../models/EmployeeScheduleException.js';
import EmployeeTimeOff from '../models/EmployeeTimeOff.js';

// Slot generation interval. A finer granularity can be configured per-business in the future.
const SLOT_INTERVAL_MINUTES = 15;

// How far ahead of "now" a same-day slot must start to be bookable.
const BOOKING_LEAD_MINUTES = 30;

/**
 * AvailabilityService — the single source of truth for all availability logic.
 *
 * This service is called by:
 *   - publicBookingController.getAvailability()
 *   - appointmentController.create()        (via validateSlot)
 *   - publicBookingController.createBooking() (via validateSlot)
 *
 * Never duplicate this logic in a controller. If you find yourself writing
 * time-window logic in a controller, it belongs here.
 */
const AvailabilityService = {

    /**
     * Get the working window for an employee on a specific date.
     *
     * Priority chain (first match wins):
     *   1. Time-off (approved) → unavailable, return null
     *   2. Schedule exception for this date → use exception times
     *   3. Recurring weekly schedule → use schedule times
     *   4. No schedule exists → fall back to business hours
     *   5. Business closed this day → return null
     *
     * The resulting window is clamped to business hours even if the
     * employee schedule extends outside them.
     *
     * @param {number} businessId
     * @param {number} workerId
     * @param {string} date        YYYY-MM-DD in business local timezone
     * @returns {{ start: string, end: string, breaks: {start:string,end:string}[] } | null}
     *          null means the worker is definitively unavailable on this date.
     */
    getWorkingWindow: async (businessId, workerId, date) => {
        // ── LAYER 1: Time-off ────────────────────────────────────────────────
        const timeOff = await EmployeeTimeOff.findForDate(businessId, workerId, date);
        if (timeOff) return null;

        // ── LAYER 2: Business hours for this day ─────────────────────────────
        // Fetch early so we can clamp and short-circuit on closed days.
        const bizHours = await BusinessHour.getByBusinessId(businessId);
        const isoDay = _isoDay(date);
        const dayHours = bizHours.find(h => h.day_of_week === isoDay);

        if (!dayHours || dayHours.is_closed) return null;

        const bizStart = dayHours.open_time.substring(0, 5);   // HH:mm
        const bizEnd   = dayHours.close_time.substring(0, 5);

        // ── LAYER 3: Exception for this date ─────────────────────────────────
        const exception = await EmployeeScheduleException.findForDate(businessId, workerId, date);
        if (exception) {
            if (exception.is_day_off) return null;
            return _buildWindow(
                exception.start_time.substring(0, 5),
                exception.end_time.substring(0, 5),
                exception.breaks || [],
                bizStart,
                bizEnd
            );
        }

        // ── LAYER 4: Recurring schedule ───────────────────────────────────────
        const schedule = await EmployeeSchedule.findForDate(businessId, workerId, date);
        if (schedule) {
            if (schedule.is_day_off) return null;
            return _buildWindow(
                schedule.start_time.substring(0, 5),
                schedule.end_time.substring(0, 5),
                schedule.breaks || [],
                bizStart,
                bizEnd
            );
        }

        // ── LAYER 5: Fallback to business hours ───────────────────────────────
        // No schedule configured for this employee = they work all business hours.
        return { start: bizStart, end: bizEnd, breaks: [] };
    },

    /**
     * Generate all bookable time slots for a worker on a specific date.
     *
     * Steps:
     *   1. Get working window (handles all priority layers)
     *   2. Build available intervals from the window (subtract breaks)
     *   3. Subtract manually blocked times (future: employee_blocked_times table)
     *   4. Subtract existing appointments
     *   5. Generate slots at SLOT_INTERVAL_MINUTES cadence within remaining intervals
     *   6. Skip past slots (same-day with lead-time buffer)
     *
     * @param {number} businessId
     * @param {number} workerId
     * @param {number} serviceId
     * @param {string} date       YYYY-MM-DD
     * @returns {{ time: string, worker_id: number }[]}
     */
    getAvailableSlots: async (businessId, workerId, serviceId, date) => {
        const window = await AvailabilityService.getWorkingWindow(businessId, workerId, date);
        if (!window) return [];

        // Get service duration
        const [serviceRows] = await pool.query(
            'SELECT duration_minutes FROM services WHERE id = ? AND business_id = ? AND is_active = 1',
            [serviceId, businessId]
        );
        if (serviceRows.length === 0) return [];
        const duration = serviceRows[0].duration_minutes;

        // Build initial interval list from working window
        let intervals = [{ start: window.start, end: window.end }];

        // Subtract all breaks
        for (const br of window.breaks) {
            intervals = subtractInterval(intervals, br.start_time.substring(0, 5), br.end_time.substring(0, 5));
        }

        // Subtract existing appointments for this worker on this date
        const [appointments] = await pool.query(
            `SELECT a.appointment_datetime, s.duration_minutes
             FROM appointment a
             JOIN services s ON a.service_id = s.id
             WHERE a.assigned_to_user_id = ?
               AND DATE(a.appointment_datetime) = ?
               AND a.status != 'cancelled'
               AND a.deleted_at IS NULL`,
            [workerId, date]
        );

        for (const apt of appointments) {
            const aptStart = _timeStr(apt.appointment_datetime);
            const aptEnd   = _addMinutes(aptStart, apt.duration_minutes);
            intervals = subtractInterval(intervals, aptStart, aptEnd);
        }

        // Fetch optional per-business buffer between appointments
        const [bizRows] = await pool.query(
            'SELECT booking_buffer_minutes FROM business WHERE id = ?',
            [businessId]
        );
        const buffer = bizRows[0]?.booking_buffer_minutes || 0;

        // Generate slots
        const slots = [];
        const now = new Date();
        const isToday = new Date(date + 'T00:00:00').toDateString() === now.toDateString();

        for (const interval of intervals) {
            let cursor = interval.start;

            while (_addMinutes(cursor, duration + buffer) <= interval.end) {
                // Skip past slots when booking same-day
                if (isToday) {
                    const slotDateTime = new Date(`${date}T${cursor}:00`);
                    const cutoff = new Date(now.getTime() + BOOKING_LEAD_MINUTES * 60000);
                    if (slotDateTime < cutoff) {
                        cursor = _addMinutes(cursor, SLOT_INTERVAL_MINUTES);
                        continue;
                    }
                }

                slots.push({ time: cursor, worker_id: workerId });
                cursor = _addMinutes(cursor, SLOT_INTERVAL_MINUTES);
            }
        }

        return slots;
    },

    /**
     * Get boolean availability for a range of dates.
     * Useful for calendar strips where we only need to know "is this day bookable at all?".
     * @param {number} businessId
     * @param {number} serviceId
     * @param {string} startDate  YYYY-MM-DD
     * @param {string} endDate    YYYY-MM-DD
     * @returns {Record<string, boolean>} e.g. { "2026-03-27": true, "2026-03-28": false }
     */
    getAvailabilityRange: async (businessId, serviceId, startDate, endDate) => {
        // Get team members
        const [team] = await pool.query(
            `SELECT u.id 
             FROM user u 
             JOIN user_business ub ON u.id = ub.user_id 
             WHERE ub.business_id = ?`,
            [businessId]
        );

        const startObj = new Date(startDate + 'T00:00:00');
        const endObj = new Date(endDate + 'T00:00:00');
        
        // Safety check to prevent huge ranges
        const diffDays = Math.ceil((endObj - startObj) / (1000 * 60 * 60 * 24));
        if (diffDays > 60 || diffDays < 0) return {};

        const result = {};
        for (let d = new Date(startObj); d <= endObj; d.setDate(d.getDate() + 1)) {
            // format locally to avoid UTC timezone shifts
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            
            let isAvailable = false;
            
            for (const worker of team) {
                const slots = await AvailabilityService.getAvailableSlots(businessId, worker.id, serviceId, dateStr);
                if (slots && slots.length > 0) {
                    isAvailable = true;
                    break; // short-circuit: we only need to know if AT LEAST ONE slot exists
                }
            }
            result[dateStr] = isAvailable;
        }

        return result;
    },

    /**
     * Validate whether a specific datetime slot is bookable for a worker+service.
     * Must be called INSIDE a database transaction for race-condition safety.
     *
     * @param {number} businessId
     * @param {number} workerId
     * @param {number} serviceId
     * @param {string} datetime   ISO datetime string (YYYY-MM-DDTHH:mm:ss or similar)
     * @param {object} [conn]     Optional transaction connection for the overlap check
     * @returns {{ valid: boolean, reason?: string }}
     */
    validateSlot: async (businessId, workerId, serviceId, datetime, conn = null) => {
        const db = conn || pool;

        const aptDate = new Date(datetime);
        if (isNaN(aptDate.getTime())) {
            return { valid: false, reason: 'Invalid datetime format' };
        }

        const date = aptDate.toISOString().slice(0, 10);
        const timeStr = _timeStr(aptDate);

        // Get service duration
        const [svcRows] = await db.query(
            'SELECT duration_minutes FROM services WHERE id = ? AND business_id = ? AND is_active = 1',
            [serviceId, businessId]
        );
        if (svcRows.length === 0) return { valid: false, reason: 'Service not found or inactive' };
        const duration = svcRows[0].duration_minutes;

        const aptEndStr = _addMinutes(timeStr, duration);

        // Get working window
        const window = await AvailabilityService.getWorkingWindow(businessId, workerId, date);
        if (!window) {
            return { valid: false, reason: 'Worker is unavailable on this date' };
        }

        // Check slot fits within working window
        if (timeStr < window.start || aptEndStr > window.end) {
            return {
                valid: false,
                reason: `Slot ${timeStr}–${aptEndStr} falls outside worker's schedule (${window.start}–${window.end})`
            };
        }

        // Check slot doesn't overlap any break
        for (const br of window.breaks) {
            const brStart = br.start_time.substring(0, 5);
            const brEnd   = br.end_time.substring(0, 5);
            if (timeStr < brEnd && aptEndStr > brStart) {
                return {
                    valid: false,
                    reason: `Slot overlaps with worker's break (${brStart}–${brEnd})`
                };
            }
        }

        // Final overlap check against existing appointments
        // Using SELECT FOR UPDATE when inside a transaction to prevent race conditions
        const lockHint = conn ? 'FOR UPDATE' : '';
        const [overlap] = await db.query(
            `SELECT a.id
             FROM appointment a
             JOIN services s ON a.service_id = s.id
             WHERE a.assigned_to_user_id = ?
               AND a.status = 'scheduled'
               AND a.deleted_at IS NULL
               AND (
                 ? < DATE_ADD(a.appointment_datetime, INTERVAL s.duration_minutes MINUTE)
                 AND DATE_ADD(?, INTERVAL ? MINUTE) > a.appointment_datetime
               )
             ${lockHint}`,
            [workerId, datetime, datetime, duration]
        );

        if (overlap.length > 0) {
            return { valid: false, reason: 'Worker already has an appointment at this time' };
        }

        return { valid: true };
    },
};

/**
 * Subtract a time interval [removeStart, removeEnd] from an array of
 * non-overlapping intervals [{start, end}, ...].
 *
 * Returns a new array — does not mutate the input.
 * All times are HH:mm strings (24h).
 *
 * This is a pure function and is exported for unit testing.
 */
export function subtractInterval(intervals, removeStart, removeEnd) {
    if (removeStart >= removeEnd) return intervals;

    const result = [];
    for (const iv of intervals) {
        if (removeEnd <= iv.start || removeStart >= iv.end) {
            // No overlap — keep the interval whole
            result.push(iv);
        } else {
            // Left piece: [iv.start, removeStart) — only if it has length
            if (iv.start < removeStart) {
                result.push({ start: iv.start, end: removeStart });
            }
            // Right piece: (removeEnd, iv.end] — only if it has length
            if (removeEnd < iv.end) {
                result.push({ start: removeEnd, end: iv.end });
            }
            // If neither piece exists the interval is fully consumed — nothing pushed.
        }
    }
    return result;
}

// ── Private Helpers ────────────────────────────────────────────────────────────

/**
 * Build a window object, clamping employee times to business hours.
 * Also clips breaks to the clamped window.
 */
function _buildWindow(empStart, empEnd, breaks, bizStart, bizEnd) {
    const start = empStart > bizStart ? empStart : bizStart;
    const end   = empEnd   < bizEnd   ? empEnd   : bizEnd;

    if (start >= end) return null;  // Schedule is entirely outside business hours

    // Only include breaks that fall within the effective window
    const clippedBreaks = breaks.filter(br => {
        const bs = br.start_time.substring(0, 5);
        const be = br.end_time.substring(0, 5);
        return bs < end && be > start;
    });

    return { start, end, breaks: clippedBreaks };
}

/**
 * Convert a JS Date or datetime string to HH:mm string.
 */
function _timeStr(datetimeOrDate) {
    const d = datetimeOrDate instanceof Date ? datetimeOrDate : new Date(datetimeOrDate);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

/**
 * Add minutes to a HH:mm string, returns HH:mm string.
 * Does not support crossing midnight (night shifts are out of scope for MVP).
 */
function _addMinutes(timeStr, minutes) {
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + minutes;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Get the ISO day of week (1=Monday ... 7=Sunday) from a YYYY-MM-DD string.
 */
function _isoDay(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const jsDay = d.getDay(); // 0=Sun
    return jsDay === 0 ? 7 : jsDay;
}

export default AvailabilityService;
