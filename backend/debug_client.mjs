import pool from './config/database.js';

async function findClient() {
  const [rows] = await pool.query("SELECT id, name FROM clients WHERE name = 'Test Client 2'");
  console.log('Client Search:', JSON.stringify(rows));
  process.exit(0);
}

findClient();
