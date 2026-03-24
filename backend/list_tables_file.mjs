import pool from './config/database.js';
import fs from 'fs';

async function listTables() {
  try {
    const [rows] = await pool.query('SHOW TABLES');
    fs.writeFileSync('tables.json', JSON.stringify(rows, null, 2));
    console.log("Saved tables.json");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listTables();
