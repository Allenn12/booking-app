import pool from '../config/database.js';

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('Running B1 Business Profile migration...');
    const addBusinessColumns = `
      ALTER TABLE business 
      ADD COLUMN description TEXT NULL,
      ADD COLUMN logo_url VARCHAR(500) NULL,
      ADD COLUMN cover_image_url VARCHAR(500) NULL,
      ADD COLUMN instagram_url VARCHAR(255) NULL,
      ADD COLUMN facebook_url VARCHAR(255) NULL,
      ADD COLUMN currency CHAR(3) DEFAULT 'EUR',
      ADD COLUMN timezone VARCHAR(50) DEFAULT 'Europe/Zagreb';
    `;
    await conn.query(addBusinessColumns);
    console.log('✅ Added business profile columns successfully.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️ Columns already exist in business table.');
    } else {
      console.error('❌ Failed to add business columns:', err);
    }
  }

  try {
    console.log('Running B5 GDPR Consent migration...');
    const addClientColumns = `
      ALTER TABLE clients
      ADD COLUMN sms_marketing_consent BOOLEAN DEFAULT FALSE,
      ADD COLUMN consent_given_at DATETIME NULL,
      ADD COLUMN consent_source ENUM('booking_form', 'import', 'manual', 'api') NULL;
    `;
    await conn.query(addClientColumns);
    console.log('✅ Added clients GDPR consent columns successfully.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️ Columns already exist in clients table.');
    } else {
      console.error('❌ Failed to add client columns:', err);
    }
  }

  conn.release();
  process.exit(0);
}

migrate();
