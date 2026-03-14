import pool from '../config/database.js';
import Business from '../models/Business.js';
import TemplateEngine from './TemplateEngine.js';

const DEFAULT_TEMPLATES = {
    confirmation: 'Poštovani/a {ime}, vaš termin za {usluga} je potvrđen za {vrijeme}. {biznis}',
    reminder: 'Podsjetnik: sutra u {vrijeme} imate zakazan termin za {usluga} kod {radnik}. {biznis}',
    cancellation: 'Obavijest: vaš termin za {usluga} ({vrijeme}) je otkazan. Javite nam se za novi termin. {biznis}'
};

export const NotificationService = {
  
  async send(businessId, appointmentId, userId, clientPhone, templateType, contextData) {
     // 1. Fetch business toggles and credits
     const business = await Business.getById(businessId);
     if (!business) return false;

     // MASTER TOGGLE CHECK
     if (!business.sms_enabled) {
         console.log(`[NotificationService] Messaging disabled for business ${businessId}, skipping notification.`);
         return false;
     }

     // TYPE TOGGLE CHECK
     if (templateType === 'confirmation' && !business.send_confirmation) return false;
     if (templateType === 'reminder' && !business.send_reminder) return false;
     if (templateType === 'cancellation' && !business.send_cancellation) return false;

     if (!clientPhone) {
         console.log(`[NotificationService] Missing client phone, skipping.`);
         return false;
     }

     // 2. Fetch templates
     const [rows] = await pool.query('SELECT content FROM message_templates WHERE business_id = ? AND type = ?', [businessId, templateType]);
     let templateText = rows.length > 0 ? rows[0].content : DEFAULT_TEMPLATES[templateType];

     // 3. Render
     const finalMessage = TemplateEngine.render(templateText, contextData);

     // 4. Check credits (assume 1 msg = 1 credit for now)
     const cost = 1;

     if (business.sms_credits < cost) {
       console.log(`[NotificationService] Insufficient credits for business ${businessId}.`);
       await this.logNotification(businessId, appointmentId, business.owner_user_id, templateType, clientPhone, finalMessage, 'failed', 'Insufficient credits');
       return false;
     }

     // 5. Deduct Credit
     const successDeduct = await Business.deductCredits(businessId, cost);
     if (!successDeduct) return false;

     // Log transaction
     await pool.query(
        'INSERT INTO credit_transactions (user_id, business_id, amount, transaction_type, description, balance_after) VALUES (?, ?, ?, ?, ?, ?)',
        [business.owner_user_id, businessId, -cost, 'sms_sent', `SMS sent for ${templateType}`, business.sms_credits - cost]
     );

     // 6. FAKE SMS PROVIDER
     console.log(`\n\n[FAKE SMS PROVIDER] -------------------------`);
     console.log(`To: ${clientPhone}`);
     console.log(`Type: ${templateType.toUpperCase()}`);
     console.log(`Content:\n${finalMessage}`);
     console.log(`----------------------------------------------\n\n`);

     // 7. Log Success
     await this.logNotification(businessId, appointmentId, business.owner_user_id, templateType, clientPhone, finalMessage, 'sent', null);
     return true;
  },

  async logNotification(businessId, appointmentId, userId, type, phone, message, status, failedReason) {
      const sql = `INSERT INTO notification_logs (business_id, appointment_id, user_id, notification_type, channel, recipient_phone, message_text, status, sent_at, failed_reason) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`;
      await pool.query(sql, [
          businessId, 
          appointmentId || null, 
          userId || null, 
          type, 
          'sms', 
          phone, 
          message, 
          status, 
          failedReason || null
      ]);
  },

  async scheduleReminder(businessId, appointmentId, startTime) {
      const business = await Business.getById(businessId);
      if (!business || !business.sms_enabled || !business.send_reminder) return;

      const apptTime = new Date(startTime).getTime();
      const now = Date.now();
      const minutesBefore = 24 * 60; // 24 hours
      
      const triggerTime = new Date(apptTime - (minutesBefore * 60 * 1000));
      
      if (triggerTime > now) {
          await pool.query(
              'INSERT INTO appointment_reminders (appointment_id, minutes_before) VALUES (?, ?)',
              [appointmentId, minutesBefore]
          );
      }
  },

  async handleAppointmentCreated(appointment, clientUser, business, service, employee) {
      if (!clientUser || !clientUser.phone) return;
      
      const contextData = {
          clientName: clientUser.first_name || 'Klijent',
          time: new Date(appointment.start_time).toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'short' }),
          serviceName: service?.name || 'usluga',
          employeeName: employee?.first_name || 'naš djelatnik',
          businessName: business?.name || 'naš salon'
      };
      
      await this.send(business.id, appointment.id, clientUser.id, clientUser.phone, 'confirmation', contextData);
      
      // Schedule reminder
      await this.scheduleReminder(business.id, appointment.id, appointment.start_time);
  },

  async handleAppointmentCancelled(appointment, clientUser, business, service, employee) {
      if (!clientUser || !clientUser.phone) return;
      
      const contextData = {
          clientName: clientUser.first_name || 'Klijent',
          time: new Date(appointment.start_time).toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'short' }),
          serviceName: service?.name || 'usluga',
          employeeName: employee?.first_name || 'naš djelatnik',
          businessName: business?.name || 'naš salon'
      };
      
      await this.send(business.id, appointment.id, clientUser.id, clientUser.phone, 'cancellation', contextData);
  }
};

export default NotificationService;

