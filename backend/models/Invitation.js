import pool from '../config/database.js';
import crypto from 'crypto';
import { ERRORS } from '../utils/errors.js';

const Invitation = {
    /**
     * Create a permanent invitation for a business.
     * Generates a unique token for URLs and a readable code for manual entry.
     */
    createPermanent: async ({ businessId, createdBy, role = 'employee' }) => {
        try {
            const token = crypto.randomBytes(32).toString('hex');
            
            // Generate a unique readable code: ABC-12345
            let code;
            let isUnique = false;
            while (!isUnique) {
                const letters = crypto.randomBytes(3).toString('hex').substring(0, 3).toUpperCase();
                const numbers = Math.floor(10000 + Math.random() * 90000);
                code = `${letters}-${numbers}`;
                
                const [existing] = await pool.query('SELECT id FROM invitations WHERE code = ?', [code]);
                if (existing.length === 0) {
                    isUnique = true;
                }
            }

            const sql = `
                INSERT INTO invitations (business_id, token, code, role, created_by)
                VALUES (?, ?, ?, ?, ?)
            `;
            const [result] = await pool.query(sql, [businessId, token, code, role, createdBy]);
            
            return {
                id: result.insertId,
                token,
                code,
                role
            };
        } catch (error) {
            console.error('❌ Invitation.createPermanent error:', error);
            throw ERRORS.DATABASE(`Failed to create invitation: ${error.message}`);
        }
    },

    findByToken: async (token) => {
        try {
            const sql = 'SELECT * FROM invitations WHERE token = ? AND is_active = 1 LIMIT 1';
            const [rows] = await pool.query(sql, [token]);
            return rows[0];
        } catch (error) {
            throw ERRORS.DATABASE(`Failed to find invitation by token: ${error.message}`);
        }
    },

    findByCode: async (code) => {
        try {
            const sql = `
                SELECT i.*, b.name as business_name 
                FROM invitations i
                JOIN business b ON i.business_id = b.id
                WHERE i.code = ? AND i.is_active = 1 LIMIT 1
            `;
            const [rows] = await pool.query(sql, [code]);
            return rows[0];
        } catch (error) {
            throw ERRORS.DATABASE(`Failed to find invitation by code: ${error.message}`);
        }
    },

    incrementUsedCount: async (id) => {
        try {
            const sql = 'UPDATE invitations SET used_count = used_count + 1 WHERE id = ?';
            await pool.query(sql, [id]);
            
            // Deactivate if max_uses is reached
            const [rows] = await pool.query('SELECT used_count, max_uses FROM invitations WHERE id = ?', [id]);
            const inv = rows[0];
            if (inv && inv.max_uses !== null && inv.used_count >= inv.max_uses) {
                await Invitation.deactivate(id);
            }
        } catch (error) {
            throw ERRORS.DATABASE(`Failed to update invitation usage: ${error.message}`);
        }
    },

    deactivate: async (id) => {
        try {
            const sql = 'UPDATE invitations SET is_active = 0 WHERE id = ?';
            await pool.query(sql, [id]);
        } catch (error) {
            throw ERRORS.DATABASE(`Failed to deactivate invitation: ${error.message}`);
        }
    }
};

export default Invitation;
