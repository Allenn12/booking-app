/**
 * Portal Routes
 * =============
 * All routes are PUBLIC — no session auth required (token-based portal).
 *
 * Route order matters:
 *   /lookup must be registered BEFORE /:token
 *   to prevent 'lookup' being matched as a token value.
 */

import express from 'express';
import {
    portalGetLimiter,
    portalCancelLimiter,
    portalLookupLimiter,
} from '../../middleware/rateLimiter.js';
import {
    getPortal,
    cancelAppointment,
    lookupPortalLink,
} from '../../controllers/api/portalController.js';

const router = express.Router();

// POST /api/v1/portal/lookup  — "Resend my link" (MUST be before /:token)
router.post('/lookup', portalLookupLimiter, lookupPortalLink);

// GET /api/v1/portal/:token  — View portal
router.get('/:token', portalGetLimiter, getPortal);

// POST /api/v1/portal/:token/cancel/:appointmentId  — Cancel appointment
router.post('/:token/cancel/:appointmentId', portalCancelLimiter, cancelAppointment);

export default router;
