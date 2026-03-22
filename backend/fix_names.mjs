import pool from './config/database.js';

async function backfill() {
  try {
    console.log('🔄 Starting appointment name backfill...');
    
    // Find all appointments that have a client_id but the name column is NULL or empty
    const [rows] = await pool.query(`
      UPDATE appointment a
      JOIN clients c ON a.client_id = c.id
      SET a.name = c.name
      WHERE (a.name IS NULL OR a.name = '')
    `);
    
    console.log(`✅ Backfill complete! Updated ${rows.affectedRows} appointments.`);
    
    // Also, ensure WALKIN phone clients are correctly named in appointments
    const [walkinRows] = await pool.query(`
      UPDATE appointment a
      JOIN clients c ON a.client_id = c.id
      SET a.name = 'Walk-in'
      WHERE c.phone = 'WALKIN' AND (a.name != 'Walk-in' OR a.name IS NULL)
    `);
    console.log(`✅ Walk-in labeling sync complete! Updated ${walkinRows.affectedRows} walk-in records.`);

  } catch (err) {
    console.error('❌ Backfill failed:', err);
  } finally {
    process.exit(0);
  }
}

backfill();
