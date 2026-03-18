import cron from 'node-cron';
import pool from '../config/database.js';
import CampaignService from '../services/CampaignService.js';

let isRunning = false;

// Run every 2 minutes
const campaignWorker = cron.schedule('*/2 * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    
    try {
        const [campaigns] = await pool.query(`
            SELECT id FROM campaigns 
            WHERE status = 'scheduled' 
              AND scheduled_at <= NOW()
        `);

        if (campaigns.length > 0) {
            console.log(`[CampaignWorker] Found ${campaigns.length} scheduled campaigns to process.`);
        }

        for (const camp of campaigns) {
            try {
                // processCampaign marks it as running immediately
                await CampaignService.processCampaign(camp.id);
            } catch (err) {
                console.error(`[CampaignWorker] Error processing campaign ${camp.id}:`, err);
            }
        }
    } catch (error) {
        console.error('[CampaignWorker] Top-level error:', error);
    } finally {
        isRunning = false;
    }
});

console.log('✅ Campaign Worker started successfully');
export default campaignWorker;
