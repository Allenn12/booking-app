import pool from '../config/database.js';

const SegmentService = {
  /**
   * Evaluate a segment and return an array of client IDs.
   * @param {number} businessId 
   * @param {Object} segment { type, rules }
   * @returns {Promise<number[]>}
   */
  async getClientIdsForSegment(businessId, segment) {
    const { type, rules } = segment;
    const { sql, params } = this._buildQuery(businessId, type, rules);
    
    // Select only IDs
    const finalSql = `SELECT c.id FROM clients c ${sql.joinStr} WHERE ${sql.whereStr}`;
    const [rows] = await pool.query(finalSql, params);
    return rows.map(r => r.id);
  },

  /**
   * Evaluate a segment and return the count of clients.
   * @param {number} businessId 
   * @param {Object} segment { type, rules }
   * @returns {Promise<number>}
   */
  async countForSegment(businessId, segment) {
    const { type, rules } = segment;
    const { sql, params } = this._buildQuery(businessId, type, rules);
    
    const finalSql = `SELECT COUNT(DISTINCT c.id) as count FROM clients c ${sql.joinStr} WHERE ${sql.whereStr}`;
    const [rows] = await pool.query(finalSql, params);
    return rows[0].count;
  },

  _buildQuery(businessId, type, rules) {
    let where = ["c.business_id = ?", "c.phone != 'WALKIN'", "c.marketing_opt_out = 0", "c.phone IS NOT NULL"];
    let joinStr = "";
    let params = [businessId];

    switch (type) {
      case 'all_clients':
        break;

      case 'lapsed':
        const lapsedDays = rules?.lapsed_days || 90;
        where.push(`c.last_appointment_at IS NOT NULL AND c.last_appointment_at < DATE_SUB(NOW(), INTERVAL ? DAY)`);
        params.push(lapsedDays);
        break;

      case 'new_clients':
        const withinDays = rules?.within_days || 30;
        where.push(`c.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`);
        where.push(`c.total_appointments > 0`); // Must have visited at least once
        params.push(withinDays);
        break;

      case 'frequent':
        const minVisits = rules?.min_visits || 5;
        where.push(`c.total_appointments >= ?`);
        params.push(minVisits);
        break;

      case 'upcoming':
        const nextDays = rules?.next_days || 3;
        joinStr = `JOIN appointment a ON a.client_id = c.id`;
        where.push(`a.business_id = ?`);
        params.push(businessId);
        where.push(`a.status = 'scheduled'`);
        where.push(`a.appointment_datetime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)`);
        params.push(nextDays);
        break;

      case 'custom':
        // Not implemented yet
        break;

      default:
        throw new Error(`Unknown segment type: ${type}`);
    }

    return {
      sql: { joinStr, whereStr: where.join(' AND ') },
      params
    };
  }
};

export default SegmentService;
