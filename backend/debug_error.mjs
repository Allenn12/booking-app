import pool from './config/database.js';
async function run() {
  const [rcpts] = await pool.query("SELECT * FROM campaign_recipients WHERE error_message IS NOT NULL LIMIT 1");
  console.log(JSON.stringify(rcpts, null, 2));
  process.exit();
}
run();
