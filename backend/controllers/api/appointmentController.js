import Appointment from '../../models/Appointment.js';
import Business  from '../../models/Business.js';
import { ERRORS } from '../../utils/errors.js';
import fs from 'fs';

export const AppointmentController = {
    getAll: async (req, res, next) => {
        try {
            const businessId = req.session.activeBusinessId;
            const { date } = req.query; // format YYYY-MM-DD
            const appointments = await Appointment.findAll(businessId, date);
            res.status(200).json({ success: true, data: appointments });
        } catch (error) {
            next(error);
        }
    },

    getById: async (req, res, next) => {
        try {
            const { id } = req.params;
            const businessId = req.session.activeBusinessId;
            const appointment = await Appointment.findById(id);

            if (!appointment || appointment.business_id !== businessId) {
                throw ERRORS.NOT_FOUND('Appointment not found');
            }

            res.status(200).json({ success: true, data: appointment });
        } catch (error) {
            next(error);
        }
    },

    create: async (req, res, next) => {
        try {
            const businessId = req.session.activeBusinessId;
            const userId = req.session.userId;
            
            // Format datetime: ensure it's a valid string for MySQL (YYYY-MM-DD HH:MM:SS)
            // If it's 2023-10-27T10:00 -> 2023-10-27 10:00:00
            let { appointment_datetime } = req.body;
            if (appointment_datetime) {
                appointment_datetime = appointment_datetime.replace('T', ' ');
                if (appointment_datetime.length === 16) { // YYYY-MM-DD HH:MM
                    appointment_datetime += ':00';
                }
            }

            const data = { 
                ...req.body, 
                appointment_datetime,
                business_id: businessId, 
                user_id: userId 
            };

            const appointmentId = await Appointment.create(data);
            
            // Check SMS credits
            const business = await Business.getById(businessId);
            const messagingEnabled = business && business.sms_credits > 0;

            res.status(201).json({
                success: true,
                message: 'Appointment created',
                data: { id: appointmentId, messaging_enabled: messagingEnabled }
            });
        } catch (error) {
            console.error('🔴 AppointmentController.create Error:', error);
            fs.appendFileSync('ctrl_error.log', `ERROR: ${error.message}\nSTACK: ${error.stack}\n`);
            next(error);
        }
    },

    update: async (req, res, next) => {
        try {
            const { id } = req.params;
            const businessId = req.session.activeBusinessId;

            // Verify exists and belongs to business
            const appointment = await Appointment.findById(id);
            if (!appointment || appointment.business_id !== businessId) {
                throw ERRORS.NOT_FOUND('Appointment not found');
            }

            const updated = await Appointment.update(id, req.body);
            res.status(200).json({ success: true, message: 'Appointment updated' });
        } catch (error) {
            next(error);
        }
    },

    delete: async (req, res, next) => {
        try {
            const { id } = req.params;
            const businessId = req.session.activeBusinessId;
            const userId = req.session.userId;
            const userRole = req.session.role;

            const appointment = await Appointment.findById(id);
            if (!appointment || appointment.business_id !== businessId) {
                throw ERRORS.NOT_FOUND('Appointment not found');
            }

            // Permission check
            const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole);
            const isCreator = appointment.user_id === userId;
            const isAssigned = appointment.assigned_to_user_id === userId;

            if (!isOwnerOrAdmin && !isCreator && !isAssigned) {
                throw ERRORS.FORBIDDEN('You do not have permission to delete this appointment');
            }

            await Appointment.delete(id);
            res.status(200).json({ success: true, message: 'Appointment deleted' });
        } catch (error) {
            next(error);
        }
    }
};
