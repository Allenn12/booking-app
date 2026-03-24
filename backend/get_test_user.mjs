import pool from './config/database.js';

async function getUsers() {
  try {
    const [users] = await pool.query('SELECT DISTINCT u.email, u.id FROM user u JOIN user_business ub ON u.id = ub.user_id WHERE ub.role IN ("owner", "admin") LIMIT 1');
    console.log("TEST_USER_CREDS:", users[0]);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

getUsers();
