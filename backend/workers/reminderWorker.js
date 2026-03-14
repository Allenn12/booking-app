import cron from 'node-cron';
import pool from '../config/database.js';
import NotificationService from '../services/NotificationService.js';
import Business from '../models/Business.js';

let isRunning = false;

// Run every minute
cron.schedule('* * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    
    try {
        // Find reminders that are due:
        // Join with appointment to get appointment_datetime, check if appointment_datetime - minutes_before <= NOW()
        const [reminders] = await pool.query(`
            SELECT r.id, r.appointment_id, r.minutes_before, a.business_id, a.client_id, a.service_id, a.assigned_to_user_id, a.appointment_datetime
            FROM appointment_reminders r
            JOIN appointment a ON r.appointment_id = a.id
            WHERE r.sent = 0 
              AND a.status = 'scheduled'
              AND DATE_SUB(a.appointment_datetime, INTERVAL r.minutes_before MINUTE) <= NOW()
        `);

        if (reminders.length > 0) {
            console.log(`[ReminderWorker] Found ${reminders.length} pending reminders to process.`);
        }

        for (const reminder of reminders) {
            try {
                const fullBusiness = await Business.getById(reminder.business_id);
                
                // Fetch context data
                const [cli] = await pool.query('SELECT id, name, phone FROM clients WHERE id=?', [reminder.client_id]);
                const [serv] = await pool.query('SELECT name FROM services WHERE id=?', [reminder.service_id]);
                const [emp] = await pool.query('SELECT first_name FROM user WHERE id=?', [reminder.assigned_to_user_id]);

                if (cli.length > 0) {
                    const clientData = {
                        id: cli[0].id,
                        first_name: cli[0].name,
                        phone: cli[0].phone
                    };

                    const contextData = {
                        clientName: clientData.first_name || 'Klijent',
                        time: new Date(reminder.appointment_datetime).toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'short' }),
                        serviceName: serv[0]?.name || 'usluga',
                        employeeName: emp[0]?.first_name || 'naš djelatnik',
                        businessName: fullBusiness?.name || 'naš salon'
                    };

                    // Send the reminder
                    const sent = await NotificationService.send(
                        fullBusiness.id,
                        reminder.appointment_id,
                        clientData.id,
                        clientData.phone,
                        'reminder',
                        contextData
                    );

                    // If NotificationService processed it (even if failed due to credits/schema), mark as done to not loop forever
                    // If it returned false explicitly due to toggles, or insufficient credits, we still mark it sent=1 so it doesn't spam
                    await pool.query('UPDATE appointment_reminders SET sent = 1, sent_at = NOW() WHERE id = ?', [reminder.id]);
                } else {
                     // Client missing? mark as sent to clear the queue
                     await pool.query('UPDATE appointment_reminders SET sent = 1, sent_at = NOW() WHERE id = ?', [reminder.id]);
                }
            } catch (err) {
                console.error(`[ReminderWorker] Error processing reminder ${reminder.id}:`, err);
            }
        }
    } catch (error) {
        console.error('[ReminderWorker] Top-level error:', error);
    } finally {
        isRunning = false;
    }
});

console.log('✅ Reminder Worker started successfully');
export default cron;
