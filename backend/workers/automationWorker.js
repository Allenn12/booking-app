import cron from 'node-cron';
import pool from '../config/database.js';
import AutomationService from '../services/AutomationService.js';

let isRunning = false;

// Run every 10 minutes
const automationWorker = cron.schedule('*/10 * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    
    try {
        const [automations] = await pool.query(`
            SELECT * FROM automations 
            WHERE status = 'enabled'
        `);

        if (automations.length > 0) {
            console.log(`[AutomationWorker] Found ${automations.length} enabled automations to evaluate.`);
        }

        for (const auto of automations) {
            try {
                // Parse config
                auto.config = typeof auto.config === 'string' ? JSON.parse(auto.config) : auto.config;

                if (auto.type === 'lapsed_clients') {
                    const clientIds = await AutomationService.evaluateLapsed(auto);
                    for (const cid of clientIds) {
                        await AutomationService.sendToClient(auto, cid, null);
                    }
                } 
                else if (auto.type === 'post_visit') {
                    const targets = await AutomationService.evaluatePostVisit(auto);
                    for (const target of targets) {
                        await AutomationService.sendToClient(auto, target.clientId, target.appointmentId);
                    }
                }
                else if (auto.type === 'birthday') {
                    const clientIds = await AutomationService.evaluateBirthday(auto);
                    for (const cid of clientIds) {
                        await AutomationService.sendToClient(auto, cid, null);
                    }
                }

                // Update last run
                await pool.query('UPDATE automations SET last_run_at = NOW() WHERE id = ?', [auto.id]);

            } catch (err) {
                console.error(`[AutomationWorker] Error evaluating automation ${auto.id}:`, err);
            }
        }
    } catch (error) {
        console.error('[AutomationWorker] Top-level error:', error);
    } finally {
        isRunning = false;
    }
});

console.log('✅ Automation Worker started successfully');
export default automationWorker;
