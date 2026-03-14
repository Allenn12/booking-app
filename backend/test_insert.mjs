import pool from './config/database.js';

async function testInsert() {
  try {
    const sql = `INSERT INTO notification_logs (business_id, appointment_id, user_id, notification_type, channel, recipient_phone, message_text, status, sent_at, failed_reason) 
                 VALUES (5, 32, 14, 'confirmation', 'sms', '+385989168650', 'Test message', 'sent', NOW(), NULL)`;
    
    console.log('Running test insert...');
    const [result] = await pool.query(sql);
    console.log('Insert successful!', result);
  } catch (err) {
    console.error('Insert Failed:', err);
  } finally {
    process.exit(0);
  }
}

testInsert();
