import db from './config/database.js';

async function fixCol() {
  try {
    const [rows] = await db.default.query(`SHOW COLUMNS FROM notification_logs WHERE Field = 'notification_type'`);
    console.log('Before:', rows[0].Type);

    // Alter the column to allow the necessary ENUM values
    await db.default.query(`
        ALTER TABLE notification_logs 
        MODIFY COLUMN notification_type ENUM('confirmation', 'reminder', 'cancellation') NOT NULL
    `);
    
    const [rows2] = await db.default.query(`SHOW COLUMNS FROM notification_logs WHERE Field = 'notification_type'`);
    console.log('After:', rows2[0].Type);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

fixCol();
