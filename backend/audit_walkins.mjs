import pool from './config/database.js';
async function audit() {
  const [apts] = await pool.query(`
    SELECT a.id as apt_id, a.client_id, a.name as apt_name, c.name as client_name, c.phone as client_phone, a.business_id
    FROM appointment a
    LEFT JOIN clients c ON a.client_id = c.id
    WHERE a.name = 'Walk-in' OR c.phone = 'WALKIN'
  `);
  console.log('--- Walk-in Audit ---');
  for (const a of apts) {
    console.log(`Apt ${a.apt_id} (Biz ${a.business_id}): client_id=${a.client_id}, name_in_apt='${a.apt_name}', client_name='${a.client_name}', client_phone='${a.client_phone}'`);
  }
}
audit().then(() => process.exit(0));
