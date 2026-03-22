import pool from './config/database.js';
async function findCorrupt() {
  const [rows] = await pool.query(`
    SELECT a.id as apt_id, a.client_id, a.name as apt_name, c.name as client_name, c.phone 
    FROM appointment a 
    JOIN clients c ON a.client_id = c.id 
    WHERE c.phone != 'WALKIN' 
      AND (a.name = 'Walk-in' OR a.name IS NULL)
    LIMIT 20
  `);
  console.log('Corruption Search:', JSON.stringify(rows));
}
findCorrupt().then(() => process.exit(0));
