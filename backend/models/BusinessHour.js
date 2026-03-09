import pool from "../config/database.js";
import { ERRORS } from "../utils/errors.js";

const BusinessHour = {
    getByBusinessId: async (businessId) => {
        try {
            if (!businessId || isNaN(Number(businessId))) {
                throw ERRORS.VALIDATION("Business ID is required");
            }
            
            const sql = 'SELECT * FROM business_hours WHERE business_id = ? ORDER BY day_of_week ASC';
            const [rows] = await pool.query(sql, [businessId]);
            return rows;
        } catch (error) {
            console.error("❌ BusinessHour.getByBusinessId error:", error);
            if (error.statusCode) throw error;
            throw ERRORS.DATABASE(`Failed to get business hours: ${error.message}`);
        }
    },

    updateForBusiness: async (businessId, hoursArray) => {
        let connection;
        try {
            if (!businessId || isNaN(Number(businessId))) {
                throw ERRORS.VALIDATION("Business ID is required");
            }
            if (!Array.isArray(hoursArray)) {
                throw ERRORS.VALIDATION("hoursArray must be an array");
            }

            // GET TRANSACTION CONNECTION
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // 1. DELETE EXISTING HOURS
            const deleteSql = 'DELETE FROM business_hours WHERE business_id = ?';
            await connection.query(deleteSql, [businessId]);

            // 2. INSERT NEW HOURS
            if (hoursArray.length > 0) {
                const insertSql = `
                    INSERT INTO business_hours (business_id, day_of_week, open_time, close_time, is_closed) 
                    VALUES ?
                `;
                
                // Construct the nested array format required by mysql2 for bulk inserts
                const values = hoursArray.map(hour => [
                    businessId,
                    hour.day_of_week,
                    hour.open_time || null,
                    hour.close_time || null,
                    hour.is_closed ? 1 : 0
                ]);

                await connection.query(insertSql, [values]);
            }

            // COMMIT TRANSACTION
            await connection.commit();
            return true;

        } catch (error) {
            // ROLLBACK ON ERROR
            if (connection) {
                await connection.rollback();
            }
            console.error("❌ BusinessHour.updateForBusiness error:", error);
            if (error.statusCode) throw error;
            throw ERRORS.DATABASE(`Failed to update business hours: ${error.message}`);
        } finally {
            // ALWAYS RELEASE CONNECTION
            if (connection) {
                connection.release();
            }
        }
    }
};

export default BusinessHour;
