import pool from './config/database.js';
import bcrypt from 'bcrypt';

async function prepare() {
  try {
    const hash = await bcrypt.hash('12345678', 10);
    await pool.query('UPDATE user SET password = ?, verification_level = "active" WHERE id = 1', [hash]);
    console.log("Password updated to 12345678 for ID 1 and verified.");

    const [schedules] = await pool.query('SELECT * FROM employee_schedules WHERE user_id = 1');
    console.log("Current schedules for ID 1 count:", schedules.length);
    
    if (schedules.length > 0) {
      await pool.query('DELETE FROM employee_schedules WHERE user_id = 1');
      console.log("Deleted old schedules for clean 1.1 test.");
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

prepare();
