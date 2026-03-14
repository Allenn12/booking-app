import db from './config/database.js';

async function fixCol() {
  try {
    await db.default.query(`
        ALTER TABLE notification_logs 
        MODIFY COLUMN notification_type VARCHAR(50) NOT NULL
    `);
    console.log('Successfully changed notification_type to VARCHAR(50)');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

fixCol();
