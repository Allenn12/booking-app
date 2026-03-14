import pool from './config/database.js';
import fs from 'fs';

async function debugAndFix() {
  let output = '';
  try {
    output += '--- BEFORE ---\n';
    const [schemaBefore] = await pool.query(`SHOW CREATE TABLE notification_logs`);
    output += schemaBefore[0]['Create Table'] + '\n\n';

    output += '--- ALTERING TABLE ---\n';
    await pool.query(`ALTER TABLE notification_logs MODIFY COLUMN notification_type VARCHAR(50) NOT NULL`);
    output += 'Alter table successful.\n\n';

    output += '--- AFTER ---\n';
    const [schemaAfter] = await pool.query(`SHOW CREATE TABLE notification_logs`);
    output += schemaAfter[0]['Create Table'] + '\n';
  } catch (err) {
    output += 'Fatal Error: ' + err.stack + '\n';
  } finally {
    fs.writeFileSync('db_fix_out.txt', output);
    process.exit(0);
  }
}

debugAndFix();
