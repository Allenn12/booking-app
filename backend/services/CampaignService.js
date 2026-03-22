import pool from '../config/database.js';
import SegmentService from './SegmentService.js';
import NotificationService from './NotificationService.js';
import TemplateEngine from './TemplateEngine.js';

const CampaignService = {
  async createCampaign(businessId, userId, data) {
    const { name, channel, segment_id, client_id, template_id, inline_message } = data;
    
    // Validate segment_id belongs to business if provided
    if (segment_id) {
        const [segRows] = await pool.query('SELECT id FROM segments WHERE id = ? AND business_id = ?', [segment_id, businessId]);
        if (segRows.length === 0) throw new Error('Invalid segment');
    }

    // Validate client_id belongs to business if provided
    if (client_id) {
        const [clientRows] = await pool.query('SELECT id FROM clients WHERE id = ? AND business_id = ?', [client_id, businessId]);
        if (clientRows.length === 0) throw new Error('Invalid client');
    }

    const sql = `
      INSERT INTO campaigns (business_id, name, channel, segment_id, template_id, inline_message, status, created_by_user_id) 
      VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)
    `;
    const [result] = await pool.query(sql, [businessId, name, channel || 'sms', segment_id || null, template_id || null, inline_message || null, userId]);
    
    const campaignId = result.insertId;

    // If targeting a single client, pre-insert them as the only recipient
    if (client_id) {
      await pool.query(
        'INSERT IGNORE INTO campaign_recipients (campaign_id, client_id, status) VALUES (?, ?, ?)',
        [campaignId, client_id, 'pending']
      );
    }

    return { id: campaignId, status: 'draft' };
  },

  async previewRecipients(campaignId) {
    const [campRows] = await pool.query('SELECT business_id, segment_id FROM campaigns WHERE id = ?', [campaignId]);
    if (campRows.length === 0) throw new Error('Campaign not found');
    const camp = campRows[0];

    let segment = { type: 'all_clients' };
    if (camp.segment_id) {
       const [segRows] = await pool.query('SELECT type, rules FROM segments WHERE id = ?', [camp.segment_id]);
       if (segRows.length > 0) segment = segRows[0];
    }

    const count = await SegmentService.countForSegment(camp.business_id, segment);
    const clientIds = await SegmentService.getClientIdsForSegment(camp.business_id, segment);
    
    // Get sample 5
    let sample = [];
    if (clientIds.length > 0) {
       const [samples] = await pool.query(`SELECT name, phone FROM clients WHERE id IN (?) LIMIT 5`, [clientIds]);
       sample = samples;
    }

    return { count, sample };
  },

  async scheduleCampaign(campaignId, scheduledAt) {
    const sql = `UPDATE campaigns SET status = 'scheduled', scheduled_at = ? WHERE id = ? AND status = 'draft'`;
    const [result] = await pool.query(sql, [scheduledAt, campaignId]);
    if (result.affectedRows === 0) throw new Error('Cannot schedule: invalid status or campaign not found');
  },

  async cancelCampaign(campaignId) {
    const sql = `UPDATE campaigns SET status = 'cancelled' WHERE id = ? AND status IN ('draft', 'scheduled', 'running')`;
    await pool.query(sql, [campaignId]);
  },

  async sendNow(campaignId) {
    const sql = `UPDATE campaigns SET status = 'scheduled', scheduled_at = NOW() WHERE id = ? AND status = 'draft'`;
    const [result] = await pool.query(sql, [campaignId]);
    if (result.affectedRows === 0) throw new Error('Cannot send: invalid status or campaign not found');
    
    // In real system this might trigger a worker immediately, or worker picks it up
    // For TDD purposes we will call processCampaign in tests.
  },

  async processCampaign(campaignId) {
    // 1. Mark running
    const [updateRun] = await pool.query(`UPDATE campaigns SET status = 'running', started_at = NOW() WHERE id = ? AND status = 'scheduled'`, [campaignId]);
    if (updateRun.affectedRows === 0) return; // Already running, or cancelled

    // 2. Fetch campaign
    const [campRows] = await pool.query('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
    const camp = campRows[0];

    // 3. Evaluate segment
    let segment = { type: 'all_clients' };
    if (camp.segment_id) {
       const [segRows] = await pool.query('SELECT type, rules FROM segments WHERE id = ?', [camp.segment_id]);
       if (segRows.length > 0) segment = segRows[0];
    }
    const clientIds = await SegmentService.getClientIdsForSegment(camp.business_id, segment);

    // 4. Batch INSERT IGNORE recipients
    // Only resolve segment if no recipients were pre-inserted (e.g. single-client campaigns)
    const [existingRecipients] = await pool.query(
      'SELECT COUNT(*) as count FROM campaign_recipients WHERE campaign_id = ?',
      [campaignId]
    );
    const hasPreInsertedRecipients = existingRecipients[0].count > 0;

    if (!hasPreInsertedRecipients && clientIds.length > 0) {
      const values = clientIds.map(cid => [campaignId, cid, 'pending']);
      await pool.query('INSERT IGNORE INTO campaign_recipients (campaign_id, client_id, status) VALUES ?', [values]);
    }

    const totalRecipients = hasPreInsertedRecipients ? existingRecipients[0].count : clientIds.length;
    await pool.query('UPDATE campaigns SET total_recipients = ? WHERE id = ?', [totalRecipients, campaignId]);

    // 5. Build template
    let templateText = camp.inline_message;
    if (camp.template_id) {
       const [tplRows] = await pool.query('SELECT content FROM message_templates WHERE id = ?', [camp.template_id]);
       if (tplRows.length > 0) templateText = tplRows[0].content;
    }

    // 6. Process recipients
    const [recipients] = await pool.query(`
        SELECT cr.id, cr.client_id, c.name, c.phone, c.marketing_opt_out 
        FROM campaign_recipients cr
        JOIN clients c ON cr.client_id = c.id
        WHERE cr.campaign_id = ? AND cr.status = 'pending'
    `, [campaignId]);

    let sentCount = 0;
    let failedCount = 0;
    let campaignFailed = false;

    for (const r of recipients) {
        if (!r.phone || r.marketing_opt_out === 1) {
             await pool.query(`UPDATE campaign_recipients SET status='skipped', error_message='No phone or opt out' WHERE id=?`, [r.id]);
             failedCount++;
             continue;
        }

        const contextData = { clientName: r.name || 'Klijent' };
        // We do minimal context since campaigns don't have appointments
        
        const rendered = templateText ? TemplateEngine.render(templateText, contextData) : '';
        
        try {
            const sendResult = await NotificationService.sendRaw(camp.business_id, r.client_id, r.phone, rendered, 'campaign', camp.id);
            
            if (sendResult.success) {
                await pool.query(`UPDATE campaign_recipients SET status='sent', sent_at=NOW(), notif_log_id=? WHERE id=?`, [sendResult.logId, r.id]);
                sentCount++;
            } else {
                await pool.query(`UPDATE campaign_recipients SET status='failed', error_message=? WHERE id=?`, [sendResult.reason, r.id]);
                failedCount++;
                
                if (sendResult.reason === 'Insufficient credits') {
                    campaignFailed = true;
                    // Skip remaining
                    await pool.query(`UPDATE campaign_recipients SET status='skipped', error_message='Insufficient credits' WHERE campaign_id=? AND status='pending'`, [campaignId]);
                    break;
                }
            }
        } catch (err) {
            await pool.query(`UPDATE campaign_recipients SET status='failed', error_message=? WHERE id=?`, [err.message, r.id]);
            failedCount++;
        }
    }

    // 7. Mark completed / failed
    const finalStatus = campaignFailed ? 'failed' : 'completed';
    await pool.query(`UPDATE campaigns SET status = ?, completed_at = NOW(), sent_count = ?, failed_count = ? WHERE id = ?`, 
        [finalStatus, sentCount, failedCount, campaignId]);
  }
};

export default CampaignService;
