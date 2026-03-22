import pool from './config/database.js';
async function deepDive() {
  const [rows] = await pool.query(`
    SELECT a.id, a.client_id, a.name as apt_name, c.name as client_name, c.phone 
    FROM appointment a 
    JOIN clients c ON a.client_id = c.id 
    WHERE c.phone != 'WALKIN' 
      AND a.name = 'Walk-in'
  `);
  console.log('Walk-in appointments linked to REAL clients:', rows.length);
  if (rows.length > 0) console.log('Sample:', JSON.stringify(rows.slice(0, 3)));
  
  const [nullClientRows] = await pool.query(`
    SELECT id, name FROM appointment WHERE client_id IS NULL AND deleted_at IS NULL
  `);
  console.log('Appointments with NULL client_id:', nullClientRows.length);
}
deepDive().then(() => process.exit(0));
