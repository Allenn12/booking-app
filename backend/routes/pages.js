import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import publicMiddleware from '../middleware/publicMiddleware.js';
import { verifyEmailMiddleware } from '../middleware/verifyEmailSessionMiddleware.js';

const router = express.Router();

// PUBLIC RUTE
router.get('/login', publicMiddleware, (req, res) => res.render('login'));
router.get('/register', publicMiddleware, (req, res) => res.render('register'));
router.get('/', publicMiddleware, (req, res) => res.render('login'));
router.get('/home', publicMiddleware, (req, res) => res.render('home'));

//verify-email (verifyEmailMiddleware middleware)
router.get('/verify-email', verifyEmailMiddleware, (req, res, next) => {
  const { userEmail } = req.verifyEmailData;
  res.render('verify-email', { userEmail });
});

// PROTECTED RUTE
router.get('/dashboard', authMiddleware, (req, res) => {
  res.render('dashboard', { user: req.user });
});

export default router;
