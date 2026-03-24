import pool from '../config/database.js';
import PublicBookingController from '../controllers/api/publicBookingController.js';
import AppointmentController from '../controllers/api/appointmentController.js';
import Business from '../models/Business.js';
import Appointment from '../models/Appointment.js';
import Client from '../models/Client.js';

const BUSINESS_ID = 5;

import fs from 'fs';

const FAILURE_LOG = 'C:/tmp/booking_failures.txt';
try { fs.writeFileSync(FAILURE_LOG, ''); } catch(_) {}

let passed = 0;
let failed = 0;
const ok   = (label) => { passed++; console.log(`  ✅ ${label}`); };
const fail = (label, err) => {
    failed++;
    const msg = `❌ ${label}: ${err?.message || String(err)}`;
    console.error('  ' + msg);
    try { fs.appendFileSync(FAILURE_LOG, msg + '\n'); } catch(_) {}
};

let TEST_USER_ID;
let TEST_SERVICE_ID;
let TEST_SLUG;

async function setup() {
    const [users] = await pool.query(
        'SELECT user_id FROM user_business WHERE business_id = ? LIMIT 1',
        [BUSINESS_ID]
    );
    if (!users.length) throw new Error('No users in business');
    TEST_USER_ID = users[0].user_id;

    const [svc] = await pool.query(
        'SELECT id FROM services WHERE business_id = ? AND is_active = 1 LIMIT 1',
        [BUSINESS_ID]
    );
    if (!svc.length) throw new Error('No active services');
    TEST_SERVICE_ID = svc[0].id;

    const biz = await Business.getById(BUSINESS_ID);
    TEST_SLUG = biz.slug;

    console.log(`\nSetup: business_id=${BUSINESS_ID}, slug=${TEST_SLUG}, worker=${TEST_USER_ID}, service=${TEST_SERVICE_ID}`);
    await cleanup();
}

async function cleanup() {
    await pool.query('DELETE FROM employee_time_off WHERE business_id = ? AND user_id = ?', [BUSINESS_ID, TEST_USER_ID]);
    await pool.query('DELETE FROM employee_schedule_exceptions WHERE business_id = ? AND user_id = ?', [BUSINESS_ID, TEST_USER_ID]);
    await pool.query('DELETE FROM employee_schedules WHERE business_id = ? AND user_id = ?', [BUSINESS_ID, TEST_USER_ID]);
    // Delete any test appointments created
    await pool.query('DELETE FROM appointment WHERE business_id = ? AND notes = "INTEGRATION TEST"', [BUSINESS_ID]);
}

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

// ── Mock Express Objects ──

function mockRes() {
    return {
        _status: 200,
        _json: null,
        status(code) { this._status = code; return this; },
        json(data) { this._json = data; return this; },
        send(data) { this._json = data; return this; }
    };
}

function mockNext(label) {
    return (err) => {
        if (err) fail(label, err);
        else console.log(`  next() called with no error in ${label}`);
    };
}

// ── Tests ──

async function testPublicBookingAvailability() {
    await cleanup();
    console.log('\n── 1. PublicBookingController.getAvailability ──\n');

    const testDate = _nextDateForIsoDay(3); // Next Wednesday

    // Add a time off for the worker
    await pool.query(
        `INSERT INTO employee_time_off (business_id, user_id, start_date, end_date, type, status)
         VALUES (?, ?, ?, ?, 'vacation', 'approved')`,
        [BUSINESS_ID, TEST_USER_ID, testDate, testDate]
    );

    const req = {
        params: { slug: TEST_SLUG },
        query: { date: testDate, service_id: TEST_SERVICE_ID }
    };
    const res = mockRes();
    const next = mockNext('PublicBooking getAvailability');

    try {
        await PublicBookingController.getAvailability(req, res, next);
        
        if (res._status !== 200 || !res._json?.success) {
            throw new Error(`Expected 200 success, got ${res._status}: ${JSON.stringify(res._json)}`);
        }

        // We expect NO slots for TEST_USER_ID because they are on vacation
        const slotsForWorker = res._json.data.slots.filter(s => s.worker_id === TEST_USER_ID);
        if (slotsForWorker.length > 0) {
            throw new Error(`Expected 0 slots for worker on vacation, got ${slotsForWorker.length}`);
        }
        ok('getAvailability respects Time Off (returned 0 slots for worker)');
    } catch (e) {
        fail('getAvailability with Time Off', e);
    }
}

async function testPublicBookingCreate() {
    await cleanup();
    console.log('\n── 2. PublicBookingController.createBooking ──\n');

    const testDate = _nextDateForIsoDay(4); // Next Thursday
    const aptTime = `${testDate} 10:00:00`;

    // 1. Try to book without a schedule (should use business hours fallback natively via AvailabilityService)
    const req1 = {
        params: { slug: TEST_SLUG },
        body: {
            service_id: TEST_SERVICE_ID,
            worker_id: TEST_USER_ID,
            appointment_datetime: aptTime,
            client_name: 'Test Client',
            client_phone: '+385912345678'
        }
    };
    
    // Check if the business is open on Thursdays.
    // If not, this request will fail organically, which is also correct.
    const [bizHours] = await pool.query('SELECT * FROM business_hours WHERE business_id = ? AND day_of_week = 4', [BUSINESS_ID]);
    const isOpen = bizHours.length > 0 && !bizHours[0].is_closed;

    let res1 = mockRes();
    let next1Called = false;
    let next1Error = null;
    const next1 = (err) => { next1Called = true; next1Error = err; };

    try {
        await PublicBookingController.createBooking(req1, res1, next1);
        if (next1Called && next1Error) {
            if (!isOpen && next1Error.message.includes('unavailable')) {
                ok('createBooking correctly blocks booking on closed business day');
            } else if (isOpen) {
                // Should have worked
                throw next1Error;
            }
        } else if (isOpen) {
            if (res1._status !== 201) throw new Error(`Expected 201, got ${res1._status}: ${JSON.stringify(res1._json)}`);
            ok('createBooking succeeds with valid fallback business hours slot');
            // Clean up the created appt
            await pool.query('DELETE FROM appointment WHERE id = ?', [res1._json.data.id]);
        }
    } catch (e) {
        fail('createBooking valid fallback slot', e);
    }

    // 2. Add an exception making the worker unavailable at 10:00
    await pool.query(
        `INSERT INTO employee_schedule_exceptions (business_id, user_id, exception_date, is_day_off, start_time, end_time, reason)
         VALUES (?, ?, ?, 0, '12:00:00', '16:00:00', 'Late Shift')`,
        [BUSINESS_ID, TEST_USER_ID, testDate]
    );

    let res2 = mockRes();
    let next2Called = false;
    let next2Error = null;
    const next2 = (err) => { next2Called = true; next2Error = err; };

    try {
        await PublicBookingController.createBooking(req1, res2, next2); // Trying 10:00 again
        if (!next2Called || !next2Error) {
            throw new Error('Expected validation error from next(err), but it succeeded');
        }
        if (!next2Error.message.toLowerCase().includes('outside')) {
            throw new Error(`Expected "outside worker schedule" error, got: ${next2Error.message}`);
        }
        ok('createBooking correctly blocks booking outside Exception window');
    } catch (e) {
        fail('createBooking block outside Exception window', e);
    }
}

async function testAppointmentControllerCreate() {
    await cleanup();
    console.log('\n── 3. AppointmentController.create ──\n');

    const testDate = _nextDateForIsoDay(5); // Next Friday
    const aptTime = `${testDate} 14:00:00`;

    // Add a strict recurring schedule for Friday: 08:00 - 12:00
    await pool.query(
        `INSERT INTO employee_schedules (business_id, user_id, day_of_week, start_time, end_time, is_day_off)
         VALUES (?, ?, 5, '08:00:00', '12:00:00', 0)`,
        [BUSINESS_ID, TEST_USER_ID]
    );

    const req = {
        session: { activeBusinessId: BUSINESS_ID, userId: TEST_USER_ID }, // Acting as admin/owner
        body: {
            service_id: TEST_SERVICE_ID,
            assigned_to_user_id: TEST_USER_ID,
            appointment_datetime: aptTime, // 14:00 is OUTSIDE schedule
            walkIn: true, // Use walk-in mode for simplicity
            notes: 'INTEGRATION TEST'
        }
    };
    
    let res = mockRes();
    let nextCalled = false;
    let nextError = null;
    const next = (err) => { nextCalled = true; nextError = err; };

    try {
        await AppointmentController.create(req, res, next);
        if (!nextCalled || !nextError) {
            throw new Error('Expected validation error from next(err), but it succeeded');
        }
        if (!nextError.message.toLowerCase().includes('outside')) {
            throw new Error(`Expected "outside worker schedule" error, got: ${nextError.message}`);
        }
        ok('AppointmentController.create correctly blocks booking outside Recurring Schedule window');
    } catch (e) {
        fail('AppointmentController.create bounds check', e);
    }

    // Now try inside the schedule (09:00)
    req.body.appointment_datetime = `${testDate} 09:00:00`;
    let res2 = mockRes();
    let next2Called = false;
    let next2Error = null;
    const next2 = (err) => { next2Called = true; next2Error = err; };

    try {
        await AppointmentController.create(req, res2, next2);
        if (next2Called && next2Error) throw next2Error;
        if (res2._status !== 201) throw new Error(`Expected 201, got ${res2._status}: ${JSON.stringify(res2._json)}`);
        ok('AppointmentController.create succeeds with valid schedule slot');
    } catch (e) {
        fail('AppointmentController.create valid slot', e);
    }

    // Now try double booking exactly at 09:00
    let res3 = mockRes();
    let next3Called = false;
    let next3Error = null;
    const next3 = (err) => { next3Called = true; next3Error = err; };

    try {
        await AppointmentController.create(req, res3, next3);
        if (!next3Called || !next3Error) {
            throw new Error('Expected validation error for double-booking, but it succeeded');
        }
        if (!next3Error.message.includes('already has an appointment')) {
            throw new Error(`Expected overlap error, got: ${next3Error.message}`);
        }
        ok('AppointmentController.create enforces double-booking prevention');
    } catch (e) {
        fail('AppointmentController.create double booking', e);
    }
}

async function run() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  Phase 3 — Booking Controllers Integration   ║');
    console.log('╚══════════════════════════════════════════════╝');

    try {
        await setup();
        await testPublicBookingAvailability();
        await testPublicBookingCreate();
        await testAppointmentControllerCreate();
    } catch (err) {
        fail('TEST SETUP FAILED', err);
    } finally {
        try { await cleanup(); } catch (_) {}
        await pool.end();
    }

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
