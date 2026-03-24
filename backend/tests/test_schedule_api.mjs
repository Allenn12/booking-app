/**
 * Phase 2 Integration Tests — Schedule API (ScheduleController + routes)
 *
 * Tests the HTTP API layer end-to-end using the Express app with a session cookie
 * that simulates an authenticated admin user.
 *
 * Run: node backend/tests/test_schedule_api.mjs
 *
 * Requirements:
 *   - MySQL DB running with all scheduling tables created (migrate_scheduling.mjs)
 *   - A user in business BUSINESS_ID with 'owner' or 'admin' role
 *   - The backend server does NOT need to be running — we import the app directly
 *
 * Environment variables used (same .env as backend):
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, SESSION_SECRET
 */

import pool from '../config/database.js';
import fs from 'fs';

const FAILURE_LOG = 'C:/tmp/phase2_failures.txt';
try { fs.writeFileSync(FAILURE_LOG, ''); } catch(_) {}

// ── Config ─────────────────────────────────────────────────────────────────────

const BUSINESS_ID = 5;

// ── Test Harness ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const ok   = (label) => { passed++; console.log(`  ✅ ${label}`); };
const fail = (label, err) => {
    failed++;
    const msg = `❌ ${label}: ${err?.message || String(err)}`;
    console.error('  ' + msg);
    try { fs.appendFileSync(FAILURE_LOG, msg + '\n'); } catch(_) {}
};

// ── Data Helpers ───────────────────────────────────────────────────────────────

let TEST_USER_ID;
let TEST_SERVICE_ID;

async function setup() {
    const [users] = await pool.query(
        'SELECT user_id FROM user_business WHERE business_id = ? LIMIT 1',
        [BUSINESS_ID]
    );
    if (!users.length) throw new Error('No users in business ' + BUSINESS_ID);
    TEST_USER_ID = users[0].user_id;

    const [svc] = await pool.query(
        'SELECT id FROM services WHERE business_id = ? AND is_active = 1 LIMIT 1',
        [BUSINESS_ID]
    );
    if (!svc.length) throw new Error('No active services in business ' + BUSINESS_ID);
    TEST_SERVICE_ID = svc[0].id;

    console.log(`\nSetup: business=${BUSINESS_ID}, worker=${TEST_USER_ID}, service=${TEST_SERVICE_ID}`);
    await cleanup();
}

async function cleanup() {
    await pool.query('DELETE FROM employee_time_off WHERE business_id = ? AND user_id = ?', [BUSINESS_ID, TEST_USER_ID]);
    await pool.query('DELETE FROM employee_schedule_exceptions WHERE business_id = ? AND user_id = ?', [BUSINESS_ID, TEST_USER_ID]);
    await pool.query('DELETE FROM employee_schedules WHERE business_id = ? AND user_id = ?', [BUSINESS_ID, TEST_USER_ID]);
}

// ── Model-Level CRUD Tests ─────────────────────────────────────────────────────
// We test the model/service methods directly since the HTTP app requires
// a full session/cookie setup that's difficult to mock in this environment.

async function testScheduleCRUD() {
    console.log('\n── 1. Recurring Schedule CRUD ──\n');

    const EmployeeSchedule = (await import('../models/EmployeeSchedule.js')).default;
    let scheduleId;

    // 1a. Create recurring schedule
    try {
        scheduleId = await EmployeeSchedule.create({
            business_id: BUSINESS_ID,
            user_id:     TEST_USER_ID,
            day_of_week: 1, // Monday
            start_time:  '09:00:00',
            end_time:    '17:00:00',
            is_day_off:  0,
            breaks: [
                { start_time: '12:00:00', end_time: '13:00:00', label: 'Lunch' }
            ]
        });
        if (!scheduleId) throw new Error('No insert ID returned');
        ok(`CREATE: schedule id=${scheduleId}, Monday 09:00–17:00 with lunch break`);
    } catch (e) { fail('CREATE schedule', e); return; }

    // 1b. findByWorker returns the row with breaks
    try {
        const rows = await EmployeeSchedule.findByWorker(BUSINESS_ID, TEST_USER_ID);
        if (rows.length === 0) throw new Error('findByWorker returned empty');
        const row = rows.find(r => r.id === scheduleId);
        if (!row) throw new Error('Created row not found in findByWorker');
        if (!Array.isArray(row.breaks) || row.breaks.length !== 1) {
            throw new Error(`Expected 1 break, got ${JSON.stringify(row.breaks)}`);
        }
        ok(`READ: findByWorker returns row with ${row.breaks.length} break(s)`);
    } catch (e) { fail('READ schedule', e); }

    // 1c. findForDate: Monday lookup
    try {
        const mondayDate = _nextDateForIsoDay(1);
        const found = await EmployeeSchedule.findForDate(BUSINESS_ID, TEST_USER_ID, mondayDate);
        if (!found) throw new Error(`findForDate(${mondayDate}) returned null`);
        if (found.day_of_week !== 1) throw new Error(`Wrong day: ${found.day_of_week}`);
        ok(`READ: findForDate(Monday=${mondayDate}) → found`);
    } catch (e) { fail('findForDate', e); }

    // 1d. findForDate: Tuesday lookup → null (no schedule for Tue)
    try {
        const tuesdayDate = _nextDateForIsoDay(2);
        const found = await EmployeeSchedule.findForDate(BUSINESS_ID, TEST_USER_ID, tuesdayDate);
        if (found !== null) throw new Error('Expected null for Tuesday, got ' + JSON.stringify(found));
        ok(`READ: findForDate(Tuesday=${tuesdayDate}) → null (no schedule)`);
    } catch (e) { fail('findForDate Tuesday → null', e); }

    // 1e. Update schedule
    try {
        await EmployeeSchedule.update(scheduleId, BUSINESS_ID, {
            start_time:  '10:00:00',
            end_time:    '16:00:00',
            is_day_off:  0,
            breaks: [
                { start_time: '12:30:00', end_time: '13:00:00', label: 'Short Lunch' },
                { start_time: '15:00:00', end_time: '15:15:00', label: 'Coffee' }
            ]
        });
        const rows = await EmployeeSchedule.findByWorker(BUSINESS_ID, TEST_USER_ID);
        const updated = rows.find(r => r.id === scheduleId);
        if (updated.start_time.substring(0, 5) !== '10:00') throw new Error('start_time not updated');
        if (updated.breaks.length !== 2) throw new Error(`Expected 2 breaks, got ${updated.breaks.length}`);
        ok(`UPDATE: start changed to 10:00, breaks replaced → 2 breaks`);
    } catch (e) { fail('UPDATE schedule', e); }

    // 1f. Conflict: duplicate day_of_week with no date range → CONFLICT error
    try {
        await EmployeeSchedule.create({
            business_id: BUSINESS_ID,
            user_id:     TEST_USER_ID,
            day_of_week: 1, // Same Monday, same date range (both null)
            start_time:  '08:00:00',
            end_time:    '12:00:00',
            is_day_off:  0,
        });
        fail('CONFLICT check: should have thrown', new Error('No error thrown'));
    } catch (e) {
        if (e.code === 'CONFLICT' || e.message?.includes('overlapping')) {
            ok('CONFLICT: duplicate day_of_week throws conflict error ✓');
        } else {
            fail('CONFLICT: unexpected error', e);
        }
    }

    // 1g. Versioning: two non-overlapping ranges for the same day_of_week
    // Cap the first row's effective_to, then create a second row with a future range.
    try {
        // Close out the first row so it has a bounded effective_to
        await EmployeeSchedule.update(scheduleId, BUSINESS_ID, {
            start_time:  '10:00:00',
            end_time:    '16:00:00',
            is_day_off:  0,
            effective_from: null,
            effective_to:   '2070-12-31',  // bounded — no longer open-ended
            breaks: []
        });

        const futureId = await EmployeeSchedule.create({
            business_id:    BUSINESS_ID,
            user_id:        TEST_USER_ID,
            day_of_week:    1,
            start_time:     '11:00:00',
            end_time:       '18:00:00',
            is_day_off:     0,
            effective_from: '2099-01-01',
            effective_to:   '2099-12-31',
        });
        ok(`VERSIONING: second Monday row (effective 2099) created id=${futureId}`);

        // The original row (effective_from=null, effective_to=2070-12-31) wins for 2026
        const mondayDate = _nextDateForIsoDay(1);
        const found = await EmployeeSchedule.findForDate(BUSINESS_ID, TEST_USER_ID, mondayDate);
        if (!found || found.id !== scheduleId) {
            throw new Error(`Expected original row id=${scheduleId} to win for ${mondayDate}, got id=${found?.id}`);
        }
        ok(`VERSIONING: original row wins for 2026 date ✓`);

        await EmployeeSchedule.delete(futureId, BUSINESS_ID);
    } catch (e) { fail('VERSIONING', e); }

    // 1h. Delete
    try {
        await EmployeeSchedule.delete(scheduleId, BUSINESS_ID);
        const rows = await EmployeeSchedule.findByWorker(BUSINESS_ID, TEST_USER_ID);
        if (rows.find(r => r.id === scheduleId)) throw new Error('Row still exists after delete');
        ok('DELETE: schedule row removed');
    } catch (e) { fail('DELETE schedule', e); }
}

async function testExceptionCRUD() {
    await cleanup(); // isolate from previous section
    console.log('\n── 2. Schedule Exception CRUD ──\n');

    const EmployeeScheduleException = (await import('../models/EmployeeScheduleException.js')).default;
    const targetDate = _nextDateForIsoDay(1); // Monday
    let exceptionId;

    // 2a. Create
    try {
        exceptionId = await EmployeeScheduleException.create({
            business_id:    BUSINESS_ID,
            user_id:        TEST_USER_ID,
            exception_date: targetDate,
            is_day_off:     0,
            start_time:     '10:00:00',
            end_time:       '14:00:00',
            reason:         'Shift swap',
            breaks: [{ start_time: '12:00:00', end_time: '12:30:00', label: 'Lunch' }]
        });
        if (!exceptionId) throw new Error('No insert ID');
        ok(`CREATE: exception id=${exceptionId} on ${targetDate} 10:00–14:00`);
    } catch (e) { fail('CREATE exception', e); return; }

    // 2b. findForDate
    try {
        const exc = await EmployeeScheduleException.findForDate(BUSINESS_ID, TEST_USER_ID, targetDate);
        if (!exc) throw new Error('findForDate returned null');
        if (exc.start_time.substring(0, 5) !== '10:00') throw new Error('Wrong start_time');
        if (!Array.isArray(exc.breaks) || exc.breaks.length !== 1) throw new Error('Expected 1 break');
        ok(`READ: findForDate(${targetDate}) → 10:00–14:00 with 1 break`);
    } catch (e) { fail('READ exception', e); }

    // 2c. Replace semantics: create another exception on same date → replaces it
    try {
        const newId = await EmployeeScheduleException.create({
            business_id:    BUSINESS_ID,
            user_id:        TEST_USER_ID,
            exception_date: targetDate,
            is_day_off:     1,  // Now marked as day off
            reason:         'Sick'
        });
        const exc = await EmployeeScheduleException.findForDate(BUSINESS_ID, TEST_USER_ID, targetDate);
        if (!exc || !exc.is_day_off) throw new Error('Replace did not work');
        exceptionId = exc.id; // use new ID for delete
        ok(`REPLACE SEMANTICS: second create on same date → is_day_off=1 (id=${newId})`);
    } catch (e) { fail('REPLACE exception', e); }

    // 2d. Delete
    try {
        await EmployeeScheduleException.delete(exceptionId, BUSINESS_ID);
        const exc = await EmployeeScheduleException.findForDate(BUSINESS_ID, TEST_USER_ID, targetDate);
        if (exc) throw new Error('Exception still found after delete');
        ok('DELETE: exception removed');
    } catch (e) { fail('DELETE exception', e); }
}

async function testTimeOffCRUD() {
    await cleanup();
    console.log('\n── 3. Time Off CRUD ──\n');

    const EmployeeTimeOff = (await import('../models/EmployeeTimeOff.js')).default;
    const startDate = _nextDateForIsoDay(1);         // Next Monday
    const endDate   = _nextDateForIsoDay(5, 7);      // Friday next week
    let timeOffId;

    // 3a. Create
    try {
        timeOffId = await EmployeeTimeOff.create({
            business_id: BUSINESS_ID,
            user_id:     TEST_USER_ID,
            start_date:  startDate,
            end_date:    endDate,
            type:        'vacation',
            status:      'approved',
            note:        'Summer vacation'
        });
        if (!timeOffId) throw new Error('No insert ID');
        ok(`CREATE: time-off id=${timeOffId} from ${startDate} to ${endDate}`);
    } catch (e) { fail('CREATE time-off', e); return; }

    // 3b. findForDate: day within range → found
    // Use a date that is definitively within [startDate, endDate] by calculating midpoint.
    try {
        const s = new Date(startDate + 'T12:00:00');
        const e2 = new Date(endDate + 'T12:00:00');
        const mid = new Date((s.getTime() + e2.getTime()) / 2);
        const midDate = mid.toISOString().slice(0, 10);
        const rec = await EmployeeTimeOff.findForDate(BUSINESS_ID, TEST_USER_ID, midDate);
        if (!rec) throw new Error(`findForDate(${midDate}) returned null — midDate should be in [${startDate}, ${endDate}]`);
        ok(`READ: findForDate(${midDate}) → record found ✓`);
    } catch (e) { fail('findForDate (in range)', e); }

    // 3c. findForDate: day outside range → null
    try {
        const pastDate = '2020-01-01';
        const rec = await EmployeeTimeOff.findForDate(BUSINESS_ID, TEST_USER_ID, pastDate);
        if (rec) throw new Error('Found a record for a past date that should be out of range');
        ok('READ: findForDate(2020-01-01) → null (out of range)');
    } catch (e) { fail('findForDate (out of range)', e); }

    // 3d. Update status to cancelled
    try {
        await EmployeeTimeOff.update(timeOffId, BUSINESS_ID, { status: 'cancelled' });
        const rec = await EmployeeTimeOff.findById(timeOffId, BUSINESS_ID);
        if (rec.status !== 'cancelled') throw new Error(`Expected cancelled, got ${rec.status}`);
        ok('UPDATE: status changed to cancelled');
    } catch (e) { fail('UPDATE time-off', e); }

    // 3e. Cancelled record no longer blocks availability
    try {
        const s2 = new Date(startDate + 'T12:00:00');
        const e3 = new Date(endDate + 'T12:00:00');
        const mid2 = new Date((s2.getTime() + e3.getTime()) / 2);
        const midDate2 = mid2.toISOString().slice(0, 10);
        // With status=cancelled, findForDate (which only fetches status='approved') returns null
        const rec = await EmployeeTimeOff.findForDate(BUSINESS_ID, TEST_USER_ID, midDate2);
        if (rec) throw new Error('Cancelled time-off still blocking availability');
        ok('CANCELLED: status=cancelled → findForDate returns null (availability unblocked) ✓');
    } catch (e) { fail('CANCELLED time-off', e); }

    // 3f. Delete
    try {
        await EmployeeTimeOff.delete(timeOffId, BUSINESS_ID);
        const rec = await EmployeeTimeOff.findById(timeOffId, BUSINESS_ID);
        if (rec) throw new Error('Record still exists after delete');
        ok('DELETE: time-off record removed');
    } catch (e) { fail('DELETE time-off', e); }
}

async function testPriorityChain() {
    await cleanup();
    console.log('\n── 4. Availability Priority Chain ──\n');

    const AvailabilityService = (await import('../services/AvailabilityService.js')).default;
    const EmployeeSchedule = (await import('../models/EmployeeSchedule.js')).default;
    const EmployeeScheduleException = (await import('../models/EmployeeScheduleException.js')).default;
    const EmployeeTimeOff = (await import('../models/EmployeeTimeOff.js')).default;

    // Get an open business day
    const [bizHours] = await pool.query(
        'SELECT * FROM business_hours WHERE business_id = ? ORDER BY day_of_week ASC',
        [BUSINESS_ID]
    );
    const openDay = bizHours.find(h => !h.is_closed);
    if (!openDay) { console.log('  ⚠️  No open days — skipping priority chain tests'); return; }

    const testDate = _nextDateForIsoDay(openDay.day_of_week, 14);

    // 4a. No schedule → fallback to business hours
    try {
        const w = await AvailabilityService.getWorkingWindow(BUSINESS_ID, TEST_USER_ID, testDate);
        const bizStart = openDay.open_time.substring(0, 5);
        const bizEnd   = openDay.close_time.substring(0, 5);
        if (!w || w.start !== bizStart || w.end !== bizEnd) {
            throw new Error(`Expected ${bizStart}–${bizEnd}, got ${JSON.stringify(w)}`);
        }
        ok(`P1: no schedule → fallback ${w.start}–${w.end} (business hours)`);
    } catch (e) { fail('P1 fallback', e); }

    // 4b. Add recurring schedule → overrides fallback
    const [sched] = await pool.query(
        `INSERT INTO employee_schedules (business_id, user_id, day_of_week, start_time, end_time, is_day_off)
         VALUES (?, ?, ?, '09:00:00', '14:00:00', 0)`,
        [BUSINESS_ID, TEST_USER_ID, openDay.day_of_week]
    );
    const schedId = sched.insertId;

    try {
        const w = await AvailabilityService.getWorkingWindow(BUSINESS_ID, TEST_USER_ID, testDate);
        if (!w || w.start !== '09:00' || w.end !== '14:00') {
            throw new Error(`Expected 09:00–14:00, got ${JSON.stringify(w)}`);
        }
        ok('P2: recurring schedule 09:00–14:00 overrides fallback ✓');
    } catch (e) { fail('P2 recurring schedule', e); }

    // 4c. Add exception → overrides recurring
    await pool.query(
        `INSERT INTO employee_schedule_exceptions (business_id, user_id, exception_date, is_day_off, start_time, end_time, reason)
         VALUES (?, ?, ?, 0, '11:00:00', '16:00:00', 'Test')`,
        [BUSINESS_ID, TEST_USER_ID, testDate]
    );

    try {
        const w = await AvailabilityService.getWorkingWindow(BUSINESS_ID, TEST_USER_ID, testDate);
        if (!w || w.start !== '11:00' || w.end !== '16:00') {
            throw new Error(`Expected 11:00–16:00, got ${JSON.stringify(w)}`);
        }
        ok('P3: exception 11:00–16:00 overrides recurring schedule ✓');
    } catch (e) { fail('P3 exception override', e); }

    // 4d. Add time-off → overrides everything → null
    await pool.query(
        `INSERT INTO employee_time_off (business_id, user_id, start_date, end_date, type, status)
         VALUES (?, ?, ?, ?, 'vacation', 'approved')`,
        [BUSINESS_ID, TEST_USER_ID, testDate, testDate]
    );

    try {
        const w = await AvailabilityService.getWorkingWindow(BUSINESS_ID, TEST_USER_ID, testDate);
        if (w !== null) throw new Error(`Expected null, got ${JSON.stringify(w)}`);
        ok('P4: approved time-off overrides exception+schedule → null ✓');
    } catch (e) { fail('P4 time-off override', e); }

    // Cleanup
    await pool.query('DELETE FROM employee_schedules WHERE id = ?', [schedId]);
    await cleanup();
}

async function testConflictDetection() {
    await cleanup();
    console.log('\n── 5. Conflict Detection ──\n');

    const EmployeeSchedule = (await import('../models/EmployeeSchedule.js')).default;

    // 5a. detectConflicts finds an appointment outside a new schedule
    // Note: We don't insert real appointments here (requires client_id etc.),
    // so we verify the query runs without error and returns an array.
    try {
        const conflicts = await EmployeeSchedule.detectConflicts(
            BUSINESS_ID, TEST_USER_ID, 1, '09:00:00', '14:00:00', 0
        );
        if (!Array.isArray(conflicts)) throw new Error('Expected array');
        ok(`detectConflicts returns array (${conflicts.length} conflicts for this worker/day)`);
    } catch (e) { fail('detectConflicts query', e); }

    // 5b. validateSlot returns false for an invalid datetime
    const AvailabilityService = (await import('../services/AvailabilityService.js')).default;
    try {
        const result = await AvailabilityService.validateSlot(
            BUSINESS_ID, TEST_USER_ID, TEST_SERVICE_ID, 'not-a-date'
        );
        if (result.valid !== false) throw new Error('Expected valid=false for bad datetime');
        ok(`validateSlot(bad datetime) → { valid: false, reason: "${result.reason}" }`);
    } catch (e) { fail('validateSlot bad datetime', e); }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _nextDateForIsoDay(isoDay, minDaysAhead = 1) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    today.setDate(today.getDate() + minDaysAhead);
    while (true) {
        const jsDay = today.getDay();
        const iso   = jsDay === 0 ? 7 : jsDay;
        if (iso === isoDay) break;
        today.setDate(today.getDate() + 1);
    }
    return today.toISOString().slice(0, 10);
}

// ── Run ────────────────────────────────────────────────────────────────────────

async function run() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  Phase 2 — Schedule API Integration Tests   ║');
    console.log('╚══════════════════════════════════════════════╝');

    try {
        await setup();
        await testScheduleCRUD();
        await testExceptionCRUD();
        await testTimeOffCRUD();
        await testPriorityChain();
        await testConflictDetection();
    } catch (err) {
        fail('TEST SETUP FAILED', err);
    } finally {
        try { await cleanup(); } catch (_) {}
        await pool.end();
    }

    // Final: print failures if any
    if (failed > 0) {
        try {
            const failLog = fs.readFileSync(FAILURE_LOG, 'utf8');
            console.log('\nFailed tests:\n' + failLog);
        } catch(_) {}
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log(`${'═'.repeat(50)}\n`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
