import pool from '../config/database.js';
import { ERRORS } from '../utils/errors.js';

/**
 * EmployeeSchedule model — recurring weekly schedule rules.
 *
 * A schedule row defines when an employee works on a given day of the week.
 * Multiple versioned rows for the same (business, user, day_of_week) are allowed
 * as long as their effective date ranges don't overlap. The most recently
 * effective row (highest effective_from <= target date) wins.
 */
const EmployeeSchedule = {

    /**
     * Find all schedule rows for one employee in one business.
     * Includes associated breaks. Used for admin schedule management UI.
     */
    findByWorker: async (businessId, userId) => {
        if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
        const [rows] = await pool.query(
            `SELECT es.*,
                    JSON_ARRAYAGG(
                        IF(eb.id IS NULL, NULL,
                           JSON_OBJECT('id', eb.id, 'start_time', eb.start_time,
                                       'end_time', eb.end_time, 'label', eb.label))
                    ) AS breaks_raw
             FROM employee_schedules es
             LEFT JOIN employee_breaks eb ON eb.schedule_id = es.id
             WHERE es.business_id = ? AND es.user_id = ?
             GROUP BY es.id
             ORDER BY es.day_of_week ASC, es.effective_from ASC`,
            [businessId, userId]
        );
        return rows.map(_parseBreaks);
    },

    /**
     * Find the single applicable schedule row for an employee on a specific date.
     * Applies the versioning logic: most recent effective_from <= date wins.
     * Returns null if no schedule row exists (caller falls back to business hours).
     */
    findForDate: async (businessId, userId, date) => {
        if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
        // dayOfWeek: JS getDay() returns 0=Sun, we need 1=Mon...7=Sun (ISO)
        const d = new Date(date + 'T12:00:00');
        const jsDay = d.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;

        const [rows] = await pool.query(
            `SELECT es.*
             FROM employee_schedules es
             WHERE es.business_id = ?
               AND es.user_id    = ?
               AND es.day_of_week = ?
               AND (es.effective_from IS NULL OR es.effective_from <= ?)
               AND (es.effective_to   IS NULL OR es.effective_to   >= ?)
             ORDER BY es.effective_from DESC
             LIMIT 1`,
            [businessId, userId, isoDay, date, date]
        );

        if (rows.length === 0) return null;

        const schedule = rows[0];
        // Fetch breaks separately to avoid the GROUP BY / JSON_ARRAYAGG overhead
        schedule.breaks = await EmployeeSchedule._getBreaks(schedule.id);
        return schedule;
    },

    /**
     * Create a new schedule row.
     * Validates that a non-overlapping row doesn't already exist for the same
     * (business, user, day_of_week) in the given effective date range.
     */
    create: async (data) => {
        const {
            business_id,
            user_id,
            day_of_week,
            start_time,
            end_time,
            is_day_off = 0,
            effective_from = null,
            effective_to = null,
            breaks = []
        } = data;

        if (!business_id || !user_id) throw ERRORS.VALIDATION('business_id and user_id are required');
        if (isNaN(Number(business_id))) throw ERRORS.VALIDATION('business_id must be a number');
        if (day_of_week < 1 || day_of_week > 7) throw ERRORS.VALIDATION('day_of_week must be 1–7');
        if (!is_day_off && (!start_time || !end_time)) throw ERRORS.VALIDATION('start_time and end_time are required when is_day_off=0');
        if (!is_day_off && start_time >= end_time) throw ERRORS.VALIDATION('start_time must be before end_time');

        await EmployeeSchedule._assertNoOverlap(business_id, user_id, day_of_week, effective_from, effective_to, null);

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [result] = await conn.query(
                `INSERT INTO employee_schedules
                    (business_id, user_id, day_of_week, start_time, end_time, is_day_off, effective_from, effective_to)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [business_id, user_id, day_of_week,
                 is_day_off ? null : start_time,
                 is_day_off ? null : end_time,
                 is_day_off ? 1 : 0, effective_from, effective_to]
            );
            const scheduleId = result.insertId;

            if (breaks.length > 0) {
                await EmployeeSchedule._insertBreaks(conn, scheduleId, breaks);
            }

            await conn.commit();
            return scheduleId;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },

    /**
     * Replace a schedule row (update all fields + replace breaks).
     */
    update: async (id, businessId, data) => {
        if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
        const {
            start_time,
            end_time,
            is_day_off = 0,
            effective_from = null,
            effective_to = null,
            breaks = []
        } = data;

        const [existing] = await pool.query(
            'SELECT * FROM employee_schedules WHERE id = ? AND business_id = ?',
            [id, businessId]
        );
        if (existing.length === 0) throw ERRORS.NOT_FOUND('Schedule row not found');

        const row = existing[0];

        if (!is_day_off && start_time >= end_time) throw ERRORS.VALIDATION('start_time must be before end_time');

        await EmployeeSchedule._assertNoOverlap(
            row.business_id, row.user_id, row.day_of_week,
            effective_from, effective_to, id
        );

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.query(
                `UPDATE employee_schedules
                 SET start_time = ?, end_time = ?, is_day_off = ?,
                     effective_from = ?, effective_to = ?, updated_at = NOW()
                 WHERE id = ? AND business_id = ?`,
                [is_day_off ? null : start_time, is_day_off ? null : end_time,
                 is_day_off ? 1 : 0, effective_from, effective_to, id, businessId]
            );

            // Replace breaks atomically
            await conn.query('DELETE FROM employee_breaks WHERE schedule_id = ?', [id]);
            if (breaks.length > 0) {
                await EmployeeSchedule._insertBreaks(conn, id, breaks);
            }

            await conn.commit();
            return true;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },

    /**
     * Delete a schedule row and its breaks (FK CASCADE handles breaks).
     */
    delete: async (id, businessId) => {
        if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
        const [result] = await pool.query(
            'DELETE FROM employee_schedules WHERE id = ? AND business_id = ?',
            [id, businessId]
        );
        if (result.affectedRows === 0) throw ERRORS.NOT_FOUND('Schedule row not found');
        return true;
    },

    /**
     * Detect existing appointments that conflict with a proposed schedule
     * change for a worker on a given day of week.
     * Returns array of conflicting appointment rows.
     */
    detectConflicts: async (businessId, userId, dayOfWeek, newStartTime, newEndTime, newIsDayOff) => {
        if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
        // Only future + scheduled appointments matter
        const sql = `
            SELECT a.id, a.appointment_datetime, s.duration_minutes,
                   CONCAT(c.name) AS client_name
            FROM appointment a
            JOIN services s ON a.service_id = s.id
            LEFT JOIN clients c ON a.client_id = c.id
            WHERE a.business_id = ?
              AND a.assigned_to_user_id = ?
              AND a.status = 'scheduled'
              AND a.deleted_at IS NULL
              AND a.appointment_datetime >= NOW()
              AND DAYOFWEEK(a.appointment_datetime) = ?   -- MySQL: 1=Sun,2=Mon...7=Sat
              AND (
                ? = 1   -- new is_day_off=true → everything conflicts
                OR TIME(a.appointment_datetime) < ?          -- appointment starts before new shift start
                OR ADDTIME(TIME(a.appointment_datetime),
                           SEC_TO_TIME(s.duration_minutes * 60)) > ?  -- appointment ends after new shift end
              )
        `;
        // MySQL DAYOFWEEK: 1=Sunday, 2=Monday ... 7=Saturday
        // Our isoDay: 1=Monday ... 7=Sunday → convert
        const mysqlDay = dayOfWeek === 7 ? 1 : dayOfWeek + 1;

        const [rows] = await pool.query(sql, [
            businessId, userId, mysqlDay,
            newIsDayOff ? 1 : 0,
            newIsDayOff ? '00:00:00' : newStartTime,
            newIsDayOff ? '23:59:59' : newEndTime
        ]);
        return rows;
    },

    // ── Private Helpers ──────────────────────────────────────────────────────

    _getBreaks: async (scheduleId) => {
        const [rows] = await pool.query(
            'SELECT id, start_time, end_time, label FROM employee_breaks WHERE schedule_id = ? ORDER BY start_time ASC',
            [scheduleId]
        );
        return rows;
    },

    _insertBreaks: async (conn, scheduleId, breaks) => {
        const values = breaks.map(b => [scheduleId, b.start_time, b.end_time, b.label || null]);
        await conn.query(
            'INSERT INTO employee_breaks (schedule_id, start_time, end_time, label) VALUES ?',
            [values]
        );
    },

    /**
     * Ensures no existing schedule row for the same (business, user, day_of_week)
     * overlaps with the proposed effective date range.
     * excludeId: the row being updated (skip self-check).
     */
    _assertNoOverlap: async (businessId, userId, dayOfWeek, effectiveFrom, effectiveTo, excludeId) => {
        // Two date ranges [A_from, A_to] and [B_from, B_to] overlap unless:
        //   A_to < B_from  OR  A_from > B_to
        // NULL effective_from means -infinity (DATE('2000-01-01') as proxy).
        // NULL effective_to   means +infinity (DATE('2099-12-31') as proxy).
        //
        // Incoming range = [effectiveFrom, effectiveTo] (NULLs allowed)
        // Existing row    = [effective_from, effective_to] in DB
        // Overlap when NOT (incoming_to < row_from OR incoming_from > row_to)
        const newFrom = effectiveFrom || '2000-01-01';
        const newTo   = effectiveTo   || '2099-12-31';

        const [rows] = await pool.query(
            `SELECT id FROM employee_schedules
             WHERE business_id = ? AND user_id = ? AND day_of_week = ?
               AND id != COALESCE(?, -1)
               AND NOT (
                 ? < COALESCE(effective_from, '2000-01-01')
                 OR ? > COALESCE(effective_to, '2099-12-31')
               )`,
            [businessId, userId, dayOfWeek, excludeId, newTo, newFrom]
        );
        if (rows.length > 0) {
            throw ERRORS.CONFLICT('A schedule row for this day already exists in the overlapping date range');
        }
    },
};

function _parseBreaks(row) {
    try {
        // mysql2 may return JSON_ARRAYAGG as an already-parsed JS array
        // or as a JSON string — handle both cases.
        const raw = typeof row.breaks_raw === 'string'
            ? JSON.parse(row.breaks_raw || '[]')
            : (Array.isArray(row.breaks_raw) ? row.breaks_raw : []);
        row.breaks = raw.filter(Boolean);
    } catch {
        row.breaks = [];
    }
    delete row.breaks_raw;
    return row;
}

export default EmployeeSchedule;
