import express from 'express';
import * as authController from '../../controllers/api/authController.js';
import authMiddleware from '../../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', authController.register);
router.get('/verify-email', authController.verifyEmailToken);
router.get('/check-verification', authController.checkVerification);
router.post('/resend-verification', authController.resendVerificationLink);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/check-session', authMiddleware, authController.checkSession);

export default router;