import express from 'express';
import apiAuthRoutes from './api/auth.js';
import pagesRoutes from './pages.js';
import apiBusinessRoutes from './api/businessRoutes.js';
import countryRoutes from './api/countries.js';
const router = express.Router();

router.use('/api/v1/auth', apiAuthRoutes);
router.use('/api/v1/business', apiBusinessRoutes)
router.use('/api/v1/countries', countryRoutes);
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running' });
});
router.use('/', pagesRoutes);

export default router;