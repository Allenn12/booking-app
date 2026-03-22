import pool from './config/database.js';
async function getUrl() {
  const [rows] = await pool.query(`
    SELECT a.business_id, a.client_id, c.name, c.phone 
    FROM appointment a 
    JOIN clients c ON a.client_id = c.id 
    WHERE c.phone != 'WALKIN' 
    LIMIT 1
  `);
  console.log('Target URL Data:', JSON.stringify(rows[0]));
}
getUrl().then(() => process.exit(0));
