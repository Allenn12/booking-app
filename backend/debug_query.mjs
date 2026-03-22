import pool from './config/database.js';
async function testQuery() {
  const businessId = 1;
  const clientId = 1; // Test Client
  const [rows] = await pool.query(`
    SELECT a.id, a.appointment_datetime, a.status, a.notes,
           s.name AS service_name, s.duration_minutes, s.price AS service_price,
           CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS worker_name
    FROM appointment a
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN user u ON a.assigned_to_user_id = u.id
    WHERE a.client_id = ? AND a.business_id = ?
      AND (a.appointment_datetime < NOW() OR a.status IN ('cancelled', 'no_show', 'completed'))
      AND a.deleted_at IS NULL
    ORDER BY a.appointment_datetime DESC
    LIMIT 10 OFFSET 0
  `, [clientId, businessId]);
  console.log('History Rows for Client 1:', JSON.stringify(rows));
}
testQuery().then(() => process.exit(0));
