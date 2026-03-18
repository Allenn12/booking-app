import pool from '../config/database.js';
import CampaignService from '../services/CampaignService.js';
import Client from '../models/Client.js';
import Business from '../models/Business.js';

const BUSINESS_ID = 5;

async function setup() {
  await pool.query('DELETE FROM campaign_recipients');
  await pool.query('DELETE FROM campaigns');
  await pool.query('DELETE FROM segments WHERE business_id = ?', [BUSINESS_ID]);
  await pool.query('DELETE FROM clients WHERE business_id = ?', [BUSINESS_ID]);

  // Give business enough credits
  await pool.query('UPDATE business SET sms_enabled=1, sms_credits=100 WHERE id=?', [BUSINESS_ID]);

  // Add 3 clients
  const c1 = await Client.create(BUSINESS_ID, { name: 'CampC1', phone: '00111' });
  const c2 = await Client.create(BUSINESS_ID, { name: 'CampC2', phone: '00222' });
  const c3 = await Client.create(BUSINESS_ID, { name: 'CampC3', phone: '00333' });

  // Create segment "all_clients"
  const [segRes] = await pool.query("INSERT INTO segments (business_id, name, type) VALUES (?, 'Test All', 'all_clients')", [BUSINESS_ID]);
  const segId = segRes.insertId;

  return { c1, c2, c3, segId };
}

async function run() {
  let passed = 0, failed = 0;
  const ok = msg => { passed++; console.log('✅ ' + msg); };
  const fail = (msg, err) => { failed++; console.error('❌ ' + msg, err); };

  try {
    const { segId } = await setup();

    // 1. Create
    console.log('1. createCampaign');
    const camp = await CampaignService.createCampaign(BUSINESS_ID, 1, {
      name: 'Test Promo',
      channel: 'sms',
      segment_id: segId,
      inline_message: 'Hello {{clientName}}'
    });
    if (!camp || !camp.id) throw new Error('Not created');
    if (camp.status !== 'draft') throw new Error('Not draft');
    ok('Created campaign');

    // 2. Preview
    console.log('2. previewRecipients');
    const preview = await CampaignService.previewRecipients(camp.id);
    if (!preview || preview.count !== 3) throw new Error('Count should be 3');
    if (preview.sample.length !== 3) throw new Error('Sample should have 3 clients');
    ok('Preview returned correct count and sample');

    // 3. scheduleCampaign
    console.log('3. scheduleCampaign');
    await CampaignService.scheduleCampaign(camp.id, new Date(Date.now() + 100000));
    const [cRows] = await pool.query('SELECT status, scheduled_at FROM campaigns WHERE id=?', [camp.id]);
    if (cRows[0].status !== 'scheduled') throw new Error('Status not scheduled');
    if (!cRows[0].scheduled_at) throw new Error('No scheduled_at');
    ok('Campaign scheduled');

    // 4. cancelCampaign
    console.log('4. cancelCampaign');
    await CampaignService.cancelCampaign(camp.id);
    const [cRows2] = await pool.query('SELECT status FROM campaigns WHERE id=?', [camp.id]);
    if (cRows2[0].status !== 'cancelled') throw new Error('Status not cancelled');
    ok('Campaign cancelled');

    // 5. sendNow
    console.log('5. sendNow (processCampaign)');
    const camp2 = await CampaignService.createCampaign(BUSINESS_ID, 1, {
      name: 'Test Send',
      channel: 'sms',
      segment_id: segId,
      inline_message: 'Promo for {{clientName}}'
    });

    await CampaignService.sendNow(camp2.id); // This validates draft, sets running, then processes synchronously in our mock/simple setup or we await processCampaign
    
    // sendNow might be async in reality to avoid blocking, but processCampaign does the work.
    // For TDD, let's call processCampaign directly to await it.
    await CampaignService.processCampaign(camp2.id);

    const [cRows3] = await pool.query('SELECT status, sent_count, failed_count FROM campaigns WHERE id=?', [camp2.id]);
    if (cRows3[0].status !== 'completed') throw new Error('Status not completed');
    if (cRows3[0].sent_count !== 3) throw new Error('Did not send to 3 clients');
    
    const [rcpt] = await pool.query('SELECT * FROM campaign_recipients WHERE campaign_id=?', [camp2.id]);
    if (rcpt.length !== 3) throw new Error('Recipients not logged');
    
    const [logs] = await pool.query("SELECT * FROM notification_logs WHERE source='campaign' AND source_id=?", [camp2.id]);
    if (logs.length !== 3) throw new Error('Notif logs missing');
    ok('Campaign processed and sent via NotificationService');

  } catch (err) {
    console.error(err);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
