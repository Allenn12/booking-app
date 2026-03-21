import pool from './config/database.js';

async function check() {
  const [rows] = await pool.query("SELECT COUNT(*) as count FROM appointment WHERE business_id = 5");
  console.log(`Total appointments for business 5: ${rows[0].count}`);
  const [services] = await pool.query("SELECT name, price FROM services WHERE business_id = 5");
  console.log('Services:', services.map(s => `${s.name} (${s.price}€)`));
  process.exit(0);
}
check();
