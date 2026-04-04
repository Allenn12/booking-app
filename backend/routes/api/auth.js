import express from 'express';
import * as authController from '../../controllers/api/authController.js';
import authMiddleware from '../../middleware/authMiddleware.js';
import { loginLimiter, registerLimiter, resendVerificationLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', registerLimiter, authController.register);
router.get('/verify-email', authController.verifyEmailToken);
router.get('/check-verification', authController.checkVerification);
router.post('/resend-verification', resendVerificationLimiter, authController.resendVerificationLink);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/check-session', authMiddleware, authController.checkSession);

export default router;