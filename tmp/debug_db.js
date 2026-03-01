import pool from '../backend/config/database.js';

async function debug() {
    try {
        console.log('--- Invitations ---');
        const [invites] = await pool.query('SELECT * FROM invitations');
        console.log(JSON.stringify(invites, null, 2));

        console.log('\n--- User Businesses ---');
        const [ub] = await pool.query('SELECT * FROM user_business');
        console.log(JSON.stringify(ub, null, 2));

        console.log('\n--- Businesses ---');
        const [biz] = await pool.query('SELECT * FROM business');
        console.log(JSON.stringify(biz, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

debug();
