import db from './config/database.js';

async function migrate() {
  try {
    console.log('Running business table alterations...');
    await db.query(`
      ALTER TABLE business
      ADD COLUMN sms_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN send_confirmation BOOLEAN DEFAULT TRUE,
      ADD COLUMN send_reminder BOOLEAN DEFAULT TRUE,
      ADD COLUMN send_cancellation BOOLEAN DEFAULT TRUE;
    `);
    console.log('Added toggles to business.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Columns already exist in business table.');
    } else {
      console.error(err);
    }
  }

  try {
    console.log('Creating message_templates table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS message_templates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          business_id INT NOT NULL,
          type ENUM('confirmation', 'reminder', 'cancellation') NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_business_type (business_id, type),
          FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE CASCADE
      );
    `);
    console.log('Created message_templates.');
  } catch (err) {
    console.error(err);
  }

  process.exit(0);
}

migrate();
