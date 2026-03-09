import { ERRORS } from "../utils/errors.js";
import pool from "../config/database.js";

const Service = {
    findByBusinessId: async (businessId) => {
        try {
            if (!businessId || isNaN(Number(businessId))) {
                throw ERRORS.VALIDATION('Business ID mora biti broj');
            }

            const sql = `
                SELECT 
                    id, 
                    business_id, 
                    name, 
                    description, 
                    duration_minutes, 
                    price, 
                    is_active, 
                    created_at, 
                    updated_at
                FROM services
                WHERE business_id = ?
                ORDER BY name ASC
            `;

            const [result] = await pool.query(sql, [businessId]);
            console.log(`✅ Found ${result.length} service(s) for business ${businessId}`);
            return result;
        } catch (error) {
            console.error('❌ Service.findByBusinessId error:', error);
            
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Database connection lost');
            }
            
            if (error.statusCode) {
                throw error;
            }
            
            throw ERRORS.DATABASE(`Failed to get business services: ${error.message}`);
        }
    },

    create: async (businessId, serviceData) => {
        try {
            if (!businessId || isNaN(Number(businessId))) {
                throw ERRORS.VALIDATION('Business ID must be a number');
            }
            if (!serviceData.name) {
                throw ERRORS.VALIDATION('Service name is required');
            }

            const duration = serviceData.duration_minutes || 30; // Default to 30 mins if empty/null
            const price = serviceData.price || null;

            const sql = `
                INSERT INTO services (business_id, name, description, duration_minutes, price, is_active)
                VALUES (?, ?, ?, ?, ?, 1)
            `;
            
            const [result] = await pool.query(sql, [businessId, serviceData.name, serviceData.description || null, duration, price]);
            return { id: result.insertId, ...serviceData, duration_minutes: duration, price, is_active: 1 };
        } catch (error) {
            console.error('❌ Service.create error:', error);
            throw ERRORS.DATABASE(`Failed to create service: ${error.message}`);
        }
    },

    update: async (id, businessId, serviceData) => {
        try {
            if (!id || isNaN(Number(id))) {
                throw ERRORS.VALIDATION('Service ID must be a number');
            }
            if (!serviceData.name) {
                throw ERRORS.VALIDATION('Service name is required');
            }

            const duration = serviceData.duration_minutes || 30;
            const price = serviceData.price || null;

            const sql = `
                UPDATE services 
                SET name = ?, description = ?, duration_minutes = ?, price = ?, updated_at = NOW()
                WHERE id = ? AND business_id = ?
            `;
            
            const [result] = await pool.query(sql, [serviceData.name, serviceData.description || null, duration, price, id, businessId]);
            
            if (result.affectedRows === 0) {
                throw ERRORS.NOT_FOUND('Service not found or you do not have permission');
            }
            
            return { id, ...serviceData, duration_minutes: duration, price };
        } catch (error) {
            console.error('❌ Service.update error:', error);
            if (error.statusCode) throw error;
            throw ERRORS.DATABASE(`Failed to update service: ${error.message}`);
        }
    },

    softDelete: async (id, businessId) => {
        try {
            if (!id || isNaN(Number(id))) {
                throw ERRORS.VALIDATION('Service ID must be a number');
            }

            const sql = `
                UPDATE services 
                SET is_active = 0, updated_at = NOW()
                WHERE id = ? AND business_id = ?
            `;
            
            const [result] = await pool.query(sql, [id, businessId]);
            
            if (result.affectedRows === 0) {
                throw ERRORS.NOT_FOUND('Service not found or you do not have permission');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Service.softDelete error:', error);
            if (error.statusCode) throw error;
            throw ERRORS.DATABASE(`Failed to delete service: ${error.message}`);
        }
    }
};

export default Service;
