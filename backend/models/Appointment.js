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

    create: async (data) => {
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

            const [result] = await pool.query(sql, params);
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
