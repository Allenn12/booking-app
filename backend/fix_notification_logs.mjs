import db from './config/database.js';
async function run() {
  await db.query(`ALTER TABLE notification_logs MODIFY appointment_id INT NULL`);
  await db.query(`ALTER TABLE notification_logs MODIFY user_id INT NULL`);
  console.log('done');
  process.exit();
}
run();
