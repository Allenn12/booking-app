import express from 'express';
import { PublicBookingController } from '../../controllers/api/publicBookingController.js';

const router = express.Router();

// No auth middleware — these are public endpoints
router.get('/:slug', PublicBookingController.getBusinessInfo);
router.get('/:slug/availability', PublicBookingController.getAvailability);
router.post('/:slug', PublicBookingController.createBooking);

export default router;
