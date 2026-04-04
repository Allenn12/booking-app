import pool from './config/database.js';
import AvailabilityService from './services/AvailabilityService.js';
import Appointment from './models/Appointment.js';
import Client from './models/Client.js';
import Business from './models/Business.js';

async function main() {
    const businessId = 5;
    const date = '2026-03-26'; 
    
    try {
        const [businessRows] = await pool.query('SELECT name, owner_user_id FROM business WHERE id = ?', [businessId]);
        const business = businessRows[0];
        if (!business) {
            console.error('Business ID 5 not found');
            process.exit(1);
        }
        
        // Count existing appointments for date
        const [aptCount] = await pool.query('SELECT COUNT(*) as count FROM appointment WHERE business_id = ? AND DATE(appointment_datetime) = ? AND deleted_at IS NULL', [businessId, date]);
        const currentCount = aptCount[0].count;
        console.log(`Current existing appointments for today: ${currentCount}`);

        // Get workers
        const [team] = await pool.query(`SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name FROM user u JOIN user_business ub ON u.id = ub.user_id WHERE ub.business_id = ?`, [businessId]);

        // Fetch any service
        const [services] = await pool.query('SELECT id, name, duration_minutes FROM services WHERE business_id = ? AND is_active = 1 LIMIT 1', [businessId]);
        const service = services[0];
        console.log(`Using service: ${service.name} (${service.duration_minutes}m)`);

        let totalBooked = 0;
        const testPhone = '+385919991111';
        let clientId;
        const existingClient = await Client.findByPhone(businessId, testPhone);
        if (existingClient) clientId = existingClient.id;
        else clientId = await Client.create(businessId, { name: 'Filler Test', phone: testPhone });

        for (const worker of team) {
            console.log(`\nChecking worker: ${worker.name} (ID: ${worker.id})...`);
            try {
                // Correct Argument Order: (businessId, workerId, serviceId, date)
                const slotsObj = await AvailabilityService.getAvailableSlots(businessId, worker.id, service.id, date);
                const slots = slotsObj || []; // Some versions return array directly, some return { slots: [] }
                const realSlots = Array.isArray(slots) ? slots : (slots.slots || []);
                
                console.log(`- Found ${realSlots.length} available slots.`);

                for (const slot of realSlots) {
                    await Appointment.create({
                        business_id: businessId,
                        client_id: clientId,
                        service_id: service.id,
                        assigned_to_user_id: worker.id,
                        name: 'Test Filler',
                        phone: testPhone,
                        appointment_datetime: `${date} ${slot.time}`,
                        user_id: business.owner_user_id,
                        status: 'scheduled'
                    });
                    totalBooked++;
                    process.stdout.write('+');
                }
            } catch (e) {
                console.error(`- FAULT for ${worker.name}:`, e.message);
                console.error(e.stack);
            }
        }
        
        process.stdout.write('\n');
        console.log(`DONE. Created ${totalBooked} NEW appointments for today (ID=5).`);
        process.exit(0);
    } catch (err) {
        console.error('CRASH:', err);
        process.exit(1);
    }
}

main();
