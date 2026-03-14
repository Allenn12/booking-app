import fs from 'fs';
import pool from './config/database.js';
import Business from './models/Business.js';
import BusinessHour from './models/BusinessHour.js';

async function test() {
  let log = [];
  try {
    const slug = 'salon-lucija-premium-5';
    log.push('Fetching business by slug: ' + slug);
    const business = await Business.findBySlug(slug);
    log.push('Business ID: ' + business?.id);

    log.push('Fetching services...');
    await pool.query(
        'SELECT id, name, duration_minutes, price FROM services WHERE business_id = ? AND is_active = 1 ORDER BY name',
        [business.id]
    );

    log.push('Fetching team...');
    await pool.query(
        `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name 
         FROM user u 
         JOIN user_business ub ON u.id = ub.user_id 
         WHERE ub.business_id = ?
         ORDER BY u.first_name, u.last_name`,
        [business.id]
    );

    log.push('Fetching hours...');
    await BusinessHour.getByBusinessId(business.id);

    log.push('All DB queries succeeded.');
  } catch (error) {
    log.push('Error caught: ' + error.message);
    log.push(error.stack);
  } finally {
    fs.writeFileSync('error.json', JSON.stringify(log, null, 2), 'utf8');
    process.exit(0);
  }
}

test();
