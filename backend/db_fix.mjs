import pool from './config/database.js';

async function debugAndFix() {
  try {
    console.log('--- BEFORE ---');
    const [schemaBefore] = await pool.query(`SHOW CREATE TABLE notification_logs`);
    console.log(schemaBefore[0]['Create Table']);

    console.log('\n--- ALTERING TABLE ---');
    await pool.query(`ALTER TABLE notification_logs MODIFY COLUMN notification_type VARCHAR(50) NOT NULL`);
    console.log('Alter table successful.');

    console.log('\n--- AFTER ---');
    const [schemaAfter] = await pool.query(`SHOW CREATE TABLE notification_logs`);
    console.log(schemaAfter[0]['Create Table']);
  } catch (err) {
    console.error('Fatal Error:', err);
  } finally {
    process.exit(0);
  }
}

debugAndFix();
