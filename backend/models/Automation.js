import pool from '../config/database.js';

class Automation {
  static async getAllForBusiness(businessId) {
    const sql = `
      SELECT a.*, s.name as segment_name, t.type as template_type
      FROM automations a
      LEFT JOIN segments s ON a.segment_id = s.id
      LEFT JOIN message_templates t ON a.template_id = t.id
      WHERE a.business_id = ?
      ORDER BY a.created_at DESC
    `;
    const [rows] = await pool.query(sql, [businessId]);
    return rows;
  }

  static async getById(businessId, automationId) {
    const sql = `
      SELECT a.*, s.name as segment_name, t.type as template_type
      FROM automations a
      LEFT JOIN segments s ON a.segment_id = s.id
      LEFT JOIN message_templates t ON a.template_id = t.id
      WHERE a.id = ? AND a.business_id = ?
    `;
    const [rows] = await pool.query(sql, [automationId, businessId]);
    return rows.length > 0 ? rows[0] : null;
  }

  static async create(businessId, data) {
    const { name, type, channel, template_id, inline_message, segment_id, config } = data;
    const sql = `
      INSERT INTO automations 
        (business_id, name, type, channel, template_id, inline_message, segment_id, config, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'disabled')
    `;
    const [result] = await pool.query(sql, [
      businessId, 
      name, 
      type, 
      channel || 'sms', 
      template_id || null, 
      inline_message || null, 
      segment_id || null, 
      JSON.stringify(config || {})
    ]);
    return result.insertId;
  }

  static async update(businessId, automationId, data) {
    const { name, template_id, inline_message, segment_id, config } = data;
    const sql = `
      UPDATE automations 
      SET name = ?, template_id = ?, inline_message = ?, segment_id = ?, config = ?
      WHERE id = ? AND business_id = ?
    `;
    const [result] = await pool.query(sql, [
      name, 
      template_id || null, 
      inline_message || null, 
      segment_id || null, 
      JSON.stringify(config || {}),
      automationId, 
      businessId
    ]);
    return result.affectedRows > 0;
  }

  static async delete(businessId, automationId) {
    const sql = `DELETE FROM automations WHERE id = ? AND business_id = ?`;
    const [result] = await pool.query(sql, [automationId, businessId]);
    return result.affectedRows > 0;
  }

  static async setStatus(businessId, automationId, status) {
    const sql = `UPDATE automations SET status = ? WHERE id = ? AND business_id = ?`;
    const [result] = await pool.query(sql, [status, automationId, businessId]);
    return result.affectedRows > 0;
  }

  static async getStats(businessId, automationId, days = 30) {
    const sql = `
      SELECT DATE(sent_at) as date, COUNT(*) as sent_count
      FROM automation_logs al
      JOIN automations a ON al.automation_id = a.id
      WHERE al.automation_id = ? AND a.business_id = ? 
        AND al.sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(sent_at)
      ORDER BY date ASC
    `;
    const [rows] = await pool.query(sql, [automationId, businessId, days]);
    
    const totalSql = `SELECT COUNT(*) as total FROM automation_logs WHERE automation_id = ?`;
    const [totalRows] = await pool.query(totalSql, [automationId]);
    
    return {
      history: rows,
      total_sent: totalRows[0].total
    };
  }
}

export default Automation;
