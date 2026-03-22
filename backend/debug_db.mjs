import pool from './config/database.js';
const [rows] = await pool.query('SELECT id, name, phone FROM clients WHERE phone = ?', ['WALKIN']);
console.log('Walk-in Clients:', JSON.stringify(rows));
const [aptRows] = await pool.query('SELECT id, client_id, name FROM appointment WHERE client_id IN (SELECT id FROM clients WHERE phone = ?)', ['WALKIN']);
console.log('Walk-in Appointments (first 5):', JSON.stringify(aptRows.slice(0, 5)));
const [allApts] = await pool.query('SELECT COUNT(*) AS total FROM appointment');
console.log('Total Appointments:', allApts[0].total);
process.exit(0);
