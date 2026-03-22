import pool from './config/database.js';

async function checkClientStats() {
  const [rows] = await pool.query(`
    SELECT id, name, total_appointments, last_appointment_at 
    FROM clients 
    WHERE name = 'Test Client 2'
  `);
  console.log('Client Stats from DB:', JSON.stringify(rows));
  
  if (rows.length > 0) {
    const clientId = rows[0].id;
    const [counts] = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM appointment 
      WHERE client_id = ? AND deleted_at IS NULL
      GROUP BY status
    `, [clientId]);
    console.log('Appointment counts for Client:', JSON.stringify(counts));
  }
  process.exit(0);
}

checkClientStats();
