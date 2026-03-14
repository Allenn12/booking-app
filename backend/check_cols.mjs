import pool from './config/database.js';

async function checkCols() {
  try {
    const [rows] = await pool.query(`
      SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, COLUMN_TYPE 
      FROM information_schema.COLUMNS 
      WHERE COLUMN_NAME = 'notification_type'
    `);
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkCols();
