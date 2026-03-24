import pool from './config/database.js';

async function desc() {
  try {
    const [rows] = await pool.query('DESCRIBE employee_schedules');
    console.log("COLUMNS:", rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

desc();
