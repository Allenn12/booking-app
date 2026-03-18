import pool from '../config/database.js';
import '../workers/automationWorker.js';

// We just start it and let it run immediately by mocking the cron trigger?
// Since it's attached to cron, we just run a similar loop to ensure no syntax errors 

async function run() {
    console.log('Testing automationWorker manual pass...');
    try {
        const [automations] = await pool.query(`SELECT * FROM automations WHERE status = 'enabled'`);
        console.log(`Found ${automations.length}`);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
    process.exit(0);
}

run();
