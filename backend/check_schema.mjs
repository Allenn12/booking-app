import db from './config/database.js';

async function checkSchema() {
  try {
    const [rows] = await db.default.query(`SHOW CREATE TABLE notification_logs`);
    console.log(rows[0]['Create Table']);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkSchema();
