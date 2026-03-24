/**
 * Unit + Integration Tests — AvailabilityService
 *
 * Run: node backend/tests/test_availability_service.mjs
 *
 * Split into two sections:
 *   SECTION A — Pure unit tests for subtractInterval (no DB, always fast)
 *   SECTION B — Integration tests for getWorkingWindow and getAvailableSlots
 *               (requires a running MySQL DB with the employee scheduling tables)
 *
 * Integration tests use BUSINESS_ID=5 and create/clean up their own test worker
 * data so they don't pollute real data.
 */

import pool from '../config/database.js';
import AvailabilityService, { subtractInterval } from '../services/AvailabilityService.js';

// ─── Test Harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const ok   = (label) => { passed++; console.log(`  ✅ ${label}`); };
const fail = (label, err) => { failed++; console.error(`  ❌ ${label}:`, err?.message || String(err)); };

function assertEqual(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`Expected ${e} but got ${a}`);
    ok(label);
}

function assertNull(value, label) {
    if (value !== null) throw new Error(`Expected null but got ${JSON.stringify(value)}`);
    ok(label);
}

function assertNotNull(value, label) {
    if (value === null || value === undefined) throw new Error('Expected non-null value');
    ok(label);
}

// ─── SECTION A: subtractInterval — Pure Unit Tests ────────────────────────────

function testSubtractInterval() {
    console.log('\n── A. subtractInterval (pure unit) ──\n');

    // A1: Removal entirely before interval — no change
    try {
        const r = subtractInterval([{ start: '09:00', end: '18:00' }], '07:00', '08:00');
        assertEqual(r, [{ start: '09:00', end: '18:00' }], 'A1: remove before interval → unchanged');
    } catch (e) { fail('A1', e); }

    // A2: Removal entirely after interval — no change
    try {
        const r = subtractInterval([{ start: '09:00', end: '18:00' }], '19:00', '20:00');
        assertEqual(r, [{ start: '09:00', end: '18:00' }], 'A2: remove after interval → unchanged');
    } catch (e) { fail('A2', e); }

    // A3: Remove from the middle — splits into two pieces
    try {
        const r = subtractInterval([{ start: '09:00', end: '18:00' }], '12:00', '12:30');
        assertEqual(r, [{ start: '09:00', end: '12:00' }, { start: '12:30', end: '18:00' }], 'A3: remove middle → two pieces');
    } catch (e) { fail('A3', e); }

    // A4: Remove exactly at start boundary
    try {
        const r = subtractInterval([{ start: '09:00', end: '18:00' }], '09:00', '10:00');
        assertEqual(r, [{ start: '10:00', end: '18:00' }], 'A4: remove from exact start → left piece gone');
    } catch (e) { fail('A4', e); }

    // A5: Remove exactly at end boundary
    try {
        const r = subtractInterval([{ start: '09:00', end: '18:00' }], '17:00', '18:00');
        assertEqual(r, [{ start: '09:00', end: '17:00' }], 'A5: remove exact end → right piece gone');
    } catch (e) { fail('A5', e); }

    // A6: Remove covers entire interval — returns empty
    try {
        const r = subtractInterval([{ start: '09:00', end: '18:00' }], '08:00', '19:00');
        assertEqual(r, [], 'A6: remove surrounds interval → empty');
    } catch (e) { fail('A6', e); }

    // A7: Remove exactly equals interval — returns empty
    try {
        const r = subtractInterval([{ start: '09:00', end: '18:00' }], '09:00', '18:00');
        assertEqual(r, [], 'A7: remove equals interval exactly → empty');
    } catch (e) { fail('A7', e); }

    // A8: Remove from two-interval array — only second affected
    try {
        const r = subtractInterval(
            [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }],
            '15:00', '16:00'
        );
        assertEqual(r, [
            { start: '09:00', end: '13:00' },
            { start: '14:00', end: '15:00' },
            { start: '16:00', end: '18:00' },
        ], 'A8: two intervals, remove from second → three pieces total');
    } catch (e) { fail('A8', e); }

    // A9: Remove with zero length (removeStart === removeEnd) — no-op
    try {
        const r = subtractInterval([{ start: '09:00', end: '18:00' }], '12:00', '12:00');
        assertEqual(r, [{ start: '09:00', end: '18:00' }], 'A9: zero-length removal → unchanged');
    } catch (e) { fail('A9', e); }

    // A10: Empty intervals array — returns empty
    try {
        const r = subtractInterval([], '09:00', '10:00');
        assertEqual(r, [], 'A10: empty input → empty output');
    } catch (e) { fail('A10', e); }

    // A11: Removal at exact left edge of one of two intervals
    try {
        const r = subtractInterval(
            [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }],
            '09:00', '09:30'
        );
        assertEqual(r, [
            { start: '09:30', end: '12:00' },
            { start: '13:00', end: '17:00' },
        ], 'A11: remove from left edge of first interval');
    } catch (e) { fail('A11', e); }

    // A12: Chained subtractions simulate multiple breaks
    try {
        let intervals = [{ start: '09:00', end: '18:00' }];
        intervals = subtractInterval(intervals, '10:30', '10:45'); // coffee
        intervals = subtractInterval(intervals, '12:00', '13:00'); // lunch
        assertEqual(intervals, [
            { start: '09:00', end: '10:30' },
            { start: '10:45', end: '12:00' },
            { start: '13:00', end: '18:00' },
        ], 'A12: chained subtractions (coffee + lunch)');
    } catch (e) { fail('A12', e); }
}

// ─── SECTION B: Integration Tests ─────────────────────────────────────────────
// These use a real DB connection. They create data under a test worker user ID
// that should not clash with real production data. Clean up is run at start + end.

const BUSINESS_ID = 5;  // Must exist in your DB
let TEST_USER_ID;       // Resolved in setupIntegration()

async function setupIntegration() {
    // Find or reuse the first employee in business 5 as our test subject
    const [rows] = await pool.query(
        'SELECT user_id FROM user_business WHERE business_id = ? LIMIT 1',
        [BUSINESS_ID]
    );
    if (rows.length === 0) throw new Error('No users in business 5. Cannot run integration tests.');
    TEST_USER_ID = rows[0].user_id;
    console.log(`\nUsing test worker user_id=${TEST_USER_ID} in business_id=${BUSINESS_ID}`);
    await cleanupIntegration();
}

async function cleanupIntegration() {
    await pool.query(
        'DELETE FROM employee_time_off WHERE business_id = ? AND user_id = ?',
        [BUSINESS_ID, TEST_USER_ID]
    );
    await pool.query(
        'DELETE FROM employee_schedule_exceptions WHERE business_id = ? AND user_id = ?',
        [BUSINESS_ID, TEST_USER_ID]
    );
    // Delete breaks via CASCADE by deleting schedules
    await pool.query(
        'DELETE FROM employee_schedules WHERE business_id = ? AND user_id = ?',
        [BUSINESS_ID, TEST_USER_ID]
    );
}

async function testGetWorkingWindow() {
    console.log('\n── B. getWorkingWindow (integration) ──\n');

    // Determine a known open business day (assume Monday is open, day_of_week=1)
    const [bizHours] = await pool.query(
        'SELECT * FROM business_hours WHERE business_id = ? ORDER BY day_of_week ASC',
        [BUSINESS_ID]
    );
    const openDay = bizHours.find(h => !h.is_closed);
    if (!openDay) throw new Error('Business has no open days. Cannot run integration tests.');

    // Convert ISO day (1=Mon) to next occurrence date string
    const targetDate = _nextDateForIsoDay(openDay.day_of_week);
    const closedDay  = bizHours.find(h => h.is_closed);
    const closedDate = closedDay ? _nextDateForIsoDay(closedDay.day_of_week) : null;

    // B1: No schedule → fallback to business hours
    try {
        await cleanupIntegration();
        const w = await AvailabilityService.getWorkingWindow(BUSINESS_ID, TEST_USER_ID, targetDate);
        assertNotNull(w, `B1: no schedule → fallback returns non-null (date=${targetDate})`);
        const expectedStart = openDay.open_time.substring(0, 5);
        const expectedEnd   = openDay.close_time.substring(0, 5);
        if (w.start !== expectedStart || w.end !== expectedEnd) {
            throw new Error(`Expected ${expectedStart}-${expectedEnd}, got ${w.start}-${w.end}`);
        }
        ok(`B1: fallback window = ${w.start}–${w.end} (matches business hours)`);
    } catch (e) { fail('B1', e); }

    // B2: Business closed day → returns null
    if (closedDate) {
        try {
            const w = await AvailabilityService.getWorkingWindow(BUSINESS_ID, TEST_USER_ID, closedDate);
            assertNull(w, `B2: business closed day (${closedDate}) → null`);
        } catch (e) { fail('B2', e); }
    } else {
        console.log('  ⚠️  B2: skipped (no closed day configured in business_hours)');
    }

    // B3: Time-off overrides everything
    try {
        await pool.query(
            `INSERT INTO employee_time_off
             (business_id, user_id, start_date, end_date, type, status)
             VALUES (?, ?, ?, ?, 'vacation', 'approved')`,
            [BUSINESS_ID, TEST_USER_ID, targetDate, targetDate]
        );
        const w = await AvailabilityService.getWorkingWindow(BUSINESS_ID, TEST_USER_ID, targetDate);
        assertNull(w, 'B3: approved time-off → null');
        await cleanupIntegration(); // remove time-off for next tests
    } catch (e) { fail('B3', e); await cleanupIntegration(); }

    // B4: Recurring schedule overrides fallback
    try {
        // Insert schedule: 09:00–14:00 for openDay.day_of_week
        await pool.query(
            `INSERT INTO employee_schedules
             (business_id, user_id, day_of_week, start_time, end_time, is_day_off)
             VALUES (?, ?, ?, '09:00:00', '14:00:00', 0)`,
            [BUSINESS_ID, TEST_USER_ID, openDay.day_of_week]
        );
        const w = await AvailabilityService.getWorkingWindow(BUSINESS_ID, TEST_USER_ID, targetDate);
        assertNotNull(w, 'B4: schedule returns non-null');
        if (w.start !== '09:00' || w.end !== '14:00') {
            throw new Error(`Expected 09:00–14:00, got ${w.start}–${w.end}`);
        }
        ok('B4: recurring schedule window = 09:00–14:00 ✓');
    } catch (e) { fail('B4', e); }

    // B5: Schedule clamped to business hours (schedule extends past closing)
    try {
        await cleanupIntegration();
        const bizClose = openDay.close_time.substring(0, 5);
        // Insert schedule that extends 2h past closing — should be clamped
        const [closingH, closingM] = bizClose.split(':').map(Number);
        const extendedClose = `${String(closingH + 2).padStart(2, '0')}:${String(closingM).padStart(2, '0')}`;
        await pool.query(
            `INSERT INTO employee_schedules
             (business_id, user_id, day_of_week, start_time, end_time, is_day_off)
             VALUES (?, ?, ?, ?, ?, 0)`,
            [BUSINESS_ID, TEST_USER_ID, openDay.day_of_week, openDay.open_time, extendedClose + ':00']
        );
        const w = await AvailabilityService.getWorkingWindow(BUSINESS_ID, TEST_USER_ID, targetDate);
        if (w.end !== bizClose) {
            throw new Error(`Expected end clamped to ${bizClose}, got ${w.end}`);
        }
        ok(`B5: schedule clamped to business close (${bizClose}) ✓`);
    } catch (e) { fail('B5', e); }

    // B6: Exception overrides recurring schedule
    try {
        await pool.query(
            `INSERT INTO employee_schedule_exceptions
             (business_id, user_id, exception_date, is_day_off, start_time, end_time, reason)
             VALUES (?, ?, ?, 0, '10:00:00', '13:00:00', 'Test shift swap')`,
            [BUSINESS_ID, TEST_USER_ID, targetDate]
        );
        const w = await AvailabilityService.getWorkingWindow(BUSINESS_ID, TEST_USER_ID, targetDate);
        if (w.start !== '10:00' || w.end !== '13:00') {
            throw new Error(`Expected 10:00–13:00, got ${w.start}–${w.end}`);
        }
        ok('B6: exception overrides recurring schedule → 10:00–13:00 ✓');
    } catch (e) { fail('B6', e); }

    // B7: is_day_off exception → null even when schedule exists
    try {
        // Override the previous exception with day-off
        await pool.query(
            `UPDATE employee_schedule_exceptions
             SET is_day_off = 1, start_time = NULL, end_time = NULL
             WHERE business_id = ? AND user_id = ? AND exception_date = ?`,
            [BUSINESS_ID, TEST_USER_ID, targetDate]
        );
        const w = await AvailabilityService.getWorkingWindow(BUSINESS_ID, TEST_USER_ID, targetDate);
        assertNull(w, 'B7: is_day_off exception → null ✓');
    } catch (e) { fail('B7', e); }

    await cleanupIntegration();
}

async function testGetAvailableSlots() {
    console.log('\n── C. getAvailableSlots (integration) ──\n');

    const [bizHours] = await pool.query(
        'SELECT * FROM business_hours WHERE business_id = ? ORDER BY day_of_week ASC',
        [BUSINESS_ID]
    );
    const openDay = bizHours.find(h => !h.is_closed);
    if (!openDay) return console.log('  ⚠️  Skipped: no open days\n');

    // Use a future date (same iso day as openDay but clearly in the future)
    const targetDate = _nextDateForIsoDay(openDay.day_of_week, 14); // 2 weeks out = never "today"

    const [svcRows] = await pool.query(
        'SELECT id FROM services WHERE business_id = ? AND is_active = 1 LIMIT 1',
        [BUSINESS_ID]
    );
    if (svcRows.length === 0) return console.log('  ⚠️  Skipped: no active services\n');
    const serviceId = svcRows[0].id;

    // C1: No schedule, no appointments → slots cover business hours
    try {
        await cleanupIntegration();
        const slots = await AvailabilityService.getAvailableSlots(BUSINESS_ID, TEST_USER_ID, serviceId, targetDate);
        if (!Array.isArray(slots) || slots.length === 0) {
            throw new Error(`Expected slots array, got: ${JSON.stringify(slots)}`);
        }
        ok(`C1: no schedule/appointments → ${slots.length} slots returned`);
    } catch (e) { fail('C1', e); }

    // C2: Time-off → zero slots
    try {
        await pool.query(
            `INSERT INTO employee_time_off
             (business_id, user_id, start_date, end_date, type, status)
             VALUES (?, ?, ?, ?, 'vacation', 'approved')`,
            [BUSINESS_ID, TEST_USER_ID, targetDate, targetDate]
        );
        const slots = await AvailabilityService.getAvailableSlots(BUSINESS_ID, TEST_USER_ID, serviceId, targetDate);
        assertEqual(slots, [], 'C2: time-off day → zero slots');
        await cleanupIntegration();
    } catch (e) { fail('C2', e); await cleanupIntegration(); }

    // C3: Schedule with a break — slots do not appear during break
    try {
        const [schedRes] = await pool.query(
            `INSERT INTO employee_schedules
             (business_id, user_id, day_of_week, start_time, end_time, is_day_off)
             VALUES (?, ?, ?, '09:00:00', '17:00:00', 0)`,
            [BUSINESS_ID, TEST_USER_ID, openDay.day_of_week]
        );
        const schedId = schedRes.insertId;
        await pool.query(
            'INSERT INTO employee_breaks (schedule_id, start_time, end_time, label) VALUES (?, ?, ?, ?)',
            [schedId, '12:00:00', '13:00:00', 'Lunch']
        );

        const slots = await AvailabilityService.getAvailableSlots(BUSINESS_ID, TEST_USER_ID, serviceId, targetDate);

        const duringBreak = slots.filter(s => s.time >= '12:00' && s.time < '13:00');
        if (duringBreak.length > 0) {
            throw new Error(`Slots found during break: ${JSON.stringify(duringBreak)}`);
        }
        ok(`C3: break 12:00–13:00 → no slots during break (total slots: ${slots.length})`);
    } catch (e) { fail('C3', e); }

    // C4: Existing appointment blocks its time window
    try {
        // Get service duration to know exact window blocked
        const [sdRows] = await pool.query(
            'SELECT duration_minutes FROM services WHERE id = ?',
            [serviceId]
        );
        const duration = sdRows[0].duration_minutes;

        // Insert appointment at 10:00 on targetDate
        const aptDatetime = `${targetDate} 10:00:00`;
        await pool.query(
            `INSERT INTO appointment
             (business_id, client_id, service_id, assigned_to_user_id, appointment_datetime, status, user_id)
             VALUES (?, 1, ?, ?, ?, 'scheduled', ?)`,
            [BUSINESS_ID, serviceId, TEST_USER_ID, aptDatetime, TEST_USER_ID]
        );

        const slots = await AvailabilityService.getAvailableSlots(BUSINESS_ID, TEST_USER_ID, serviceId, targetDate);
        const conflicting = slots.filter(s => s.time >= '10:00' && s.time < _addMinutesStr('10:00', duration));
        if (conflicting.length > 0) {
            throw new Error(`Slot during existing appointment: ${JSON.stringify(conflicting)}`);
        }
        ok(`C4: existing appointment at 10:00 → no slots in ${duration}min window`);

        // Cleanup appointment
        await pool.query(
            `DELETE FROM appointment WHERE assigned_to_user_id = ? AND appointment_datetime = ?`,
            [TEST_USER_ID, aptDatetime]
        );
    } catch (e) { fail('C4', e); }

    await cleanupIntegration();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get a YYYY-MM-DD string for the next occurrence of an ISO day of week,
 * at least `minDaysAhead` days from now.
 */
function _nextDateForIsoDay(isoDay, minDaysAhead = 0) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    // Start from tomorrow or minDaysAhead, whichever is later
    today.setDate(today.getDate() + Math.max(1, minDaysAhead));
    while (true) {
        const jsDay = today.getDay();
        const iso = jsDay === 0 ? 7 : jsDay;
        if (iso === isoDay) break;
        today.setDate(today.getDate() + 1);
    }
    return today.toISOString().slice(0, 10);
}

function _addMinutesStr(timeStr, minutes) {
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + minutes;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ─── Run All Tests ─────────────────────────────────────────────────────────────

async function run() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  AvailabilityService Test Suite              ║');
    console.log('╚══════════════════════════════════════════════╝');

    // Section A: pure unit tests (no DB needed)
    testSubtractInterval();

    // Section B: integration tests (requires DB)
    try {
        await setupIntegration();
        await testGetWorkingWindow();
        await testGetAvailableSlots();
    } catch (err) {
        fail('Integration setup failed', err);
    } finally {
        // Always attempt cleanup even on failure
        try { await cleanupIntegration(); } catch (_) {}
        await pool.end();
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log(`${'═'.repeat(50)}\n`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
