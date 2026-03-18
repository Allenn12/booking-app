import pool from '../../config/database.js';
import { ERRORS } from '../../utils/errors.js';
import Appointment from '../../models/Appointment.js';
import Client from '../../models/Client.js';
import BusinessHour from '../../models/BusinessHour.js';
import UserBusiness from '../../models/UserBusiness.js';
import { normalizePhone } from '../../utils/phoneFormatter.js';
import fs from 'fs';
import NotificationService from '../../services/NotificationService.js';

export const AppointmentController = {
    getAll: async (req, res, next) => {
        try {
            const businessId = req.session.activeBusinessId;
            const { date, date_from, date_to } = req.query;

            const appointments = await Appointment.findAll(businessId, date, date_from, date_to);
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
                client_id,        // Mode 1: existing client
                walkIn,           // Mode 2: walk-in sentinel
                clientName,       // Mode 3: find-or-create
                clientPhone,      // Mode 3: find-or-create
                service_id, 
                assigned_to_user_id, 
                notes 
            } = req.body;

            // === COMMON VALIDATION ===
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

            // Validate Business Hours
            const aptDate = new Date(appointment_datetime);
            if (isNaN(aptDate.getTime())) throw ERRORS.VALIDATION('Invalid appointment datetime format');

            let isoDay = aptDate.getDay();
            if (isoDay === 0) isoDay = 7;

            const hours = await BusinessHour.getByBusinessId(businessId);
            const dayConfig = hours.find(h => h.day_of_week === isoDay);

            if (!dayConfig || dayConfig.is_closed === 1) {
                throw ERRORS.BAD_REQUEST('Business is completely closed on this day.');
            }

            const aptStartFormatted = aptDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            const aptEndDate = new Date(aptDate.getTime() + durationMinutes * 60000);
            const aptEndFormatted = aptEndDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            const openTimeStr = dayConfig.open_time.substring(0, 5); 
            const closeTimeStr = dayConfig.close_time.substring(0, 5);

            if (aptStartFormatted < openTimeStr || aptEndFormatted > closeTimeStr) {
                throw ERRORS.BAD_REQUEST(`Appointment strictly outside of working hours (${openTimeStr} to ${closeTimeStr}).`);
            }

            // Double Booking Check
            const hasOverlap = await Appointment.checkOverlap(assigned_to_user_id, appointment_datetime, durationMinutes);
            if (hasOverlap) {
                throw ERRORS.BAD_REQUEST('Worker is already booked at this time.');
            }

            // === START TRANSACTION ===
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // === CLIENT RESOLUTION (3 modes) ===
            let finalClientId;
            let resolvedName = null;
            let resolvedPhone = null;

            if (client_id) {
                // MODE 1: Existing client by ID
                const existingClient = await Client.getByBusinessAndId(businessId, client_id);
                if (!existingClient) {
                    throw ERRORS.VALIDATION('Client not found in this business');
                }
                finalClientId = existingClient.id;
                resolvedName = existingClient.name;
                resolvedPhone = existingClient.phone;

            } else if (walkIn === true) {
                // MODE 2: Walk-in sentinel
                const walkInClient = await Client.getOrCreateWalkIn(businessId);
                finalClientId = walkInClient.id;
                resolvedName = 'Walk-in';
                resolvedPhone = null;

            } else if (clientName && clientPhone) {
                // MODE 3: Find-or-create by name + phone (backward compatible)
                const safePhone = normalizePhone(clientPhone);
                const existingClient = await Client.findByPhone(businessId, safePhone);
                if (existingClient) {
                    finalClientId = existingClient.id;
                } else {
                    finalClientId = await Client.create(businessId, {
                        name: clientName,
                        phone: safePhone
                    }, connection);
                }
                resolvedName = clientName;
                resolvedPhone = safePhone;

            } else {
                throw ERRORS.VALIDATION('Client info required: provide client_id, set walkIn:true, or provide clientName + clientPhone');
            }

            // === CREATE APPOINTMENT ===
            const newAptId = await Appointment.create({
                business_id: businessId,
                client_id: finalClientId,
                service_id,
                assigned_to_user_id,
                name: resolvedName,
                phone: resolvedPhone,
                appointment_datetime,
                user_id: req.session.userId,
                status: 'scheduled',
                notes
            }, connection);

            await connection.commit();

            // Increment client stats (non-blocking, outside transaction)
            try {
                await Client.incrementStats(finalClientId);
            } catch (err) {
                console.error('⚠️ Client.incrementStats failed:', err.message);
            }

            // Trigger Notifications (Non-blocking)
            try {
                const fullBusiness = await Business.getById(businessId);
                const [serv] = await pool.query('SELECT name FROM services WHERE id=?', [service_id]);
                const [emp] = await pool.query('SELECT first_name FROM user WHERE id=?', [assigned_to_user_id]);
                
                await NotificationService.handleAppointmentCreated(
                    { id: newAptId, start_time: appointment_datetime },
                    { id: finalClientId, first_name: resolvedName, phone: resolvedPhone },
                    fullBusiness,
                    { name: serv[0]?.name },
                    { first_name: emp[0]?.first_name }
                );
            } catch (err) {
                console.error('Notification Service Error on Create:', err);
            }

            res.status(201).json({
                success: true,
                message: 'Appointment created successfully',
                data: { id: newAptId, client_id: finalClientId }
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
            const oldAppt = await Appointment.findById(id);
            const success = await Appointment.update(id, payload);
            if (!success) throw ERRORS.NOT_FOUND('Appointment not found');

            // Trigger Cancellation Notification if status changed to cancelled
            if (payload.status === 'cancelled' && oldAppt && oldAppt.status !== 'cancelled') {
                try {
                    const fullBusiness = await Business.getById(oldAppt.business_id);
                    const [serv] = await pool.query('SELECT name FROM services WHERE id=?', [oldAppt.service_id]);
                    const [emp] = await pool.query('SELECT first_name FROM user WHERE id=?', [oldAppt.assigned_to_user_id]);
                    const [cli] = await pool.query('SELECT first_name, phone FROM clients WHERE id=?', [oldAppt.client_id]);
                    
                    if (cli.length > 0) {
                        await NotificationService.handleAppointmentCancelled(
                            oldAppt,
                            { id: oldAppt.client_id, first_name: cli[0].first_name, phone: cli[0].phone },
                            fullBusiness,
                            { name: serv[0]?.name },
                            { first_name: emp[0]?.first_name }
                        );
                    }
                } catch (err) {
                    console.error('Notification Service Error on Cancel:', err);
                }
            }

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
