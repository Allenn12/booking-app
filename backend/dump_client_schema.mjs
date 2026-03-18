import pool from './config/database.js';
import fs from 'fs';

async function dumpSchemas() {
  let out = '';
  const tables = ['clients', 'appointment'];
  for (const t of tables) {
    try {
      const [rows] = await pool.query(`SHOW CREATE TABLE ${t}`);
      out += `=== ${t} ===\n${rows[0]['Create Table']}\n\n`;
    } catch (e) {
      out += `=== ${t} ERROR: ${e.message} ===\n\n`;
    }
  }
  fs.writeFileSync('client_schemas.txt', out);
  console.log('Done');
  process.exit(0);
}

dumpSchemas();
