import pool from './config/database.js';

async function verifyQuery() {
  const clientId = 56;
  const businessId = 5; // I'll check business ID if I know it, but let's just use clientId
  const [statsRows] = await pool.query(
      `SELECT 
          COUNT(CASE WHEN status = 'completed' THEN 1 END) AS total_arrivals,
          COUNT(CASE WHEN status = 'no_show' THEN 1 END) AS no_show_count,
          MAX(CASE WHEN status = 'completed' AND appointment_datetime < NOW() THEN appointment_datetime END) AS last_visit_at
       FROM appointment
       WHERE client_id = ? AND deleted_at IS NULL`,
      [clientId]
  );
  console.log('Query Result for ID 56:', JSON.stringify(statsRows[0]));
  process.exit(0);
}

verifyQuery();
