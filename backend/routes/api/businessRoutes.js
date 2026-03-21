import express from 'express';
import BusinessController from '../../controllers/api/businessController.js';
import authMiddleware from '../../middleware/authMiddleware.js';
import TeamController from '../../controllers/api/teamController.js';
import ServiceController from '../../controllers/api/serviceController.js';
import AppointmentController from '../../controllers/api/appointmentController.js';
import DashboardController from '../../controllers/api/dashboardController.js';
import ClientController from '../../controllers/api/clientController.js';
import MarketingController from '../../controllers/api/marketingController.js';
import AnalyticsController from '../../controllers/api/analyticsController.js';
import { validateBusinessOwner } from '../../middleware/businessMiddleware.js';
const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Business routes
router.post('/', BusinessController.create);              // POST /api/v1/business
router.get('/my', BusinessController.getMyBusinesses);    // GET /api/v1/business/my
router.post('/select', BusinessController.selectBusiness); // POST /api/v1/business/select
router.get('/:id/dashboard', DashboardController.getStats); // GET /api/v1/business/:id/dashboard
router.get('/:id', BusinessController.getById);           // GET /api/v1/business/:id
router.patch('/:id', BusinessController.update);          // PATCH /api/v1/business/:id
router.get('/:id/team', TeamController.getTeam);          // GET /api/v1/business/:id/team
router.patch('/:id/team/:userId/role', TeamController.updateRole); // PATCH /api/v1/business/:id/team/:userId/role
router.delete('/:id/team/:userId', TeamController.removeMember); // DELETE /api/v1/business/:id/team/:userId
router.get('/:id/services', BusinessController.getServices); // GET /api/v1/business/:id/services
router.post('/:id/services', ServiceController.create);      // POST /api/v1/business/:id/services
router.put('/:id/services/:serviceId', ServiceController.update); // PUT /api/v1/business/:id/services/:serviceId
router.delete('/:id/services/:serviceId', ServiceController.delete); // DELETE /api/v1/business/:id/services/:serviceId
router.get('/:id/billing', BusinessController.getBilling); // GET /api/v1/business/:id/billing
router.get('/:id/templates', BusinessController.getTemplates); // GET /api/v1/business/:id/templates
router.post('/:id/templates', BusinessController.updateTemplates); // POST /api/v1/business/:id/templates

// Client routes
router.get('/:id/clients/search', ClientController.searchClients);    // GET /api/v1/business/:id/clients/search?q=...
router.get('/:id/clients', ClientController.getClients);              // GET /api/v1/business/:id/clients
router.get('/:id/clients/:clientId', ClientController.getClientDetail); // GET /api/v1/business/:id/clients/:clientId
router.patch('/:id/clients/:clientId/notes', ClientController.updateClientNotes); // PATCH notes

// Marketing routes (Require Owner/Admin)
router.use('/:id/marketing', validateBusinessOwner);

router.get('/:id/marketing/segments', MarketingController.getSegments);
router.post('/:id/marketing/segments', MarketingController.createSegment);
router.get('/:id/marketing/segments/:segmentId', MarketingController.getSegmentById);
router.put('/:id/marketing/segments/:segmentId', MarketingController.updateSegment);
router.delete('/:id/marketing/segments/:segmentId', MarketingController.deleteSegment);
router.get('/:id/marketing/segments/:segmentId/preview', MarketingController.previewSegment);

router.get('/:id/marketing/campaigns', MarketingController.getCampaigns);
router.post('/:id/marketing/campaigns', MarketingController.createCampaign);
router.get('/:id/marketing/campaigns/:campaignId', MarketingController.getCampaignById);
router.put('/:id/marketing/campaigns/:campaignId', MarketingController.updateCampaign);
router.delete('/:id/marketing/campaigns/:campaignId', MarketingController.deleteCampaign);
router.get('/:id/marketing/campaigns/:campaignId/preview', MarketingController.previewCampaign);
router.post('/:id/marketing/campaigns/:campaignId/send', MarketingController.sendCampaignNow);
router.post('/:id/marketing/campaigns/:campaignId/schedule', MarketingController.scheduleCampaign);
router.post('/:id/marketing/campaigns/:campaignId/cancel', MarketingController.cancelCampaign);
router.get('/:id/marketing/campaigns/:campaignId/recipients', MarketingController.getRecipients);

router.get('/:id/marketing/automations', MarketingController.getAutomations);
router.post('/:id/marketing/automations', MarketingController.createAutomation);
router.get('/:id/marketing/automations/:automationId', MarketingController.getAutomationById);
router.put('/:id/marketing/automations/:automationId', MarketingController.updateAutomation);
router.delete('/:id/marketing/automations/:automationId', MarketingController.deleteAutomation);
router.post('/:id/marketing/automations/:automationId/enable', MarketingController.enableAutomation);
router.post('/:id/marketing/automations/:automationId/disable', MarketingController.disableAutomation);
router.get('/:id/marketing/automations/:automationId/stats', MarketingController.getAutomationStats);

// Analytics routes (Require Owner/Admin)
router.get('/:id/analytics/overview', AnalyticsController.getOverview);
router.get('/:id/analytics/revenue',  AnalyticsController.getRevenue);
router.get('/:id/analytics/clients',  AnalyticsController.getClients);
router.get('/:id/analytics/staff',    AnalyticsController.getStaff);

export default router;