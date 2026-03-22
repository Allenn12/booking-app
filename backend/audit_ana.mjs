import pool from './config/database.js';
async function audit() {
  const [rows] = await pool.query('SELECT a.*, c.name as client_name FROM appointment a JOIN clients c ON a.client_id = c.id WHERE c.name = ?', ['Ana Horvat']);
  console.log('Appointments for Ana Horvat:', rows.length);
  if (rows.length > 0) {
    console.log('Sample:', JSON.stringify(rows[0]));
  }
}
audit().then(() => process.exit(0));
