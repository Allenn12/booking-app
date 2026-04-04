/**
 * Phase 1 Integration Test — Client Model
 * Tests: getOrCreateWalkIn, search, listByBusiness, getDetailWithHistory, updateNotes, incrementStats
 */
import Client from '../models/Client.js';
import pool from '../config/database.js';

const BUSINESS_ID = 5; // Use an existing business

async function test() {
  let passed = 0;
  let failed = 0;

  function ok(label) { passed++; console.log(`  ✅ ${label}`); }
  function fail(label, err) { failed++; console.error(`  ❌ ${label}:`, err?.message || err); }

  console.log('\n=== Client Model Integration Tests ===\n');

  // 1. getOrCreateWalkIn
  console.log('1. getOrCreateWalkIn');
  try {
    const w1 = await Client.getOrCreateWalkIn(BUSINESS_ID);
    if (!w1 || !w1.id) throw new Error('Walk-in not created');
    ok(`Walk-in id=${w1.id}, name="${w1.name}", phone="${w1.phone}"`);

    // Idempotency
    const w2 = await Client.getOrCreateWalkIn(BUSINESS_ID);
    if (w2.id !== w1.id) throw new Error(`Not idempotent: ${w1.id} vs ${w2.id}`);
    ok('Idempotent (same id returned)');
  } catch (e) { fail('getOrCreateWalkIn', e); }

  // 2. search
  console.log('2. search');
  try {
    const results = await Client.search(BUSINESS_ID, 'a', 5);
    if (!Array.isArray(results)) throw new Error('Expected array');
    // Walk-in should NOT appear
    const hasWalkin = results.some(r => r.phone === 'WALKIN');
    if (hasWalkin) throw new Error('Walk-in appeared in search results');
    ok(`search("a") returned ${results.length} results, no walk-in`);
  } catch (e) { fail('search', e); }

  // 3. listByBusiness
  console.log('3. listByBusiness');
  try {
    const result = await Client.listByBusiness(BUSINESS_ID, { page: 1, limit: 5 });
    if (!result.clients || !result.pagination) throw new Error('Bad structure');
    const hasWalkin = result.clients.some(c => c.phone === 'WALKIN');
    if (hasWalkin) throw new Error('Walk-in in list');
    ok(`list returned ${result.clients.length} clients, total=${result.pagination.total}, no walk-in`);
    // Check no_show_count is present
    if (result.clients.length > 0 && result.clients[0].no_show_count === undefined) {
      throw new Error('no_show_count missing');
    }
    ok('no_show_count field present');
  } catch (e) { fail('listByBusiness', e); }

  // 4. listByBusiness with filters
  console.log('4. filters');
  try {
    const r1 = await Client.listByBusiness(BUSINESS_ID, { filter: 'new' });
    ok(`filter=new → ${r1.clients.length} results`);
    const r2 = await Client.listByBusiness(BUSINESS_ID, { filter: 'frequent' });
    ok(`filter=frequent → ${r2.clients.length} results`);
    const r3 = await Client.listByBusiness(BUSINESS_ID, { filter: 'inactive' });
    ok(`filter=inactive → ${r3.clients.length} results`);
  } catch (e) { fail('filters', e); }

  // 5. getByBusinessAndId
  console.log('5. getByBusinessAndId');
  try {
    const list = await Client.listByBusiness(BUSINESS_ID, { limit: 1 });
    if (list.clients.length > 0) {
      const c = await Client.getByBusinessAndId(BUSINESS_ID, list.clients[0].id);
      if (!c) throw new Error('Not found');
      ok(`getByBusinessAndId(${c.id}) = "${c.name}"`);

      // Cross-tenant: should NOT find a client from business 999
      const cross = await Client.getByBusinessAndId(999, list.clients[0].id);
      if (cross) throw new Error('Cross-tenant leak!');
      ok('Cross-tenant check passed (null returned)');
    } else {
      ok('No clients to test with (skipped)');
    }
  } catch (e) { fail('getByBusinessAndId', e); }

  // 6. getDetailWithHistory
  console.log('6. getDetailWithHistory');
  try {
    const list = await Client.listByBusiness(BUSINESS_ID, { limit: 1 });
    if (list.clients.length > 0) {
      const detail = await Client.getDetailWithHistory(BUSINESS_ID, list.clients[0].id);
      if (!detail) throw new Error('Not found');
      if (!detail.client || !Array.isArray(detail.upcoming) || !Array.isArray(detail.history)) {
        throw new Error('Bad structure');
      }
      ok(`Detail: client="${detail.client.name}", upcoming=${detail.upcoming.length}, history=${detail.history.length}, no_shows=${detail.client.no_show_count}`);
    } else {
      ok('No clients (skipped)');
    }
  } catch (e) { fail('getDetailWithHistory', e); }

  // 7. updateNotes
  console.log('7. updateNotes');
  try {
    const list = await Client.listByBusiness(BUSINESS_ID, { limit: 1 });
    if (list.clients.length > 0) {
      const id = list.clients[0].id;
      const testNote = `Test note ${Date.now()}`;
      await Client.updateNotes(id, testNote, BUSINESS_ID);
      const updated = await Client.getById(id, BUSINESS_ID);
      if (updated.notes !== testNote) throw new Error('Notes not saved');
      ok('updateNotes saved and verified');
      // Restore
      await Client.updateNotes(id, list.clients[0].notes, BUSINESS_ID);
    } else {
      ok('No clients (skipped)');
    }
  } catch (e) { fail('updateNotes', e); }

  // 8. incrementStats
  console.log('8. incrementStats');
  try {
    const list = await Client.listByBusiness(BUSINESS_ID, { limit: 1 });
    if (list.clients.length > 0) {
      const id = list.clients[0].id;
      const before = await Client.getById(id, BUSINESS_ID);
      await Client.incrementStats(id, BUSINESS_ID);
      const after = await Client.getById(id, BUSINESS_ID);
      if (after.total_appointments !== before.total_appointments + 1) {
        throw new Error(`Expected ${before.total_appointments + 1}, got ${after.total_appointments}`);
      }
      ok(`incrementStats: ${before.total_appointments} → ${after.total_appointments}`);
      // Rollback the increment
      await pool.query('UPDATE clients SET total_appointments = ?, last_appointment_at = ? WHERE id = ? AND business_id = ?', 
        [before.total_appointments, before.last_appointment_at, id, BUSINESS_ID]);
    } else {
      ok('No clients (skipped)');
    }
  } catch (e) { fail('incrementStats', e); }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(e => { console.error('FATAL:', e); process.exit(1); });
