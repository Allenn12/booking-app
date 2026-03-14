import express from 'express';
import apiAuthRoutes from './api/auth.js';
import pagesRoutes from './pages.js';
import apiBusinessRoutes from './api/businessRoutes.js';
import countryRoutes from './api/countries.js';
import invitationRoutes from './api/invitationRoutes.js';
import appointmentRoutes from './api/appointmentRoutes.js';
import jobRoutes from './api/jobRoutes.js';
import publicBookingRoutes from './api/publicBookingRoutes.js';
import InvitationController from '../controllers/api/invitationController.js';
const router = express.Router();

// Public routes (no auth required)
router.use('/api/v1/public/book', publicBookingRoutes);

router.use('/api/v1/auth', apiAuthRoutes);
router.use('/api/v1/business', apiBusinessRoutes)
router.use('/api/v1/countries', countryRoutes);
router.use('/api/v1/invitations', invitationRoutes);
router.use('/api/v1/appointments', appointmentRoutes);
router.use('/api/v1/jobs', jobRoutes);
router.get('/join/:token', InvitationController.handlePublicLink); // Direct public link
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running' });
});
router.use('/', pagesRoutes);

export default router;