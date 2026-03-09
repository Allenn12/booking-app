import pool from '../config/database.js';
import { ERRORS } from '../utils/errors.js';

const Client = {
    /**
     * Find a client by exact phone match within a specific business.
     */
    findByPhone: async (businessId, phone) => {
        try {
            const sql = 'SELECT * FROM clients WHERE business_id = ? AND phone = ?';
            const [rows] = await pool.query(sql, [businessId, phone]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('❌ Client.findByPhone error:', error);
            throw ERRORS.DATABASE('Failed to fetch client by phone');
        }
    },

    /**
     * Create a new client, isolated by business_id.
     * Expects phone to already be formatted E.164.
     */
    create: async (businessId, clientData, transactionConnection = null) => {
        try {
            const { name, phone, email, notes } = clientData;
            
            if (!businessId || !name || !phone) {
                throw ERRORS.VALIDATION('Business ID, Name, and Phone are required for Client creation');
            }

            const sql = `
                INSERT INTO clients (business_id, name, phone, email, notes) 
                VALUES (?, ?, ?, ?, ?)
            `;
            
            const params = [businessId, name, phone, email || null, notes || null];
            
            // Allow opting into an existing transaction
            const db = transactionConnection || pool;
            const [result] = await db.query(sql, params);
            
            return result.insertId;
        } catch (error) {
            console.error('❌ Client.create error:', error);
            throw ERRORS.DATABASE('Failed to create new client record');
        }
    }
};

export default Client;
