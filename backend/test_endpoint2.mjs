import pool from './config/database.js';

async function test() {
  try {
    console.log('Testing services query...');
    await pool.query('SELECT id FROM services WHERE business_id = 5 AND is_active = 1 LIMIT 1');
    console.log('Services query OK.');
  } catch (error) {
    console.error('Services query failed:', error.message);
  }
  
  try {
    console.log('Testing team query...');
    await pool.query('SELECT u.id FROM user u JOIN user_business ub ON u.id = ub.user_id WHERE ub.business_id = 5');
    console.log('Team query OK.');
  } catch(error) {
    console.error('Team query failed:', error.message);
  }

  process.exit(0);
}

test();
