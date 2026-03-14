import pool from "../config/database.js";
import { ERRORS } from "../utils/errors.js";
import crypto from "crypto";

/**
 * Generate a URL-friendly slug from a business name.
 * Appends the business ID for guaranteed uniqueness.
 */
function generateSlug(name, id) {
    const base = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return `${base}-${id}`;
}
import { hashVerificationToken } from "../script/hashVerificationToken.js";

const Business = {
    create: async (data) => {
        try {
            if (!data.name || data.name.trim() === "") {
                throw ERRORS.VALIDATION("Business name is required");
            }

            if (!data.business_type_id) {
                throw ERRORS.VALIDATION("Business type is required");
            }

            if (!data.owner_user_id) {
                throw ERRORS.VALIDATION("Owner user ID is required");
            }

            const smsCredits = 10;
            const subscriptionStatus = "trial";
            const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            const sql = `INSERT INTO business(name, business_type_id, owner_user_id, phone, email, address, city, post_code, country_id, sms_credits, subscription_status, trial_ends_at, slug, allow_public_booking)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const params = [
                data.name.trim(),
                data.business_type_id,
                data.owner_user_id,
                data.phone || null,
                data.email || null,
                data.address || null,
                data.city || null,
                data.post_code || null,
                data.country_id,
                smsCredits,
                subscriptionStatus,
                trialEndsAt,
                'temp-slug', // placeholder, updated immediately after insert
                0,
            ];

            const [result] = await pool.query(sql, params);
            const businessId = result.insertId;

            // Generate real slug with ID for uniqueness and update
            const slug = generateSlug(data.name, businessId);
            await pool.query('UPDATE business SET slug = ? WHERE id = ?', [slug, businessId]);

            console.log("Business kreiran, ID:", businessId, "Slug:", slug);
            return businessId;
        } catch (error) {
            console.error("❌ Business.create error:", error);

            // 1. MySQL: Duplicate entry (npr. unique constraint na name)
            if (error.code === "ER_DUP_ENTRY") {
                throw ERRORS.CONFLICT("Business with this name already exists");
            }

            // 2. MySQL: Foreign key constraint fail
            // (owner_user_id ne postoji u user tablici, ili business_type_id ne postoji u job tablici)
            if (error.code === "ER_NO_REFERENCED_ROW_2") {
                throw ERRORS.VALIDATION(
                    "Invalid owner_user_id or business_type_id - referenced user/job does not exist",
                );
            }

            // 3. MySQL: Column doesn't exist (npr. typo u SQL query-u)
            if (error.code === "ER_BAD_FIELD_ERROR") {
                throw ERRORS.DATABASE("Database schema error - column does not exist");
            }

            // 4. MySQL: Syntax error u SQL-u
            if (error.code === "ER_PARSE_ERROR") {
                throw ERRORS.DATABASE("SQL syntax error");
            }

            // 5. MySQL: Connection lost
            if (error.code === "PROTOCOL_CONNECTION_LOST") {
                throw ERRORS.DATABASE("Database connection lost");
            }

            if (error.statusCode) {
                throw error;
            }

            throw ERRORS.DATABASE(`Failed to create business: ${error.message}`);
        }
    },
    getById: async (businessId) => {
        try {
            if (isNaN(Number(businessId))) {
                throw ERRORS.VALIDATION('Business ID mora biti broj.');
            }
            const sql = 'SELECT * FROM business WHERE id = ? LIMIT 1';
            const params = [businessId];
            const [result] = await pool.query(sql, params);
            return result[0];
        } catch (error) {
            console.error('❌ Business.getById error:', error);

            // MySQL: Connection lost
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Database connection lost');
            }

            // AppError already thrown (validation)
            if (error.statusCode) {
                throw error;
            }

            // Unknown error
            throw ERRORS.DATABASE(`Failed to get business: ${error.message}`);
        }
    },
    getByOwnerId: async (userId) => {
        try {
            if (isNaN(Number(userId))) {
                throw ERRORS.VALIDATION('User ID mora biti broj');
            }
            const sql = 'SELECT * FROM business WHERE owner_user_id = ? AND is_active = 1';
            const params = [userId];
            const [result] = await pool.query(sql, params);
            return result;
        } catch (error) {
            console.error('❌ Business.getByOwnerId error:', error);

            // MySQL: Connection lost
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Database connection lost');
            }
            // AppError already thrown (validation)
            if (error.statusCode) {
                throw error;
            }
            // Unknown error
            throw ERRORS.DATABASE(`Failed to get business: ${error.message}`);
        }
    },
    update: async (businessId, data) => {
        try {
            if (!businessId || isNaN(Number(businessId))) {
                throw ERRORS.VALIDATION('Business ID mora biti broj.');
            }

            // 2. data validation
            if (!data || Object.keys(data).length === 0) {
                throw ERRORS.VALIDATION('Update informacije su potrebne');
            }

            // 3. name validation (ako se mijenja)
            if (data.name !== undefined && (!data.name || data.name.trim() === '')) {
                throw ERRORS.VALIDATION('Business ime ne smije biti prazno');
            }

            const updates = []; const params = [];
            if (data.name !== undefined) {
                updates.push('name = ?');
                params.push(data.name.trim());
            }
            if (data.phone !== undefined) {
                updates.push('phone = ?');
                params.push(data.phone);
            }
            if (data.email !== undefined) {
                updates.push('email = ?');
                params.push(data.email.trim());
            }
            if (data.address !== undefined) {
                updates.push('address = ?');
                params.push(data.address.trim() || null);
            }
            if (data.city !== undefined) {
                updates.push('city = ?');
                params.push(data.city.trim() || null);
            }
            if (data.post_code !== undefined) {
                updates.push('post_code = ?');
                params.push(data.post_code || null);
            }
            if (data.country_id !== undefined) {
                updates.push('country_id = ?');
                params.push(data.country_id);
            }
            if (data.allow_public_booking !== undefined) {
                updates.push('allow_public_booking = ?');
                params.push(data.allow_public_booking ? 1 : 0);
            }
            if (data.sms_enabled !== undefined) {
                updates.push('sms_enabled = ?');
                params.push(data.sms_enabled ? 1 : 0);
            }
            if (data.send_confirmation !== undefined) {
                updates.push('send_confirmation = ?');
                params.push(data.send_confirmation ? 1 : 0);
            }
            if (data.send_reminder !== undefined) {
                updates.push('send_reminder = ?');
                params.push(data.send_reminder ? 1 : 0);
            }
            if (data.send_cancellation !== undefined) {
                updates.push('send_cancellation = ?');
                params.push(data.send_cancellation ? 1 : 0);
            }

            if (updates.length === 0) throw ERRORS.VALIDATION('Nema ništa za ažuriranje.');
            updates.push('updated_at = NOW()');
            params.push(businessId);
            const sql = `UPDATE business SET ${updates.join(', ')} WHERE id = ? AND is_active = 1`;
            const [result] = await pool.query(sql, params);

            return result.affectedRows > 0;
        } catch (error) {
            console.error('❌ Business.update error:', error);

            // MySQL: Connection lost
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Database connection lost');
            }

            // AppError already thrown (validation)
            if (error.statusCode) {
                throw error;
            }

            // Unknown error
            throw ERRORS.DATABASE(`Failed to update business info: ${error.message}`);
        }
    },
    deductCredits: async (businessId, amount) => {
        try {
            if (!businessId || isNaN(Number(businessId))) {
                throw ERRORS.VALIDATION('Business ID mora biti broj');
            }
            if (!amount || isNaN(Number(amount)) || amount <= 0) {
                throw ERRORS.VALIDATION('Amount nije validan');
            }
            const business = await Business.getById(businessId);

            if (!business) {
                throw ERRORS.NOT_FOUND('Business not found');
            }

            if (business.sms_credits < amount) {
                throw ERRORS.PAYMENT_REQUIRED( // NAPRAVITI U ERRORS FUNKCIJU
                    `Insufficient SMS credits. Available: ${business.sms_credits}, Required: ${amount}`
                ); 
            }
            const sql = 'UPDATE business SET sms_credits = sms_credits - ? WHERE id = ? AND is_active = 1';
            const params = [amount, businessId];
            const [result] = await pool.query(sql, params);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('❌ Business.deductCredits error:', error);

            // MySQL: Connection lost
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Database connection lost');
            }

            // AppError already thrown (validation)
            if (error.statusCode) {
                throw error;
            }

            // Unknown error
            throw ERRORS.DATABASE(`Failed to update business info: ${error.message}`);
        }
    },
    addCredits: async (businessId, amount) => {
        try {
            if (!businessId || isNaN(Number(businessId))) {
                throw ERRORS.VALIDATION('Business ID mora biti broj');
            }
            if (!amount || isNaN(Number(amount)) || amount <= 0) {
                throw ERRORS.VALIDATION('Amount nije validan');
            }
            const business = await Business.getById(businessId);

            if (!business) {
                throw ERRORS.NOT_FOUND('Business not found');
            }

            const sql = 'UPDATE business SET sms_credits = sms_credits + ? WHERE id = ? AND is_active = 1';
            const params = [amount, businessId];
            const [result] = await pool.query(sql, params);
            console.log(`✅ Added ${amount} credits to business ${businessId}`);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('❌ Business.addCredits error:', error);

            // MySQL: Connection lost
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Database connection lost');
            }

            // AppError already thrown (validation)
            if (error.statusCode) {
                throw error;
            }

            // Unknown error
            throw ERRORS.DATABASE(`Failed to update business info: ${error.message}`);
        }
    },
    findByUserId: async (userId) => {
        try {
            if (!userId || isNaN(Number(userId))) {
                throw ERRORS.VALIDATION('User ID is required');
            }
            const sql = `
                SELECT b.* 
                FROM business b
                JOIN user_business ub ON b.id = ub.business_id
                WHERE ub.user_id = ? AND b.is_active = 1
            `;
            const [result] = await pool.query(sql, [userId]);
            return result;
        } catch (error) {
            console.error('❌ Business.findByUserId error:', error);
            if (error.statusCode) throw error;
            throw ERRORS.DATABASE(`Failed to get businesses for user: ${error.message}`);
        }
    },
    findByName: async (name) => {
        try {
            if (!name) {
                throw ERRORS.VALIDATION('Business name is required');
            }
            const sql = 'SELECT * FROM business WHERE name = ? AND is_active = 1 LIMIT 1';
            const [rows] = await pool.query(sql, [name]);
            return rows[0];
        } catch (error) {
            console.error('❌ Business.findByName error:', error);
            if (error.statusCode) throw error;
            throw ERRORS.DATABASE(`Failed to find business by name: ${error.message}`);
        }
    },

    findBySlug: async (slug) => {
        try {
            if (!slug || typeof slug !== 'string') {
                throw ERRORS.VALIDATION('Slug is required');
            }
            const sql = 'SELECT * FROM business WHERE slug = ? AND is_active = 1 LIMIT 1';
            const [rows] = await pool.query(sql, [slug.toLowerCase()]);
            return rows[0] || null;
        } catch (error) {
            console.error('❌ Business.findBySlug error:', error);
            if (error.statusCode) throw error;
            throw ERRORS.DATABASE(`Failed to find business by slug: ${error.message}`);
        }
    },

    togglePublicBooking: async (businessId, enabled) => {
        try {
            const sql = 'UPDATE business SET allow_public_booking = ?, updated_at = NOW() WHERE id = ? AND is_active = 1';
            const [result] = await pool.query(sql, [enabled ? 1 : 0, businessId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('❌ Business.togglePublicBooking error:', error);
            if (error.statusCode) throw error;
            throw ERRORS.DATABASE(`Failed to toggle public booking: ${error.message}`);
        }
    },
};

export default Business;