import pool from './config/database.js';

try {
  // Step 1: Add columns
  await pool.query(`
    ALTER TABLE business
      ADD COLUMN slug VARCHAR(100) NULL UNIQUE AFTER name,
      ADD COLUMN allow_public_booking TINYINT(1) NOT NULL DEFAULT 0 AFTER slug
  `);
  console.log('Step 1: Columns added');

  // Step 2: Backfill slugs
  await pool.query(`
    UPDATE business
      SET slug = CONCAT(
        LOWER(REPLACE(REPLACE(REPLACE(name, ' ', '-'), '.', ''), ',', '')),
        '-',
        id
      )
      WHERE slug IS NULL
  `);
  console.log('Step 2: Slugs backfilled');

  // Step 3: Make slug NOT NULL
  await pool.query(`ALTER TABLE business MODIFY COLUMN slug VARCHAR(100) NOT NULL`);
  console.log('Step 3: slug set to NOT NULL');

  // Step 4: Enable public booking (default was 0) — set to 1 for existing businesses
  await pool.query(`UPDATE business SET allow_public_booking = 1`);
  console.log('Step 4: Public booking enabled for existing businesses');

  // Verify
  const [rows] = await pool.query('SELECT id, name, slug, allow_public_booking FROM business LIMIT 5');
  console.log('Result:', JSON.stringify(rows, null, 2));

  process.exit(0);
} catch (e) {
  console.error('Migration error:', e.message);
  process.exit(1);
}
