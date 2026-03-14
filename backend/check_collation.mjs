import db from './config/database.js';

async function checkCollation() {
  try {
    const [rows] = await db.default.query(`
      SELECT table_name, column_name, character_set_name, collation_name 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
        AND column_name IN ('phone', 'recipient_phone') 
        AND table_name IN ('clients', 'notification_logs')
    `);
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkCollation();
