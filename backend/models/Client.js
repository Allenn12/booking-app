import pool from '../config/database.js';
import { ERRORS } from '../utils/errors.js';

const Client = {
    /**
     * Find a client by exact phone match within a specific business.
     */
    findByPhone: async (businessId, phone) => {
        const sql = 'SELECT * FROM clients WHERE business_id = ? AND phone = ?';
        const [rows] = await pool.query(sql, [businessId, phone]);
        return rows.length > 0 ? rows[0] : null;
    },

    /**
     * Get a single client by ID.
     */
    getById: async (id) => {
        const sql = 'SELECT * FROM clients WHERE id = ?';
        const [rows] = await pool.query(sql, [id]);
        return rows.length > 0 ? rows[0] : null;
    },

    /**
     * Get a single client by ID, scoped to a business (multi-tenant safe).
     */
    getByBusinessAndId: async (businessId, clientId) => {
        const sql = 'SELECT * FROM clients WHERE id = ? AND business_id = ?';
        const [rows] = await pool.query(sql, [clientId, businessId]);
        return rows.length > 0 ? rows[0] : null;
    },

    /**
     * Create a new client, isolated by business_id.
     * Expects phone to already be formatted E.164.
     */
    create: async (businessId, clientData, transactionConnection = null) => {
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
    },

    /**
     * Search clients for autocomplete.
     * Excludes the walk-in sentinel. Uses idx_business_name and idx_business_phone.
     */
    search: async (businessId, query, limit = 10) => {
        const safeLimitNum = Math.min(Math.max(1, Number(limit) || 10), 50);
        const likeQuery = `%${query}%`;

        const sql = `
            SELECT id, name, phone, email
            FROM clients
            WHERE business_id = ?
              AND phone != 'WALKIN'
              AND (name LIKE ? OR phone LIKE ?)
            ORDER BY name ASC
            LIMIT ?
        `;

        const [rows] = await pool.query(sql, [businessId, likeQuery, likeQuery, safeLimitNum]);
        return rows;
    },

    /**
     * Paginated list of clients for a business, with computed no_show_count.
     * Excludes walk-in sentinel.
     *
     * Options:
     *   search  - filter by name or phone LIKE
     *   filter  - 'new' | 'frequent' | 'inactive' | null
     *   sort    - 'last_visit' | 'total_visits' | 'name' (default: 'last_visit')
     *   page    - 1-indexed (default: 1)
     *   limit   - max 50 (default: 20)
     */
    listByBusiness: async (businessId, options = {}) => {
        const {
            search = null,
            filter = null,
            sort = 'last_visit',
            page = 1,
            limit = 20
        } = options;

        const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);
        const safePage = Math.max(1, Number(page) || 1);
        const offset = (safePage - 1) * safeLimit;

        // Base SELECT with no_show_count subquery
        let sql = `
            SELECT c.id, c.name, c.phone, c.email, c.notes,
                   c.total_appointments,
                   c.last_appointment_at,
                   c.created_at,
                   COALESCE(ns.no_show_count, 0) AS no_show_count
            FROM clients c
            LEFT JOIN (
                SELECT client_id, COUNT(*) AS no_show_count
                FROM appointment
                WHERE status = 'no_show' AND deleted_at IS NULL
                GROUP BY client_id
            ) ns ON ns.client_id = c.id
            WHERE c.business_id = ?
              AND c.phone != 'WALKIN'
        `;
        const params = [businessId];

        // Count query (same WHERE, no ORDER/LIMIT)
        let countSql = `
            SELECT COUNT(*) AS total
            FROM clients c
            WHERE c.business_id = ?
              AND c.phone != 'WALKIN'
        `;
        const countParams = [businessId];

        // Search filter
        if (search && search.trim()) {
            const likeQuery = `%${search.trim()}%`;
            sql += ` AND (c.name LIKE ? OR c.phone LIKE ?)`;
            params.push(likeQuery, likeQuery);
            countSql += ` AND (c.name LIKE ? OR c.phone LIKE ?)`;
            countParams.push(likeQuery, likeQuery);
        }

        // Preset filters
        if (filter === 'new') {
            sql += ` AND c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
            countSql += ` AND c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
        } else if (filter === 'frequent') {
            sql += ` AND c.total_appointments >= 5`;
            countSql += ` AND c.total_appointments >= 5`;
        } else if (filter === 'inactive') {
            sql += ` AND (c.last_appointment_at IS NULL OR c.last_appointment_at < DATE_SUB(NOW(), INTERVAL 90 DAY))`;
            countSql += ` AND (c.last_appointment_at IS NULL OR c.last_appointment_at < DATE_SUB(NOW(), INTERVAL 90 DAY))`;
        }

        // Sorting
        const sortMap = {
            'last_visit': 'c.last_appointment_at DESC',
            'total_visits': 'c.total_appointments DESC',
            'name': 'c.name ASC',
            'no_shows': 'no_show_count DESC'
        };
        sql += ` ORDER BY ${sortMap[sort] || sortMap['last_visit']}`;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(safeLimit, offset);

        const [rows] = await pool.query(sql, params);
        const [countRows] = await pool.query(countSql, countParams);
        const total = countRows[0]?.total || 0;

        return {
            clients: rows,
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit)
            }
        };
    },

    /**
     * Get detailed client profile with upcoming and past appointments.
     */
    getDetailWithHistory: async (businessId, clientId, historyPage = 1, historyLimit = 10) => {
        // 1. Client info
        const clientSql = 'SELECT * FROM clients WHERE id = ? AND business_id = ?';
        const [clientRows] = await pool.query(clientSql, [clientId, businessId]);
        if (clientRows.length === 0) return null;
        const client = clientRows[0];

        // 2. Computed stats (Arrivals, No-shows, Last Visit, Total Revenue)
        const [statsRows] = await pool.query(
            `SELECT 
                COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS total_arrivals,
                COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) AS no_show_count,
                MAX(CASE WHEN a.status = 'completed' AND a.appointment_datetime < NOW() THEN a.appointment_datetime END) AS last_visit_at,
                COALESCE(SUM(CASE WHEN a.status = 'completed' THEN s.price ELSE 0 END), 0) AS total_revenue
             FROM appointment a
             LEFT JOIN services s ON a.service_id = s.id
             WHERE a.client_id = ? AND a.business_id = ? AND a.deleted_at IS NULL`,
            [clientId, businessId]
        );
        const stats = statsRows[0] || {};
        client.total_appointments = stats.total_arrivals || 0;
        client.no_show_count = stats.no_show_count || 0;
        client.last_appointment_at = stats.last_visit_at || null;
        client.total_revenue = parseFloat(stats.total_revenue || 0);

        // 4. Upcoming appointments (scheduled only, future)
        const [upcoming] = await pool.query(
            `SELECT a.id, a.appointment_datetime, a.status, a.notes, a.name AS appointment_name,
                    s.name AS service_name, s.duration_minutes, s.price AS service_price,
                    CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS worker_name
             FROM appointment a
             LEFT JOIN services s ON a.service_id = s.id
             LEFT JOIN user u ON a.assigned_to_user_id = u.id
             WHERE a.client_id = ? AND a.business_id = ?
               AND a.appointment_datetime >= NOW()
               AND a.status NOT IN ('cancelled', 'no_show')
               AND a.deleted_at IS NULL
             ORDER BY a.appointment_datetime ASC
             LIMIT 10`,
            [clientId, businessId]
        );

        // 5. Past appointments (paginated)
        const safeLimit = Math.min(Math.max(1, Number(historyLimit) || 10), 50);
        const safePage  = Math.max(1, Number(historyPage) || 1);
        const offset    = (safePage - 1) * safeLimit;

        const [history] = await pool.query(
            `SELECT a.id, a.appointment_datetime, a.status, a.notes, a.name AS appointment_name,
                    s.name AS service_name, s.duration_minutes, s.price AS service_price,
                    CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS worker_name
             FROM appointment a
             LEFT JOIN services s ON a.service_id = s.id
             LEFT JOIN user u ON a.assigned_to_user_id = u.id
             WHERE a.client_id = ? AND a.business_id = ?
               AND (a.appointment_datetime < NOW() OR a.status IN ('cancelled', 'no_show', 'completed'))
               AND a.deleted_at IS NULL
             ORDER BY a.appointment_datetime DESC
             LIMIT ? OFFSET ?`,
            [clientId, businessId, safeLimit, offset]
        );

        // 6. Total history count (for "show more" logic)
        const [historyCountRows] = await pool.query(
            `SELECT COUNT(*) AS total FROM appointment a
             WHERE a.client_id = ? AND a.business_id = ?
               AND (a.appointment_datetime < NOW() OR a.status IN ('cancelled', 'no_show', 'completed'))
               AND a.deleted_at IS NULL`,
            [clientId, businessId]
        );
        const historyTotal = historyCountRows[0]?.total || 0;

        return { client, upcoming, history, historyTotal, historyPage: safePage, historyLimit: safeLimit };
    },

    /**
     * Update editable client fields (name, phone, email, notes).
     * Whitelist-only — no arbitrary field injection possible.
     */
    update: async (clientId, data) => {
        const ALLOWED = ['name', 'phone', 'email', 'notes'];
        const fields  = Object.keys(data).filter(k => ALLOWED.includes(k) && data[k] !== undefined);
        if (fields.length === 0) return false;

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values    = fields.map(f => data[f] === '' ? null : data[f]);
        values.push(clientId);

        const sql = `UPDATE clients SET ${setClause} WHERE id = ?`;
        const [result] = await pool.query(sql, values);
        return result.affectedRows > 0;
    },

    /**
     * Update internal notes for a client.
     */
    updateNotes: async (clientId, notes) => {
        const sql = 'UPDATE clients SET notes = ? WHERE id = ?';
        const [result] = await pool.query(sql, [notes, clientId]);
        return result.affectedRows > 0;
    },

    /**
     * Get or create the walk-in sentinel client for a business.
     * Uses INSERT ... ON DUPLICATE KEY UPDATE for concurrency safety.
     */
    getOrCreateWalkIn: async (businessId) => {
        // Try to find existing
        const existing = await Client.findByPhone(businessId, 'WALKIN');
        if (existing) return existing;

        // Create using ON DUPLICATE KEY UPDATE (idempotent)
        const sql = `
            INSERT INTO clients (business_id, name, phone, email, notes)
            VALUES (?, 'Walk-in', 'WALKIN', NULL, 'Automatski klijent za walk-in posjete')
            ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
        `;
        const [result] = await pool.query(sql, [businessId]);

        // Re-fetch to return full row
        return Client.findByPhone(businessId, 'WALKIN');
    },

    /**
     * Increment appointment stats on the client record.
     * Called after a successful appointment creation.
     */
    incrementStats: async (clientId) => {
        const sql = `
            UPDATE clients 
            SET total_appointments = total_appointments + 1,
                last_appointment_at = NOW()
            WHERE id = ?
        `;
        await pool.query(sql, [clientId]);
    }
};

export default Client;
