import pool from '../config/database.js';
import { ERRORS } from '../utils/errors.js';

const Appointment = {
    findById: async (id) => {
        const sql = 'SELECT * FROM appointment WHERE id = ?';
        const [rows] = await pool.query(sql, [id]);
        return rows[0];
    },

    findAll: async (businessId, date) => {
        let sql = 'SELECT * FROM appointment WHERE business_id = ? AND deleted_at IS NULL';
        const params = [businessId];

        if (date) {
            sql += ' AND DATE(appointment_datetime) = ?';
            params.push(date);
        }

        sql += ' ORDER BY appointment_datetime ASC';
        const [rows] = await pool.query(sql, params);
        return rows;
    },

    checkOverlap: async (assignedToUserId, startDatetime, durationMinutes) => {
        try {
            // Checks for any overlap between requested time block and existing scheduled appointments for the given user.
            const sql = `
                SELECT a.id 
                FROM appointment a
                JOIN services s ON a.service_id = s.id
                WHERE a.assigned_to_user_id = ?
                  AND a.status = 'scheduled'
                  AND a.deleted_at IS NULL
                  AND (
                      -- New Start inside Existing
                      ? >= a.appointment_datetime AND ? < DATE_ADD(a.appointment_datetime, INTERVAL s.duration_minutes MINUTE)
                      OR
                      -- New End inside Existing
                      DATE_ADD(?, INTERVAL ? MINUTE) > a.appointment_datetime AND DATE_ADD(?, INTERVAL ? MINUTE) <= DATE_ADD(a.appointment_datetime, INTERVAL s.duration_minutes MINUTE)
                      OR
                      -- New surrounds Existing completely
                      ? <= a.appointment_datetime AND DATE_ADD(?, INTERVAL ? MINUTE) >= DATE_ADD(a.appointment_datetime, INTERVAL s.duration_minutes MINUTE)
                  )
            `;
            const params = [
                assignedToUserId,
                startDatetime, startDatetime,
                startDatetime, durationMinutes, startDatetime, durationMinutes,
                startDatetime, startDatetime, durationMinutes
            ];
            
            const [rows] = await pool.query(sql, params);
            return rows.length > 0; // True if overlap exists
        } catch (error) {
            console.error('❌ Appointment.checkOverlap error:', error);
            throw ERRORS.DATABASE('Failed to check for appointment overlaps');
        }
    },

    create: async (data, transactionConnection = null) => {
        try {
            const {
                business_id,
                client_id,
                service_id,
                assigned_to_user_id,
                name,
                phone,
                appointment_datetime,
                user_id,
                status,
                notes
            } = data;

            const sql = `
                INSERT INTO appointment (
                    business_id, client_id, service_id, assigned_to_user_id, 
                    name, phone, appointment_datetime, user_id, status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                business_id || null,
                client_id || null,
                service_id || null,
                assigned_to_user_id || null,
                name || null,
                phone || null,
                appointment_datetime || null,
                user_id || null,
                status || 'scheduled',
                notes || null
            ];

            const db = transactionConnection || pool;
            const [result] = await db.query(sql, params);
            return result.insertId;
        } catch (error) {
            console.error('❌ Appointment.create error:', error);
            throw error;
        }
    },

    update: async (id, data) => {
        const fields = Object.keys(data).filter(key => data[key] !== undefined);
        if (fields.length === 0) return false;

        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const params = [...fields.map(field => data[field]), id];

        const sql = `UPDATE appointment SET ${setClause} WHERE id = ?`;
        const [result] = await pool.query(sql, params);
        return result.affectedRows > 0;
    },

    delete: async (id) => {
        const sql = 'UPDATE appointment SET deleted_at = NOW() WHERE id = ?';
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows > 0;
    }
};

export default Appointment;
