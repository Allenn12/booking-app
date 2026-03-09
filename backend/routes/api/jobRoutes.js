import express from 'express';
import JobController from '../../controllers/api/jobController.js';

const router = express.Router();

router.get('/', JobController.getAll);

export default router;
