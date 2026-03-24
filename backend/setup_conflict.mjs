import pool from './config/database.js';

async function setupConflict() {
  try {
    const businessId = 12; // Alen is associated with business 12
    
    // 1. Give Alen a schedule on Tuesday (Day 2) 09:00-17:00
    await pool.query('DELETE FROM employee_schedules WHERE user_id = 1');
    await pool.query('INSERT INTO employee_schedules (business_id, user_id, day_of_week, start_time, end_time, is_day_off) VALUES (?, ?, 2, "09:00:00", "17:00:00", 0)', [businessId, 1]);
    console.log("Created Tuesday schedule: 09:00 - 17:00");

    // 2. Add an appointment on Tuesday 10:00-11:00
    // We need to know date of next Tuesday. Today is Monday Mar 23. Next Tuesday is Mar 24.
    const dateStr = '2026-03-24'; 
    const datetimeStr = `${dateStr} 10:00:00`;

    // Drop previous appointments to prevent clutter
    await pool.query('DELETE FROM appointment WHERE assigned_to_user_id = 1');

    // Make sure we have a service_id (usually 1 exists)
    const [services] = await pool.query('SELECT id FROM services LIMIT 1');
    const serviceId = services[0]?.id || 1;

    // Make sure we have a client_id (usually 1)
    const [clients] = await pool.query('SELECT id FROM clients LIMIT 1');
    const clientId = clients[0]?.id || 1;

    await pool.query(`
      INSERT INTO appointment (
        business_id, client_id, service_id, assigned_to_user_id, 
        appointment_datetime, status
      ) VALUES (?, ?, ?, ?, ?, 'scheduled')
    `, [businessId, clientId, serviceId, 1, datetimeStr]);
    
    console.log(`Created conflict appointment on ${datetimeStr}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

setupConflict();
