import pool from './config/database.js';

async function seed() {
  try {
    const businessId = 5;
    console.log(`Seeding analytics data for business ${businessId}...`);

    // 1. Get staff
    const [staff] = await pool.query(`SELECT u.id, u.first_name FROM user u JOIN user_business ub ON u.id = ub.user_id WHERE ub.business_id = ?`, [businessId]);
    if (staff.length === 0) {
        throw new Error('No staff found for business 5. Please ensure business exists in user_business table.');
    }
    
    // 2. Clear or create 5 specific services
    console.log('Setting up 5 specialized services...');
    // We'll mark them as existing or create them if missing.
    const serviceTemplates = [
        { name: 'Šišanje + Pranje', duration: 30, price: 20.00 },
        { name: 'Bojanje kose', duration: 90, price: 60.00 },
        { name: 'Fen frizura', duration: 45, price: 25.00 },
        { name: 'Masaža glave', duration: 15, price: 10.00 },
        { name: 'Svečana frizura', duration: 120, price: 100.00 },
    ];

    for (const s of serviceTemplates) {
        // Check if exists
        const [existing] = await pool.query('SELECT id FROM services WHERE business_id = ? AND name = ?', [businessId, s.name]);
        if (existing.length === 0) {
            await pool.query('INSERT INTO services (business_id, name, description, duration_minutes, price) VALUES (?, ?, ?, ?, ?)', 
                [businessId, s.name, 'Generated for testing', s.duration, s.price]);
        }
    }

    const [services] = await pool.query(`SELECT id, duration_minutes, price FROM services WHERE business_id = ?`, [businessId]);

    // 3. Create or get clients
    const [existingClients] = await pool.query(`SELECT id FROM clients WHERE business_id = ?`, [businessId]);
    let clients = existingClients.map(c => c.id);
    
    if (clients.length < 50) {
      console.log('Generating dummy clients...');
      for (let i = 1; i <= 30; i++) {
        const [res] = await pool.query(
          `INSERT INTO clients (business_id, name, phone, email, notes) VALUES (?, ?, ?, ?, ?)`,
          [businessId, `Klijent Test ${i}`, `+38599${Math.floor(1000000 + Math.random()*9000000)}`, `klijent${i}@example.com`, `Seed data`]
        );
        clients.push(res.insertId);
      }
    }

    console.log(`Using business ${businessId} with ${clients.length} clients, ${services.length} services, ${staff.length} staff.`);

    // 4. Generate Appointments
    const appointments = [];
    const now = new Date();
    
    // Total ~400 appointments
    const statuses = ['completed', 'completed', 'completed', 'cancelled', 'no_show', 'completed', 'completed'];

    for (let i = 0; i < 400; i++) {
        // We want a preference for the last 60 days
        let daysAgo;
        if (Math.random() > 0.3) {
            daysAgo = Math.floor(Math.random() * 60); // 70% in last 2 months
        } else {
            daysAgo = Math.floor(Math.random() * 180); // 30% spread across 6 months
        }

        const hour = 8 + Math.floor(Math.random() * 11); // 08:00 - 19:00
        const minuteChoices = ['00', '15', '30', '45'];
        const minute = minuteChoices[Math.floor(Math.random() * minuteChoices.length)];
        
        const d = new Date();
        d.setDate(now.getDate() - daysAgo);
        d.setHours(hour, parseInt(minute), 0, 0);

        // Skip sundays 
        if (d.getDay() === 0) continue;

        const clientId = clients[Math.floor(Math.random() * clients.length)];
        const service = services[Math.floor(Math.random() * services.length)];
        const staffMember = staff[Math.floor(Math.random() * staff.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        // Random actor_id (could be same as staff or owner)
        const actorId = staff[Math.floor(Math.random() * staff.length)].id;

        const datetimeStr = d.toISOString().slice(0, 19).replace('T', ' ');

        appointments.push([
            businessId,
            clientId,
            service.id,
            staffMember.id,
            datetimeStr,
            actorId,
            status
        ]);
    }

    console.log(`Inserting ${appointments.length} appointments into business 5...`);
    
    for (const appt of appointments) {
        await pool.query(`
            INSERT INTO appointment (business_id, client_id, service_id, assigned_to_user_id, appointment_datetime, user_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, appt);
    }

    console.log('Seeding completed successfully! Refresh your Analytics page.');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
