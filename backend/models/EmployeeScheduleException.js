import pool from '../config/database.js';
import { ERRORS } from '../utils/errors.js';

/**
 * EmployeeScheduleException model — single-date schedule overrides.
 *
 * When a row exists for a (business, user, date), it completely replaces
 * the recurring schedule for that date. This handles shift swaps,
 * special hours, one-off changes, and admin-forced overrides.
 */
const EmployeeScheduleException = {

    /**
     * Fetch all exceptions for one worker in one business.
     * Optionally filter to a date range for the admin calendar view.
     */
    findByWorker: async (businessId, userId, { fromDate, toDate } = {}) => {
        if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
        let sql = `
            SELECT ese.*,
                   JSON_ARRAYAGG(
                       IF(eb.id IS NULL, NULL,
                          JSON_OBJECT('id', eb.id, 'start_time', eb.start_time,
                                      'end_time', eb.end_time, 'label', eb.label))
                   ) AS breaks_raw
            FROM employee_schedule_exceptions ese
            LEFT JOIN exception_breaks eb ON eb.exception_id = ese.id
            WHERE ese.business_id = ? AND ese.user_id = ?
        `;
        const params = [businessId, userId];

        if (fromDate) { sql += ' AND ese.exception_date >= ?'; params.push(fromDate); }
        if (toDate)   { sql += ' AND ese.exception_date <= ?'; params.push(toDate); }

        sql += ' GROUP BY ese.id ORDER BY ese.exception_date ASC';

        const [rows] = await pool.query(sql, params);
        return rows.map(_parseBreaks);
    },

    /**
     * Find the exception row for a specific employee on a specific date.
     * Returns null if none exists.
     * The UNIQUE constraint on (business_id, user_id, exception_date) ensures at most one row.
     */
    findForDate: async (businessId, userId, date) => {
        if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
        const [rows] = await pool.query(
            `SELECT ese.*
             FROM employee_schedule_exceptions ese
             WHERE ese.business_id = ? AND ese.user_id = ? AND ese.exception_date = ?
             LIMIT 1`,
            [businessId, userId, date]
        );
        if (rows.length === 0) return null;

        const exc = rows[0];
        const [breaks] = await pool.query(
            'SELECT id, start_time, end_time, label FROM exception_breaks WHERE exception_id = ? ORDER BY start_time ASC',
            [exc.id]
        );
        exc.breaks = breaks;
        return exc;
    },

    /**
     * Create an exception for a specific date.
     * Replaces any existing exception for that date (UPSERT semantics via unique key conflict).
     */
    create: async (data) => {
        const {
            business_id,
            user_id,
            exception_date,
            is_day_off = 0,
            start_time = null,
            end_time = null,
            reason = null,
            created_by = null,
            breaks = []
        } = data;

        if (!business_id || !user_id || !exception_date) {
            throw ERRORS.VALIDATION('business_id, user_id, and exception_date are required');
        }
        if (isNaN(Number(business_id))) throw ERRORS.VALIDATION('business_id must be a number');
        if (!is_day_off && (!start_time || !end_time)) {
            throw ERRORS.VALIDATION('start_time and end_time are required when is_day_off=0');
        }
        if (!is_day_off && start_time >= end_time) {
            throw ERRORS.VALIDATION('start_time must be before end_time');
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // Delete existing exception for this date if it exists (replace semantics)
            await conn.query(
                'DELETE FROM employee_schedule_exceptions WHERE business_id = ? AND user_id = ? AND exception_date = ?',
                [business_id, user_id, exception_date]
            );

            const [result] = await conn.query(
                `INSERT INTO employee_schedule_exceptions
                    (business_id, user_id, exception_date, is_day_off, start_time, end_time, reason, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [business_id, user_id, exception_date,
                 is_day_off ? 1 : 0,
                 is_day_off ? null : start_time,
                 is_day_off ? null : end_time,
                 reason, created_by]
            );
            const exceptionId = result.insertId;

            if (breaks.length > 0) {
                const values = breaks.map(b => [exceptionId, b.start_time, b.end_time, b.label || null]);
                await conn.query(
                    'INSERT INTO exception_breaks (exception_id, start_time, end_time, label) VALUES ?',
                    [values]
                );
            }

            await conn.commit();
            return exceptionId;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },

    /**
     * Update an existing exception by its ID.
     */
    update: async (id, businessId, data) => {
        if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
        const {
            is_day_off = 0,
            start_time = null,
            end_time = null,
            reason = null,
            breaks = []
        } = data;

        if (!is_day_off && start_time >= end_time) {
            throw ERRORS.VALIDATION('start_time must be before end_time');
        }

        const [existing] = await pool.query(
            'SELECT id FROM employee_schedule_exceptions WHERE id = ? AND business_id = ?',
            [id, businessId]
        );
        if (existing.length === 0) throw ERRORS.NOT_FOUND('Exception not found');

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.query(
                `UPDATE employee_schedule_exceptions
                 SET is_day_off = ?, start_time = ?, end_time = ?, reason = ?
                 WHERE id = ? AND business_id = ?`,
                [is_day_off ? 1 : 0,
                 is_day_off ? null : start_time,
                 is_day_off ? null : end_time,
                 reason, id, businessId]
            );

            await conn.query('DELETE FROM exception_breaks WHERE exception_id = ?', [id]);
            if (breaks.length > 0) {
                const values = breaks.map(b => [id, b.start_time, b.end_time, b.label || null]);
                await conn.query(
                    'INSERT INTO exception_breaks (exception_id, start_time, end_time, label) VALUES ?',
                    [values]
                );
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
     * Delete an exception by ID. FK CASCADE removes its breaks.
     */
    delete: async (id, businessId) => {
        if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
        const [result] = await pool.query(
            'DELETE FROM employee_schedule_exceptions WHERE id = ? AND business_id = ?',
            [id, businessId]
        );
        if (result.affectedRows === 0) throw ERRORS.NOT_FOUND('Exception not found');
        return true;
    },
};

function _parseBreaks(row) {
    try {
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

export default EmployeeScheduleException;
