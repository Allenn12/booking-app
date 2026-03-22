import pool from './config/database.js';

async function checkClientStatsComplete() {
  const [rows] = await pool.query(`
    SELECT * FROM clients WHERE name = 'Test Client 2'
  `);
  console.log('Client Row:', JSON.stringify(rows[0]));
  
  const clientId = rows[0].id;
  const [apts] = await pool.query(`
    SELECT a.id, a.status, a.appointment_datetime, s.price 
    FROM appointment a 
    JOIN services s ON a.service_id = s.id
    WHERE a.client_id = ? AND a.deleted_at IS NULL
  `, [clientId]);
  console.log('Client Appointments Total:', apts.length);
  console.log('Appointments sample:', JSON.stringify(apts));
  process.exit(0);
}

checkClientStatsComplete();
