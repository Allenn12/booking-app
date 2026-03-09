import pool from '../../config/database.js';
import { ERRORS } from '../../utils/errors.js';
import Appointment from '../../models/Appointment.js';
import Client from '../../models/Client.js';
import BusinessHour from '../../models/BusinessHour.js';
import UserBusiness from '../../models/UserBusiness.js';
import { normalizePhone } from '../../utils/phoneFormatter.js';
import fs from 'fs';

export const AppointmentController = {
    getAll: async (req, res, next) => {
        try {
            const businessId = req.session.activeBusinessId;
            const date = req.query.date;

            const appointments = await Appointment.findAll(businessId, date);
            res.status(200).json({ success: true, data: appointments });
        } catch(error) { 
            next(error); 
        }
    },

    getById: async (req, res, next) => {
        try {
            const appointment = await Appointment.findById(req.params.id);
            if (!appointment) throw ERRORS.NOT_FOUND('Appointment not found');
            res.status(200).json({ success: true, data: appointment });
        } catch (error) {
            next(error);
        }
    },

    create: async (req, res, next) => {
        let connection = null;
        try {
            const businessId = req.session.activeBusinessId; // From session
            const { 
                appointment_datetime, 
                clientName, 
                clientPhone, 
                service_id, 
                assigned_to_user_id, 
                notes 
            } = req.body;

            // 1. Sanitize Phone immediately per design requirement
            const safePhone = normalizePhone(clientPhone);

            if (!clientName) throw ERRORS.VALIDATION('Client name is required');
            if (!appointment_datetime) throw ERRORS.VALIDATION('Appointment datetime is required');
            if (!service_id) throw ERRORS.VALIDATION('Service ID is required');
            if (!assigned_to_user_id) throw ERRORS.VALIDATION('Assigned worker ID is required');

            // Ensure the service exists and fetch duration
            const [serviceRows] = await pool.query(
                'SELECT duration_minutes FROM services WHERE id = ? AND business_id = ? AND is_active = 1', 
                [service_id, businessId]
            );
            if (serviceRows.length === 0) throw ERRORS.NOT_FOUND('Service not found or inactive');
            const durationMinutes = serviceRows[0].duration_minutes;

            // 2. Validate Business Hours
            const aptDate = new Date(appointment_datetime);
            if (isNaN(aptDate.getTime())) throw ERRORS.VALIDATION('Invalid appointment datetime format');

            // Map JS getDay() (0=Sun, 1=Mon) to ISO 1-7 (1=Mon, 7=Sun) representing EU calendar format
            let isoDay = aptDate.getDay();
            if (isoDay === 0) isoDay = 7;

            const hours = await BusinessHour.getByBusinessId(businessId);
            const dayConfig = hours.find(h => h.day_of_week === isoDay);

            // Check if business explicitly toggled the CLOSED state for this day
            if (!dayConfig || dayConfig.is_closed === 1) {
                throw ERRORS.BAD_REQUEST('Business is completely closed on this day.');
            }

            // Check time bounds using padded HH:mm strings
            const aptStartFormatted = aptDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            
            // Calculate end time
            const aptEndDate = new Date(aptDate.getTime() + durationMinutes * 60000);
            const aptEndFormatted = aptEndDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

            // Database usually returns time as 'HH:mm:ss', slice it to 'HH:mm' wrapper comparisons
            const openTimeStr = dayConfig.open_time.substring(0, 5); 
            const closeTimeStr = dayConfig.close_time.substring(0, 5);

            if (aptStartFormatted < openTimeStr || aptEndFormatted > closeTimeStr) {
                throw ERRORS.BAD_REQUEST(`Appointment strictly outside of working hours (${openTimeStr} to ${closeTimeStr}).`);
            }

            // 3. Double Booking Check via SQL
            const hasOverlap = await Appointment.checkOverlap(assigned_to_user_id, appointment_datetime, durationMinutes);
            if (hasOverlap) {
                throw ERRORS.BAD_REQUEST('Worker is already booked at this time.');
            }

            // === START TRANSACTION ===
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // 4. Resolve Client logic (Atomic)
            let finalClientId;
            const existingClient = await Client.findByPhone(businessId, safePhone);
            if (existingClient) {
                finalClientId = existingClient.id;
            } else {
                finalClientId = await Client.create(businessId, {
                    name: clientName,
                    phone: safePhone
                }, connection);
            }

            // 5. Create the Appointment
            const newAptId = await Appointment.create({
                business_id: businessId,
                client_id: finalClientId,
                service_id,
                assigned_to_user_id,
                name: clientName, // Denormalized payload mapping
                phone: safePhone, // Denormalized payload mapping
                appointment_datetime,
                user_id: req.session.userId, // Whos account created it
                status: 'scheduled',
                notes
            }, connection);

            // Successfully made it past all checks and inserts
            await connection.commit();

            res.status(201).json({
                success: true,
                message: 'Appointment created successfully',
                data: { id: newAptId, messaging_enabled: false }
            });

        } catch (error) {
            // ROLLBACK EVERYTHING
            if (connection) await connection.rollback();
            console.error('🔴 AppointmentController.create Error:', error);
            next(error);
        } finally {
            if (connection) connection.release();
        }
    },

    update: async (req, res, next) => {
        try {
            const { id } = req.params;
            const payload = req.body;
            // Simplistic update for now (primarily used for status)
            const success = await Appointment.update(id, payload);
            if (!success) throw ERRORS.NOT_FOUND('Appointment not found');
            res.status(200).json({ success: true, message: 'Appointment updated' });
        } catch(error) {
            next(error);
        }
    },

    delete: async (req, res, next) => {
        try {
            const { id } = req.params;
            const success = await Appointment.delete(id);
            if (!success) throw ERRORS.NOT_FOUND('Appointment not found');
            res.status(200).json({ success: true, message: 'Appointment deleted' });
        } catch(error) {
            next(error);
        }
    }
};

export default AppointmentController;
