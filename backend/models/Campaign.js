import pool from '../config/database.js';

class Campaign {
  static async getAllForBusiness(businessId, limit = 50, offset = 0) {
    const sql = `
      SELECT 
        c.*, 
        s.name as segment_name, 
        t.type as template_type,
        (SELECT cl.name FROM campaign_recipients cr JOIN clients cl ON cr.client_id = cl.id WHERE cr.campaign_id = c.id LIMIT 1) as target_client_name
      FROM campaigns c
      LEFT JOIN segments s ON c.segment_id = s.id
      LEFT JOIN message_templates t ON c.template_id = t.id
      WHERE c.business_id = ?
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(sql, [businessId, limit, offset]);

    const countSql = `SELECT COUNT(*) as total FROM campaigns WHERE business_id = ?`;
    const [countRows] = await pool.query(countSql, [businessId]);

    return { campaigns: rows, total: countRows[0].total };
  }

  static async getById(businessId, campaignId) {
    const sql = `
      SELECT c.*, s.name as segment_name, t.type as template_type
      FROM campaigns c
      LEFT JOIN segments s ON c.segment_id = s.id
      LEFT JOIN message_templates t ON c.template_id = t.id
      WHERE c.id = ? AND c.business_id = ?
    `;
    const [rows] = await pool.query(sql, [campaignId, businessId]);
    return rows.length > 0 ? rows[0] : null;
  }

  static async updateDraft(businessId, campaignId, data) {
    const { name, segment_id, template_id, inline_message } = data;
    const sql = `
      UPDATE campaigns 
      SET name = ?, segment_id = ?, template_id = ?, inline_message = ? 
      WHERE id = ? AND business_id = ? AND status = 'draft'
    `;
    const [result] = await pool.query(sql, [name, segment_id || null, template_id || null, inline_message || null, campaignId, businessId]);
    return result.affectedRows > 0;
  }

  static async deleteDraft(businessId, campaignId) {
    const sql = `DELETE FROM campaigns WHERE id = ? AND business_id = ? AND status = 'draft'`;
    const [result] = await pool.query(sql, [campaignId, businessId]);
    return result.affectedRows > 0;
  }

  static async getRecipients(businessId, campaignId, limit = 50, offset = 0) {
    const campSql = `SELECT id FROM campaigns WHERE id = ? AND business_id = ?`;
    const [campRows] = await pool.query(campSql, [campaignId, businessId]);
    if (campRows.length === 0) return { recipients: [], total: 0 };

    const sql = `
      SELECT cr.*, c.name, c.phone
      FROM campaign_recipients cr
      JOIN clients c ON cr.client_id = c.id
      WHERE cr.campaign_id = ?
      ORDER BY cr.id ASC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(sql, [campaignId, limit, offset]);

    const countSql = `SELECT COUNT(*) as total FROM campaign_recipients WHERE campaign_id = ?`;
    const [countRows] = await pool.query(countSql, [campaignId]);

    return { recipients: rows, total: countRows[0].total };
  }
}

export default Campaign;
