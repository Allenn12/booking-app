import pool from './config/database.js';
import fs from 'fs';

async function checkSchemas() {
  let output = '';
  try {
    const tables = ['credit_transactions', 'appointment_reminders', 'message_templates'];
    for (let t of tables) {
      try {
        const [rows] = await pool.query(`SHOW CREATE TABLE ${t}`);
        output += rows[0]['Create Table'] + '\n\n';
      } catch (e) {
        output += `Table ${t} not found or error: ${e.message}\n\n`;
      }
    }
  } catch (err) {
    output += 'Fatal Error: ' + err.stack + '\n';
  } finally {
    fs.writeFileSync('other_schemas.txt', output);
    process.exit(0);
  }
}

checkSchemas();
