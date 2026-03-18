import pool from './config/database.js';
async function run() {
  const [camps] = await pool.query('SELECT * FROM campaigns');
  console.log('campaigns:', camps);
  const [rcpts] = await pool.query('SELECT * FROM campaign_recipients');
  console.log('campaign_recipients:', rcpts);
  const [cli] = await pool.query('SELECT * FROM clients WHERE business_id=5 AND name LIKE "%Camp%"');
  console.log('clients:', cli);
  process.exit();
}
run();
