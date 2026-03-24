import pool from './config/database.js';
import fs from 'fs';

async function desc() {
  try {
    const [rows] = await pool.query('DESCRIBE employee_schedules');
    fs.writeFileSync('desc_schedule.json', JSON.stringify(rows, null, 2));
    console.log("Saved desc_schedule.json");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

desc();
