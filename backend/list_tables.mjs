import pool from './config/database.js';

async function listTables() {
  try {
    const [rows] = await pool.query('SHOW TABLES');
    console.log("TABLES:", rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listTables();
