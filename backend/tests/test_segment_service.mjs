import pool from '../config/database.js';
import SegmentService from '../services/SegmentService.js';
import Client from '../models/Client.js';
import Appointment from '../models/Appointment.js';

const BUSINESS_ID = 5;

async function setupTestData() {
  await pool.query('DELETE FROM campaign_recipients WHERE client_id IN (SELECT id FROM clients WHERE business_id = ?)', [BUSINESS_ID]);
  await pool.query('DELETE FROM appointment WHERE business_id = ?', [BUSINESS_ID]);
  await pool.query('DELETE FROM clients WHERE business_id = ?', [BUSINESS_ID]);

  // Create test clients
  const cAll = await Client.create(BUSINESS_ID, { name: 'CAll', phone: '1111111' });
  
  // Frequent
  const cFreq = await Client.create(BUSINESS_ID, { name: 'CFreq', phone: '2222222' });
  await pool.query('UPDATE clients SET total_appointments = 6 WHERE id = ?', [cFreq]);

  // Lapsed (has visit 100 days ago)
  const cLapsed = await Client.create(BUSINESS_ID, { name: 'CLapsed', phone: '3333333' });
  await pool.query('UPDATE clients SET total_appointments = 1, last_appointment_at = DATE_SUB(NOW(), INTERVAL 100 DAY), created_at = DATE_SUB(NOW(), INTERVAL 100 DAY) WHERE id = ?', [cLapsed]);

  // New (created 10 days ago, total 1)
  const cNew = await Client.create(BUSINESS_ID, { name: 'CNew', phone: '4444444' });
  await pool.query('UPDATE clients SET total_appointments = 1, created_at = DATE_SUB(NOW(), INTERVAL 10 DAY) WHERE id = ?', [cNew]);

  // Upcoming (has scheduled appointment tomorrow)
  const cUpcoming = await Client.create(BUSINESS_ID, { name: 'CUp', phone: '5555555' });
  await pool.query("INSERT INTO appointment (business_id, client_id, service_id, assigned_to_user_id, appointment_datetime, status) VALUES (?, ?, 1, 1, DATE_ADD(NOW(), INTERVAL 1 DAY), 'scheduled')", [BUSINESS_ID, cUpcoming]);

  // Opt-out
  const cOptOut = await Client.create(BUSINESS_ID, { name: 'COptOut', phone: '6666666' });
  await pool.query('UPDATE clients SET marketing_opt_out = 1 WHERE id = ?', [cOptOut]);

  // Walk-in
  await Client.getOrCreateWalkIn(BUSINESS_ID);

  return { cAll, cFreq, cLapsed, cNew, cUpcoming, cOptOut };
}

async function run() {
  let passed = 0, failed = 0;
  const ok = msg => { passed++; console.log('✅ ' + msg); };
  const fail = (msg, err) => { failed++; console.error('❌ ' + msg, err); };

  try {
    const ids = await setupTestData();

    // 1. All Clients
    let segAll = await SegmentService.getClientIdsForSegment(BUSINESS_ID, { type: 'all_clients' });
    if (segAll.includes(ids.cOptOut)) throw new Error('Included opt-out');
    if (segAll.includes('WALKIN' /* fake ID for walkin depending on implementation*/)) throw new Error('Included WALKIN');
    if (!segAll.includes(ids.cAll) || !segAll.includes(ids.cFreq)) throw new Error('Missing general clients');
    ok('all_clients evaluated correctly');

    // 2. Lapsed
    let segLapsed = await SegmentService.getClientIdsForSegment(BUSINESS_ID, { type: 'lapsed', rules: { lapsed_days: 90 } });
    if (!segLapsed.includes(ids.cLapsed)) throw new Error('Missing lapsed client');
    if (segLapsed.includes(ids.cAll) || segLapsed.includes(ids.cFreq)) throw new Error('Included active or new clients');
    ok('lapsed evaluated correctly');

    // 3. Frequent
    let segFreq = await SegmentService.getClientIdsForSegment(BUSINESS_ID, { type: 'frequent', rules: { min_visits: 5 } });
    if (!segFreq.includes(ids.cFreq)) throw new Error('Missing frequent client');
    if (segFreq.includes(ids.cAll) || segFreq.includes(ids.cLapsed)) throw new Error('Included infrequent clients');
    ok('frequent evaluated correctly');

    // 4. New Clients
    let segNew = await SegmentService.getClientIdsForSegment(BUSINESS_ID, { type: 'new_clients', rules: { within_days: 30 } });
    if (!segNew.includes(ids.cNew)) throw new Error('Missing new client');
    // cLapsed might not be counted depending on how we set created_at, but we set cNew to 10 days ago.
    if (segNew.includes(ids.cLapsed)) throw new Error('Included old client');
    ok('new_clients evaluated correctly');

    // 5. Upcoming
    let segUp = await SegmentService.getClientIdsForSegment(BUSINESS_ID, { type: 'upcoming', rules: { next_days: 3 } });
    if (!segUp.includes(ids.cUpcoming)) throw new Error('Missing upcoming client');
    if (segUp.includes(ids.cAll)) throw new Error('Included client without appointments');
    ok('upcoming evaluated correctly');
    
  } catch (err) {
    console.error(err);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
