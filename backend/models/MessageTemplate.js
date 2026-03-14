import pool from '../config/database.js';

class MessageTemplate {
  // Get all templates for a business
  static async getByBusinessId(businessId) {
    const [rows] = await pool.query(
      'SELECT type, content FROM message_templates WHERE business_id = ?',
      [businessId]
    );
    return rows;
  }

  // Upsert a template for a business
  static async upsert(businessId, type, content) {
    const sql = `
      INSERT INTO message_templates (business_id, type, content)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = CURRENT_TIMESTAMP
    `;
    const [result] = await pool.query(sql, [businessId, type, content]);
    return result;
  }
}

export default MessageTemplate;
