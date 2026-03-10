import express from 'express';
import BusinessController from '../../controllers/api/businessController.js';
import authMiddleware from '../../middleware/authMiddleware.js';
import TeamController from '../../controllers/api/teamController.js';
import ServiceController from '../../controllers/api/serviceController.js';
import AppointmentController from '../../controllers/api/appointmentController.js';
import DashboardController from '../../controllers/api/dashboardController.js';

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

export default router;