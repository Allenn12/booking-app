import fs from 'fs';
import pool from './config/database.js';
async function run() {
  const [cols] = await pool.query('SHOW COLUMNS FROM services');
  const [ubCols] = await pool.query('SHOW COLUMNS FROM user_business');
  fs.writeFileSync('schema2.json', JSON.stringify({services: cols.map(c => c.Field), user_business: ubCols.map(c => c.Field)}));
  process.exit(0);
}
run();
