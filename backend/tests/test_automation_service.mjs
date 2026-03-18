import pool from '../config/database.js';
import AutomationService from '../services/AutomationService.js';
import Client from '../models/Client.js';
import Business from '../models/Business.js';

const BUSINESS_ID = 5;

async function setupTestData() {
  await pool.query('DELETE FROM automation_logs');
  await pool.query('DELETE FROM automations');
  await pool.query('DELETE FROM appointment WHERE business_id = ?', [BUSINESS_ID]);
  await pool.query('DELETE FROM clients WHERE business_id = ?', [BUSINESS_ID]);

  // Give business enough credits
  await pool.query('UPDATE business SET sms_enabled=1, sms_credits=100 WHERE id=?', [BUSINESS_ID]);

  // 1. Post-visit client (appt 2h ago)
  const cPost = await Client.create(BUSINESS_ID, { name: 'PostV', phone: '1001' });
  const [apptRes] = await pool.query(`
    INSERT INTO appointment (business_id, client_id, service_id, assigned_to_user_id, appointment_datetime, status) 
    VALUES (?, ?, 1, 1, DATE_SUB(NOW(), INTERVAL 2 HOUR), 'completed')`, 
    [BUSINESS_ID, cPost]);
  const apptId = apptRes.insertId;

  // 2. Birthday client (birthday is today)
  const cBday = await Client.create(BUSINESS_ID, { name: 'BdayC', phone: '1002' });
  await pool.query('UPDATE clients SET birth_date = CURDATE() WHERE id = ?', [cBday]);

  // 3. Lapsed client (last appt 95 days ago)
  const cLapsed = await Client.create(BUSINESS_ID, { name: 'LapsedC', phone: '1003' });
  await pool.query('UPDATE clients SET total_appointments = 1, last_appointment_at = DATE_SUB(NOW(), INTERVAL 95 DAY) WHERE id = ?', [cLapsed]);


  return { cPost, apptId, cBday, cLapsed };
}

async function run() {
  let passed = 0, failed = 0;
  const ok = msg => { passed++; console.log('✅ ' + msg); };
  const fail = (msg, err) => { failed++; console.error('❌ ' + msg, err); };

  try {
    const ids = await setupTestData();

    // -- POST VISIT --
    const [auto1Res] = await pool.query(`INSERT INTO automations (business_id, name, type, status, channel, inline_message, config) VALUES (?, 'PV', 'post_visit', 'enabled', 'sms', 'Hope u liked it {{clientName}}', '{"delay_hours":1}')`, [BUSINESS_ID]);
    const pvAutoId = auto1Res.insertId;

    let pvTargets = await AutomationService.evaluatePostVisit({id: pvAutoId, business_id: BUSINESS_ID, config: {delay_hours: 1}});
    if (pvTargets.length !== 1 || pvTargets[0].clientId !== ids.cPost || pvTargets[0].appointmentId !== ids.apptId) {
        throw new Error('Post-visit evaluation failed to find correct target');
    }
    ok('evaluatePostVisit correctly found target');

    await AutomationService.sendToClient({id: pvAutoId, business_id: BUSINESS_ID, inline_message: 'Hi'}, ids.cPost, ids.apptId);
    
    // Evaluate again should return 0 (due to dedup)
    pvTargets = await AutomationService.evaluatePostVisit({id: pvAutoId, business_id: BUSINESS_ID, config: {delay_hours: 1}});
    if (pvTargets.length !== 0) throw new Error('Post-visit dedup failed');
    ok('evaluatePostVisit dedup works');


    // -- BIRTHDAY --
    const [auto2Res] = await pool.query(`INSERT INTO automations (business_id, name, type, status, channel, inline_message, config) VALUES (?, 'BD', 'birthday', 'enabled', 'sms', 'Happy Bday {{clientName}}', '{"send_hour":9}')`, [BUSINESS_ID]);
    const bdAutoId = auto2Res.insertId;

    let bdTargets = await AutomationService.evaluateBirthday({id: bdAutoId, business_id: BUSINESS_ID, config: {}});
    if (bdTargets.length !== 1 || bdTargets[0] !== ids.cBday) {
        throw new Error('Birthday evaluation failed');
    }
    ok('evaluateBirthday correctly found target');

    await AutomationService.sendToClient({id: bdAutoId, business_id: BUSINESS_ID, inline_message: 'Hi'}, ids.cBday);

    bdTargets = await AutomationService.evaluateBirthday({id: bdAutoId, business_id: BUSINESS_ID, config: {}});
    if (bdTargets.length !== 0) throw new Error('Birthday dedup failed');
    ok('evaluateBirthday dedup works');


    // -- LAPSED --
    const [auto3Res] = await pool.query(`INSERT INTO automations (business_id, name, type, status, channel, inline_message, config) VALUES (?, 'LP', 'lapsed_clients', 'enabled', 'sms', 'Come back {{clientName}}', '{"lapsed_days":90, "cooldown_days":60}')`, [BUSINESS_ID]);
    const lpAutoId = auto3Res.insertId;

    let lpTargets = await AutomationService.evaluateLapsed({id: lpAutoId, business_id: BUSINESS_ID, config: {lapsed_days: 90, cooldown_days: 60}});
    if (lpTargets.length !== 1 || lpTargets[0] !== ids.cLapsed) {
        throw new Error('Lapsed evaluation failed');
    }
    ok('evaluateLapsed correctly found target');

    await AutomationService.sendToClient({id: lpAutoId, business_id: BUSINESS_ID, inline_message: 'Hi'}, ids.cLapsed);

    lpTargets = await AutomationService.evaluateLapsed({id: lpAutoId, business_id: BUSINESS_ID, config: {lapsed_days: 90, cooldown_days: 60}});
    if (lpTargets.length !== 0) throw new Error('Lapsed dedup failed (within cooldown)');
    ok('evaluateLapsed dedup works');

  } catch (err) {
    console.error(err);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
