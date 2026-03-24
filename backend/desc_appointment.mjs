import pool from './config/database.js';
import fs from 'fs';

async function desc() {
  try {
    const [rows] = await pool.query('DESCRIBE appointment');
    fs.writeFileSync('desc_appointment.json', JSON.stringify(rows, null, 2));
    console.log("Saved desc_appointment.json");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

desc();
