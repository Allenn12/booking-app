import pool from './config/database.js';

async function testInsert() {
  try {
    const [apps] = await pool.query('SELECT id, business_id, client_id FROM appointment LIMIT 1');
    if (apps.length === 0) {
      console.log('No appointments exist to use for FK.');
      return;
    }
    const app = apps[0];
    
    // We need a user_id, let's grab the owner of the business or just any user
    const [users] = await pool.query('SELECT id FROM user LIMIT 1');
    const user_id = users[0].id;
    
    const type = 'confirmation';
    const phone = '+385989168650';
    const message = 'Test message parameter';
    const status = 'sent';
    const failedReason = null;

    const sql = `INSERT INTO notification_logs (business_id, appointment_id, user_id, notification_type, channel, recipient_phone, message_text, status, sent_at, failed_reason) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`;
    
    console.log('Running parameterized test insert...');
    const [result] = await pool.query(sql, [
          app.business_id, 
          app.id, 
          user_id, 
          type, 
          'sms', 
          phone, 
          message, 
          status, 
          failedReason
      ]);
    console.log('Insert successful!', result);
  } catch (err) {
    console.error('Insert Failed:', err);
  } finally {
    process.exit(0);
  }
}

testInsert();
