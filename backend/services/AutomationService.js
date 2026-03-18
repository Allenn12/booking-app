import pool from '../config/database.js';
import NotificationService from './NotificationService.js';
import TemplateEngine from './TemplateEngine.js';

const AutomationService = {
  /**
   * Evaluate Lapsed Clients Automation
   * @param {Object} automation { id, business_id, config: { lapsed_days, cooldown_days } }
   * @returns {Promise<number[]>} Array of client IDs
   */
  async evaluateLapsed(automation) {
    const { id, business_id, config } = automation;
    const lapsedDays = config.lapsed_days || 90;
    const cooldownDays = config.cooldown_days || 60;

    const sql = `
      SELECT c.id 
      FROM clients c
      WHERE c.business_id = ? 
        AND c.phone != 'WALKIN'
        AND c.phone IS NOT NULL
        AND c.marketing_opt_out = 0
        AND c.last_appointment_at IS NOT NULL
        AND c.last_appointment_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        AND c.id NOT IN (
            SELECT client_id 
            FROM automation_logs 
            WHERE automation_id = ? 
              AND sent_at > DATE_SUB(NOW(), INTERVAL ? DAY)
        )
    `;
    const [rows] = await pool.query(sql, [business_id, lapsedDays, id, cooldownDays]);
    return rows.map(r => r.id);
  },

  /**
   * Evaluate Post-Visit Automation
   * @param {Object} automation { id, business_id, config: { delay_hours } }
   * @returns {Promise<Array<{clientId: number, appointmentId: number}>>}
   */
  async evaluatePostVisit(automation) {
      const { id, business_id, config } = automation;
      const delayHours = config.delay_hours || 24;

      const sql = `
          SELECT a.id as appointmentId, a.client_id as clientId
          FROM appointment a
          JOIN clients c ON a.client_id = c.id
          WHERE a.business_id = ?
            AND a.status = 'completed'
            AND a.appointment_datetime < DATE_SUB(NOW(), INTERVAL ? HOUR)
            AND c.phone != 'WALKIN'
            AND c.phone IS NOT NULL
            AND c.marketing_opt_out = 0
            AND a.id NOT IN (
                SELECT appointment_id 
                FROM automation_logs 
                WHERE automation_id = ? AND appointment_id IS NOT NULL
            )
      `;
      const [rows] = await pool.query(sql, [business_id, delayHours, id]);
      return rows;
  },

  /**
   * Evaluate Birthday Automation
   * @param {Object} automation { id, business_id, config: { send_hour? } }
   * @returns {Promise<number[]>} Array of client IDs
   */
  async evaluateBirthday(automation) {
      const { id, business_id, config } = automation;
      // Option to check hour later if needed `WHERE HOUR(NOW()) = config.send_hour`
      
      const sql = `
          SELECT c.id
          FROM clients c
          WHERE c.business_id = ?
            AND c.phone != 'WALKIN'
            AND c.phone IS NOT NULL
            AND c.marketing_opt_out = 0
            AND c.birth_date IS NOT NULL
            AND MONTH(c.birth_date) = MONTH(CURDATE())
            AND DAY(c.birth_date) = DAY(CURDATE())
            AND c.id NOT IN (
                SELECT client_id 
                FROM automation_logs 
                WHERE automation_id = ? 
                  AND YEAR(sent_at) = YEAR(CURDATE())
            )
      `;
      const [rows] = await pool.query(sql, [business_id, id]);
      return rows.map(r => r.id);
  },

  /**
   * Send automation message to client
   * @param {Object} automation { id, business_id, template_id, inline_message }
   * @param {number} clientId 
   * @param {number} appointmentId (optional)
   */
  async sendToClient(automation, clientId, appointmentId = null) {
      const { id, business_id, template_id, inline_message } = automation;

      const [cRows] = await pool.query('SELECT name, phone FROM clients WHERE id = ?', [clientId]);
      if (cRows.length === 0) return;
      const client = cRows[0];

      // Build Template
      let templateText = inline_message;
      if (template_id) {
          const [tplRows] = await pool.query('SELECT content FROM message_templates WHERE id = ?', [template_id]);
          if (tplRows.length > 0) templateText = tplRows[0].content;
      }

      // Minimal context (add service name if post_visit later if needed)
      const contextData = { clientName: client.name || 'Klijent' };
      const rendered = templateText ? TemplateEngine.render(templateText, contextData) : '';

      try {
          const sendResult = await NotificationService.sendRaw(
              business_id, 
              clientId, 
              client.phone, 
              rendered, 
              'automation', 
              id
          );

          // Always log to automation_logs to prevent retries if fake-send succeeds
          // Even if send fail due to invalid phone, we might still want to insert skipped to not try forever?
          // For now let's log only if actually processed (success or low credits)
          // If low credits, NotificationService marks false, we skip logging so it retries later when credits added?
          // Actually, if it's failed but we don't log, it spams every minute.
          
          await pool.query(`
              INSERT INTO automation_logs (automation_id, client_id, appointment_id, notif_log_id, sent_at)
              VALUES (?, ?, ?, ?, NOW())
              ON DUPLICATE KEY UPDATE sent_at = NOW()
          `, [id, clientId, appointmentId, sendResult.logId || null]);
          
      } catch (err) {
          console.error(`Error sending automation ${id} to ${clientId}:`, err);
      }
  }
};

export default AutomationService;
