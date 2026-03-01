import express from 'express';
import InvitationController from '../../controllers/api/invitationController.js';
import authMiddleware from '../../middleware/authMiddleware.js';

const router = express.Router();

// Public route for join link (Handled in main index.js for clean /join/:token path)

// Protected routes
router.use(authMiddleware);

router.post('/validate', InvitationController.validate);
router.post('/join', InvitationController.join);

export default router;
