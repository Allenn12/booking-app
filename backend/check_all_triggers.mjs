import pool from './config/database.js';
import fs from 'fs';

async function checkAllTriggers() {
  try {
    const [rows] = await pool.query('SHOW TRIGGERS');
    fs.writeFileSync('triggers.json', JSON.stringify(rows, null, 2));
    console.log('Saved triggers to triggers.json', rows.length);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkAllTriggers();
