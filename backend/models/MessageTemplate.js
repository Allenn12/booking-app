import pool from '../config/database.js';
import { ERRORS } from '../utils/errors.js';

class MessageTemplate {
  // Get all templates for a business
  static async getByBusinessId(businessId) {
    if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
    const [rows] = await pool.query(
      'SELECT type, content FROM message_templates WHERE business_id = ?',
      [businessId]
    );
    return rows;
  }

  // Upsert a template for a business
  static async upsert(businessId, type, content) {
    if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
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
