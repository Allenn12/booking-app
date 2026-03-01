import { ERRORS } from "../utils/errors.js";
import pool from "../config/database.js";

const UserBusiness = {
    create: async (userId, businessId, role, customPermissions) => {
        try {
            if (!userId || isNaN(Number(userId))) {
                throw ERRORS.VALIDATION('User ID mora biti broj');
            }

            if (!businessId || isNaN(Number(businessId))) {
                throw ERRORS.VALIDATION('Business ID mora biti broj');
            }

            const validRoles = ['owner', 'admin', 'employee'];
            if (!role || !validRoles.includes(role)) {
                throw ERRORS.VALIDATION('Invalid role. Must be: owner, admin, or employee');
            }

            const defaultPermissions = {
                owner: {
                    can_manage_services: 1,
                    can_manage_clients: 1,
                    can_create_appointments: 1,
                    can_view_reports: 1
                },
                admin: {
                    can_manage_services: 1,
                    can_manage_clients: 1,
                    can_create_appointments: 1,
                    can_view_reports: 1
                },
                employee: {
                    can_manage_services: 0,
                    can_manage_clients: 0,
                    can_create_appointments: 1,
                    can_view_reports: 0
                }
            };

            const finalPermissions = customPermissions ?
                { ...defaultPermissions[role], ...customPermissions }
                : defaultPermissions[role];

            const sql = `INSERT INTO user_business (
        user_id, business_id, role, can_manage_services, can_manage_clients, can_create_appointments, can_view_reports, joined_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`;

            const params = [
                userId,
                businessId,
                role,
                finalPermissions.can_manage_services,
                finalPermissions.can_manage_clients,
                finalPermissions.can_create_appointments,
                finalPermissions.can_view_reports
            ];

            const [result] = await pool.query(sql, params);
            console.log(`✅ User ${userId} added to business ${businessId} as ${role}`);
            return {
                id: result.insertId,
                userId,
                businessId,
                role,
                permissions: finalPermissions
            };
        } catch (error) {
            console.error('❌ UserBusiness.create error:', error);

            // Duplicate entry
            if (error.code === 'ER_DUP_ENTRY') {
                throw ERRORS.CONFLICT('User already in this business');
            }

            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Database connection lost');
            }

            // Foreign key fail
            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                throw ERRORS.VALIDATION('Invalid user_id or business_id');
            }

            // AppError re-throw
            if (error.statusCode) {
                throw error;
            }

            // Unknown error
            throw ERRORS.DATABASE(`Failed to add user to business: ${error.message}`);
        }
    },
    checkAccess: async(userId, businessId) => {
        try{
            if (!userId || isNaN(Number(userId))) {
                throw ERRORS.VALIDATION('User ID mora biti broj');
            }

            if (!businessId || isNaN(Number(businessId))) {
                throw ERRORS.VALIDATION('Business ID mora biti broj');
            }
            const sql = `SELECT id FROM user_business WHERE user_id = ? AND business_id = ? LIMIT 1`;
            const params = [userId, businessId];
            const [result] = await pool.query(sql, params);
            return result.length > 0;
        } catch(error){
            console.error('❌ UserBusiness.checkAccess error:', error);


            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Database connection lost');
            }

            // AppError re-throw
            if (error.statusCode) {
                throw error;
            }

            // Unknown error
            throw ERRORS.DATABASE(`Failed to check user access: ${error.message}`);
        }
    },
    getUserBusinesses: async(userId) => {
        try{
            if (!userId || isNaN(Number(userId))) {
                throw ERRORS.VALIDATION('User ID nije validan');
            }

            const sql = `
                SELECT 
                    ub.id,
                    ub.business_id,
                    ub.role,
                    ub.can_manage_services,
                    ub.can_manage_clients,
                    ub.can_create_appointments,
                    ub.can_view_reports,
                    
                    b.name AS business_name,
                    b.sms_credits AS business_sms_credits,
                    b.subscription_status AS business_subscription_status,
                    b.trial_ends_at AS business_trial_ends_at,
                    
                    i.code AS invite_code,
                    i.token AS invite_token
                    
                FROM user_business ub
                INNER JOIN business b ON ub.business_id = b.id
                LEFT JOIN invitations i ON b.id = i.business_id AND i.is_active = 1
                WHERE ub.user_id = ?
                    AND b.is_active = 1
                ORDER BY 
                    CASE ub.role
                    WHEN 'owner' THEN 1
                    WHEN 'admin' THEN 2
                    WHEN 'employee' THEN 3
                    END ASC,
                    ub.joined_at DESC
            `;

            const [result] = await pool.query(sql, [userId]);
            console.log(`✅ Found ${result.length} business(es) for user ${userId}`);
            return result;
        } catch (error) {
            console.error('❌ UserBusiness.getUserBusinesses error:', error);
            
            // MySQL: Connection lost
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Database connection lost');
            }
            
            // AppError re-throw
            if (error.statusCode) {
                throw error;
            }
            
            // Unknown error
            throw ERRORS.DATABASE(`Failed to get user businesses: ${error.message}`);
        }
    },
    getBusinessUsers: async(businessId) => {
        try{
            if(!businessId || isNaN(Number(businessId))){
                throw ERRORS.VALIDATION('Business ID nije validan.');
            }

            const sql = `
                SELECT 
                    ub.id,
                    ub.user_id,
                    ub.business_id,
                    ub.role,
                    ub.can_manage_services,
                    ub.can_manage_clients,
                    ub.can_create_appointments,
                    ub.can_view_reports,
                    ub.joined_at,
                    
                    u.email AS user_email,
                    u.first_name AS user_first_name,
                    u.last_name AS user_last_name
                    
                FROM user_business ub
                INNER JOIN user u ON ub.user_id = u.id
                WHERE ub.business_id = ?
                ORDER BY 
                    CASE ub.role
                    WHEN 'owner' THEN 1
                    WHEN 'admin' THEN 2
                    WHEN 'employee' THEN 3
                    END ASC,
                    ub.joined_at ASC
            `;
            const [result] = await pool.query(sql, [businessId]);
            console.log(`✅ Found ${result.length} users for business ${businessId}`);
            return result;
            
        } catch(error){
            console.error('❌ UserBusiness.getBusinessUsers error:', error);
            
            // MySQL: Connection lost
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Database connection lost');
            }
            
            // AppError re-throw
            if (error.statusCode) {
                throw error;
            }
            
            // Unknown error
            throw ERRORS.DATABASE(`Failed to get business users: ${error.message}`);
        }
    },
    findByUserAndBusiness: async (userId, businessId) => {
        try {
            if (!userId || !businessId) {
                throw ERRORS.VALIDATION('User ID and Business ID are required');
            }
            const sql = 'SELECT * FROM user_business WHERE user_id = ? AND business_id = ? LIMIT 1';
            const [rows] = await pool.query(sql, [userId, businessId]);
            return rows[0];
        } catch (error) {
            console.error('❌ UserBusiness.findByUserAndBusiness error:', error);
            if (error.statusCode) throw error;
            throw ERRORS.DATABASE(`Failed to find user-business association: ${error.message}`);
        }
    },
    findOwner: async (businessId) => {
        try {
            if (!businessId) {
                throw ERRORS.VALIDATION('Business ID is required');
            }
            const sql = `
                SELECT u.* 
                FROM user u
                JOIN user_business ub ON u.id = ub.user_id
                WHERE ub.business_id = ? AND ub.role = 'owner'
                LIMIT 1
            `;
            const [rows] = await pool.query(sql, [businessId]);
            return rows[0];
        } catch (error) {
            console.error('❌ UserBusiness.findOwner error:', error);
            if (error.statusCode) throw error;
            throw ERRORS.DATABASE(`Failed to find business owner: ${error.message}`);
        }
    },
};

export default UserBusiness;