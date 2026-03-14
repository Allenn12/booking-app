import pool from './config/database.js';

async function checkTriggers() {
  try {
    const [rows] = await pool.query(`SHOW TRIGGERS WHERE Event_object_table = 'notification_logs'`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkTriggers();
