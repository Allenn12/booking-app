import pool from './config/database.js';
async function test() {
  const [clients] = await pool.query("SELECT id, name FROM clients WHERE phone != 'WALKIN' LIMIT 5");
  for (const c of clients) {
    const [history] = await pool.query(`
      SELECT a.id, a.client_id, a.name as apt_name
      FROM appointment a
      WHERE a.client_id = ?
        AND (a.appointment_datetime < NOW() OR a.status IN ('cancelled', 'no_show', 'completed'))
        AND a.deleted_at IS NULL
    `, [c.id]);
    console.log(`History for ${c.name} (ID ${c.id}):`, history.length, 'rows');
    const anomalies = history.filter(h => h.client_id !== c.id);
    if (anomalies.length > 0) console.log('!!! ANOMALIES FOUND:', JSON.stringify(anomalies));
  }
}
test().then(() => process.exit(0));
