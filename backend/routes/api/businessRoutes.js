import express from 'express';
import BusinessController from '../../controllers/api/businessController.js';
import authMiddleware from '../../middleware/authMiddleware.js';
import TeamController from '../../controllers/api/teamController.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Business routes
router.post('/', BusinessController.create);              // POST /api/v1/business
router.get('/my', BusinessController.getMyBusinesses);    // GET /api/v1/business/my
router.get('/:id', BusinessController.getById);           // GET /api/v1/business/:id
router.put('/:id', BusinessController.update);            // PUT /api/v1/business/:id
router.get('/:id/team', TeamController.getTeam);

export default router;