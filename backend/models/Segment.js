import pool from '../config/database.js';
import { ERRORS } from '../utils/errors.js';

class Segment {
  static async create(businessId, data) {
    if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
    const { name, type, rules } = data;
    const rulesStr = rules ? JSON.stringify(rules) : null;
    const sql = `INSERT INTO segments (business_id, name, type, rules) VALUES (?, ?, ?, ?)`;
    const [result] = await pool.query(sql, [businessId, name, type, rulesStr]);
    return result.insertId;
  }

  static async getAllForBusiness(businessId) {
    if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
    const sql = `SELECT * FROM segments WHERE business_id = ? ORDER BY created_at DESC`;
    const [rows] = await pool.query(sql, [businessId]);
    return rows;
  }

  static async getById(businessId, segmentId) {
    if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
    const sql = `SELECT * FROM segments WHERE id = ? AND business_id = ?`;
    const [rows] = await pool.query(sql, [segmentId, businessId]);
    return rows.length > 0 ? rows[0] : null;
  }

  static async update(businessId, segmentId, data) {
    if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
    const { name, type, rules } = data;
    const rulesStr = rules ? JSON.stringify(rules) : null;
    const sql = `UPDATE segments SET name = ?, type = ?, rules = ? WHERE id = ? AND business_id = ?`;
    const [result] = await pool.query(sql, [name, type, rulesStr, segmentId, businessId]);
    return result.affectedRows > 0;
  }

  static async delete(businessId, segmentId) {
    if (!businessId) throw ERRORS.VALIDATION('Business ID is mandatory');
    const sql = `DELETE FROM segments WHERE id = ? AND business_id = ?`;
    const [result] = await pool.query(sql, [segmentId, businessId]);
    return result.affectedRows > 0;
  }
}

export default Segment;
