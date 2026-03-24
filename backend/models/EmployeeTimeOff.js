import pool from '../config/database.js';
import { ERRORS } from '../utils/errors.js';

/**
 * EmployeeTimeOff model — multi-day leave records.
 *
 * A time-off record with status='approved' blocks all availability
 * for the employee across its date range. It takes priority over
 * everything else in the availability engine.
 */
const EmployeeTimeOff = {

    /**
     * Fetch all time-off records for one worker in one business.
     * Optionally filtered to records overlapping a date range.
     */
    findByWorker: async (businessId, userId, { fromDate, toDate } = {}) => {
        let sql = `
            SELECT * FROM employee_time_off
            WHERE business_id = ? AND user_id = ?
        `;
        const params = [businessId, userId];

        if (fromDate && toDate) {
            // Find records that overlap with [fromDate, toDate]
            sql += ' AND start_date <= ? AND end_date >= ?';
            params.push(toDate, fromDate);
        }

        sql += ' ORDER BY start_date ASC';
        const [rows] = await pool.query(sql, params);
        return rows;
    },

    /**
     * Check if a worker is on approved leave on a specific date.
     * Returns the matching time-off record, or null.
     * This is optimally indexed on (business_id, user_id, start_date, end_date).
     */
    findForDate: async (businessId, userId, date) => {
        const [rows] = await pool.query(
            `SELECT * FROM employee_time_off
             WHERE business_id = ?
               AND user_id     = ?
               AND status      = 'approved'
               AND start_date  <= ?
               AND end_date    >= ?
             LIMIT 1`,
            [businessId, userId, date, date]
        );
        return rows[0] || null;
    },

    /**
     * Find a single time-off record by ID.
     */
    findById: async (id, businessId) => {
        const [rows] = await pool.query(
            'SELECT * FROM employee_time_off WHERE id = ? AND business_id = ?',
            [id, businessId]
        );
        return rows[0] || null;
    },

    /**
     * Create a new time-off record.
     */
    create: async (data) => {
        const {
            business_id,
            user_id,
            start_date,
            end_date,
            type = 'vacation',
            status = 'approved',
            note = null,
            approved_by = null
        } = data;

        if (!business_id || !user_id) throw ERRORS.VALIDATION('business_id and user_id are required');
        if (!start_date || !end_date) throw ERRORS.VALIDATION('start_date and end_date are required');
        if (start_date > end_date) throw ERRORS.VALIDATION('start_date must be on or before end_date');

        const validTypes = ['vacation', 'sick_leave', 'personal', 'other'];
        if (!validTypes.includes(type)) throw ERRORS.VALIDATION(`type must be one of: ${validTypes.join(', ')}`);

        const [result] = await pool.query(
            `INSERT INTO employee_time_off
                (business_id, user_id, start_date, end_date, type, status, note, approved_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [business_id, user_id, start_date, end_date, type, status, note, approved_by]
        );
        return result.insertId;
    },

    /**
     * Update status or dates of an existing time-off record.
     */
    update: async (id, businessId, data) => {
        const { status, note, start_date, end_date, approved_by } = data;

        const [existing] = await pool.query(
            'SELECT * FROM employee_time_off WHERE id = ? AND business_id = ?',
            [id, businessId]
        );
        if (existing.length === 0) throw ERRORS.NOT_FOUND('Time-off record not found');

        const row = existing[0];
        const finalStart = start_date || row.start_date;
        const finalEnd   = end_date   || row.end_date;

        if (finalStart > finalEnd) throw ERRORS.VALIDATION('start_date must be on or before end_date');

        const updates = [];
        const params  = [];

        if (status      !== undefined) { updates.push('status = ?');      params.push(status); }
        if (note        !== undefined) { updates.push('note = ?');        params.push(note); }
        if (start_date  !== undefined) { updates.push('start_date = ?');  params.push(start_date); }
        if (end_date    !== undefined) { updates.push('end_date = ?');    params.push(end_date); }
        if (approved_by !== undefined) { updates.push('approved_by = ?'); params.push(approved_by); }

        if (updates.length === 0) return true;

        updates.push('updated_at = NOW()');
        params.push(id, businessId);

        await pool.query(
            `UPDATE employee_time_off SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`,
            params
        );
        return true;
    },

    /**
     * Cancel a time-off record (soft cancel via status, not hard delete).
     * Hard delete is also supported if needed for admin cleanup.
     */
    cancel: async (id, businessId) => {
        const [result] = await pool.query(
            `UPDATE employee_time_off SET status = 'cancelled', updated_at = NOW()
             WHERE id = ? AND business_id = ?`,
            [id, businessId]
        );
        if (result.affectedRows === 0) throw ERRORS.NOT_FOUND('Time-off record not found');
        return true;
    },

    delete: async (id, businessId) => {
        const [result] = await pool.query(
            'DELETE FROM employee_time_off WHERE id = ? AND business_id = ?',
            [id, businessId]
        );
        if (result.affectedRows === 0) throw ERRORS.NOT_FOUND('Time-off record not found');
        return true;
    },
};

export default EmployeeTimeOff;
