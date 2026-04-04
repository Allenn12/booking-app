import pool from '../config/database.js';

async function migrate_one_by_one() {
  const conn = await pool.getConnection();
  const queries = [
    'ALTER TABLE business ADD COLUMN description TEXT',
    'ALTER TABLE business ADD COLUMN logo_url VARCHAR(500)',
    'ALTER TABLE business ADD COLUMN cover_image_url VARCHAR(500)',
    'ALTER TABLE business ADD COLUMN instagram_url VARCHAR(255)',
    'ALTER TABLE business ADD COLUMN facebook_url VARCHAR(255)',
    'ALTER TABLE business ADD COLUMN currency CHAR(3) DEFAULT "EUR"',
    'ALTER TABLE business ADD COLUMN timezone VARCHAR(50) DEFAULT "Europe/Zagreb"',
    'ALTER TABLE clients ADD COLUMN sms_marketing_consent BOOLEAN DEFAULT FALSE',
    'ALTER TABLE clients ADD COLUMN consent_given_at DATETIME',
    'ALTER TABLE clients ADD COLUMN consent_source ENUM("booking_form", "import", "manual", "api")'
  ];

  for (const q of queries) {
    try {
      await conn.query(q);
      console.log(`✅ ${q} - Success`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log(`⚠️ ${q} - Already exists`);
      } else {
        console.error(`❌ ${q} - Failed:`, err.message);
      }
    }
  }
  conn.release();
  process.exit(0);
}

migrate_one_by_one();
