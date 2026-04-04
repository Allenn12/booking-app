import express from 'express';
import { PublicBookingController } from '../../controllers/api/publicBookingController.js';

import { publicBookingGetLimiter, publicBookingPostLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

// No auth middleware — these are public endpoints
router.get('/:slug', publicBookingGetLimiter, PublicBookingController.getBusinessInfo);
router.get('/:slug/availability', publicBookingGetLimiter, PublicBookingController.getAvailability);
router.get('/:slug/availability-range', publicBookingGetLimiter, PublicBookingController.getAvailabilityRange);
router.get('/:slug/confirmation/:bookingId', publicBookingGetLimiter, PublicBookingController.getBookingConfirmation);
router.post('/:slug', publicBookingPostLimiter, PublicBookingController.createBooking);

export default router;
