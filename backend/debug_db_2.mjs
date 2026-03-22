import pool from './config/database.js';
async function examineBatch() {
  const [rows] = await pool.query('SELECT a.id, a.client_id, a.name, a.business_id, c.name as client_name FROM appointment a JOIN clients c ON a.client_id = c.id WHERE a.deleted_at IS NULL LIMIT 20');
  console.log('Sample Appointments:', JSON.stringify(rows));
  
  const [walkins] = await pool.query("SELECT id, name FROM clients WHERE phone = 'WALKIN'");
  console.log('Walk-in Client Records:', JSON.stringify(walkins));
  
  for (const w of walkins) {
    const [wApts] = await pool.query('SELECT id, name FROM appointment WHERE client_id = ?', [w.id]);
    console.log(`Appointments for Walk-in Client ${w.id} (${w.name}):`, wApts.length);
  }
}
examineBatch().then(() => process.exit(0));
