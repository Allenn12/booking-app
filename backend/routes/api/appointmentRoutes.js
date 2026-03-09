import express from 'express';
import  {AppointmentController}  from '../../controllers/api/appointmentController.js';
import authMiddleware from '../../middleware/authMiddleware.js';
import { ensureBusinessContext } from '../../middleware/businessMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(ensureBusinessContext);

router.get('/', AppointmentController.getAll);
router.get('/:id', AppointmentController.getById);
router.post('/', AppointmentController.create);
router.put('/:id', AppointmentController.update);
router.delete('/:id', AppointmentController.delete);

export default router;
