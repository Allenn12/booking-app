import pool from '../../config/database.js';
import { ERRORS } from '../../utils/errors.js';
import Business from '../../models/Business.js';
import Appointment from '../../models/Appointment.js';
import Client from '../../models/Client.js';
import BusinessHour from '../../models/BusinessHour.js';
import { normalizePhone } from '../../utils/phoneFormatter.js';
import NotificationService from '../../services/NotificationService.js';

/**
 * Public Booking Controller — NO auth required.
 * All endpoints are scoped by business slug.
 */
export const PublicBookingController = {

    /**
     * GET /api/v1/public/book/:slug
     * Returns business info, services, team members, and hours.
     */
    getBusinessInfo: async (req, res, next) => {
        try {
            const { slug } = req.params;
            const business = await Business.findBySlug(slug);

            if (!business) throw ERRORS.NOT_FOUND('Business not found');
            if (!business.allow_public_booking) {
                return res.status(200).json({
                    success: true,
                    data: { booking_disabled: true, business_name: business.name }
                });
            }

            // Fetch services
            const [services] = await pool.query(
                'SELECT id, name, duration_minutes, price FROM services WHERE business_id = ? AND is_active = 1 ORDER BY name',
                [business.id]
            );

            // Fetch team members (workers)
            const [team] = await pool.query(
                `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name 
                 FROM user u 
                 JOIN user_business ub ON u.id = ub.user_id 
                 WHERE ub.business_id = ?
                 ORDER BY u.first_name, u.last_name`,
                [business.id]
            );

            // Fetch business hours
            const hours = await BusinessHour.getByBusinessId(business.id);

            res.status(200).json({
                success: true,
                data: {
                    booking_disabled: false,
                    business: {
                        id: business.id,
                        name: business.name,
                        slug: business.slug,
                        phone: business.phone,
                        address: business.address,
                        city: business.city,
                    },
                    services,
                    team,
                    hours,
                }
            });

        } catch (error) {
            console.error('🔴 PublicBooking.getBusinessInfo Error:', error);
            next(error);
        }
    },

    /**
     * GET /api/v1/public/book/:slug/availability?date=YYYY-MM-DD&service_id=N
     * Returns available time slots grouped by worker.
     */
    getAvailability: async (req, res, next) => {
        try {
            const { slug } = req.params;
            const { date, service_id } = req.query;

            if (!date) throw ERRORS.VALIDATION('Date is required (?date=YYYY-MM-DD)');
            if (!service_id) throw ERRORS.VALIDATION('Service ID is required (?service_id=N)');

            const business = await Business.findBySlug(slug);
            if (!business) throw ERRORS.NOT_FOUND('Business not found');
            if (!business.allow_public_booking) {
                return res.status(200).json({ success: true, data: { booking_disabled: true, slots: [] } });
            }

            // Validate date format
            const dateObj = new Date(date + 'T00:00:00');
            if (isNaN(dateObj.getTime())) throw ERRORS.VALIDATION('Invalid date format. Use YYYY-MM-DD');

            // Don't allow booking in the past
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dateObj < today) {
                return res.status(200).json({ success: true, data: { slots: [] } });
            }

            // Get service duration
            const [serviceRows] = await pool.query(
                'SELECT duration_minutes FROM services WHERE id = ? AND business_id = ? AND is_active = 1',
                [service_id, business.id]
            );
            if (serviceRows.length === 0) throw ERRORS.NOT_FOUND('Service not found or inactive');
            const durationMinutes = serviceRows[0].duration_minutes;

            // Get business hours for this day of week (ISO: Mon=1, Sun=7)
            let isoDay = dateObj.getDay();
            if (isoDay === 0) isoDay = 7;

            const hours = await BusinessHour.getByBusinessId(business.id);
            const dayConfig = hours.find(h => h.day_of_week === isoDay);

            if (!dayConfig || dayConfig.is_closed === 1) {
                return res.status(200).json({ success: true, data: { slots: [] } });
            }

            const openTime = dayConfig.open_time.substring(0, 5); // "HH:mm"
            const closeTime = dayConfig.close_time.substring(0, 5);

            // Get team members
            const [team] = await pool.query(
                `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name 
                 FROM user u 
                 JOIN user_business ub ON u.id = ub.user_id 
                 WHERE ub.business_id = ?`,
                [business.id]
            );

            // Get existing appointments for this date
            const [existingApts] = await pool.query(
                `SELECT assigned_to_user_id, appointment_datetime, 
                        s.duration_minutes 
                 FROM appointment a
                 JOIN services s ON a.service_id = s.id
                 WHERE a.business_id = ? 
                   AND DATE(a.appointment_datetime) = ?
                   AND a.status != 'cancelled'`,
                [business.id, date]
            );

            // Build availability slots for each team member
            const slots = [];
            const SLOT_INTERVAL = 15; // minutes

            for (const worker of team) {
                // Get this worker's booked intervals
                const workerApts = existingApts.filter(a => a.assigned_to_user_id === worker.id);
                const bookedIntervals = workerApts.map(apt => {
                    const start = new Date(apt.appointment_datetime);
                    const end = new Date(start.getTime() + apt.duration_minutes * 60000);
                    return { start, end };
                });

                // Generate candidate slots from open to close
                const [openH, openM] = openTime.split(':').map(Number);
                const [closeH, closeM] = closeTime.split(':').map(Number);

                const dayStart = new Date(date + 'T00:00:00');
                dayStart.setHours(openH, openM, 0, 0);

                const dayEnd = new Date(date + 'T00:00:00');
                dayEnd.setHours(closeH, closeM, 0, 0);

                let cursor = new Date(dayStart);

                while (cursor.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
                    const slotStart = new Date(cursor);
                    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000);

                    // Check for overlap with any existing appointment
                    const hasOverlap = bookedIntervals.some(interval => 
                        slotStart < interval.end && slotEnd > interval.start
                    );

                    // If today, skip slots that are in the past (with 30 min buffer)
                    const now = new Date();
                    const isToday = dateObj.toDateString() === now.toDateString();
                    const tooLate = isToday && slotStart.getTime() < now.getTime() + 30 * 60000;

                    if (!hasOverlap && !tooLate) {
                        const timeStr = slotStart.toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        });
                        slots.push({
                            worker_id: worker.id,
                            worker_name: worker.name,
                            time: timeStr,
                        });
                    }

                    // Advance by interval
                    cursor = new Date(cursor.getTime() + SLOT_INTERVAL * 60000);
                }
            }

            // Sort by time, then worker name
            slots.sort((a, b) => a.time.localeCompare(b.time) || a.worker_name.localeCompare(b.worker_name));

            res.status(200).json({ success: true, data: { slots } });

        } catch (error) {
            console.error('🔴 PublicBooking.getAvailability Error:', error);
            next(error);
        }
    },

    /**
     * POST /api/v1/public/book/:slug
     * Create an appointment as a guest.
     * Body: { service_id, worker_id, appointment_datetime, client_name, client_phone }
     */
    createBooking: async (req, res, next) => {
        let connection = null;
        try {
            const { slug } = req.params;
            const {
                service_id,
                worker_id,
                appointment_datetime,
                client_name,
                client_phone
            } = req.body;

            const business = await Business.findBySlug(slug);
            if (!business) throw ERRORS.NOT_FOUND('Business not found');
            if (!business.allow_public_booking) {
                throw ERRORS.BAD_REQUEST('Public booking is not enabled for this business');
            }

            // Validate required fields
            if (!client_name) throw ERRORS.VALIDATION('Name is required');
            if (!client_phone) throw ERRORS.VALIDATION('Phone number is required');
            if (!service_id) throw ERRORS.VALIDATION('Service is required');
            if (!worker_id) throw ERRORS.VALIDATION('Worker is required');
            if (!appointment_datetime) throw ERRORS.VALIDATION('Appointment time is required');

            const safePhone = normalizePhone(client_phone);

            // Verify service
            const [serviceRows] = await pool.query(
                'SELECT duration_minutes FROM services WHERE id = ? AND business_id = ? AND is_active = 1',
                [service_id, business.id]
            );
            if (serviceRows.length === 0) throw ERRORS.NOT_FOUND('Service not found');
            const durationMinutes = serviceRows[0].duration_minutes;

            // Verify worker belongs to this business
            const [workerRows] = await pool.query(
                'SELECT user_id FROM user_business WHERE user_id = ? AND business_id = ?',
                [worker_id, business.id]
            );
            if (workerRows.length === 0) throw ERRORS.NOT_FOUND('Worker not found');

            // Validate business hours
            const aptDate = new Date(appointment_datetime);
            if (isNaN(aptDate.getTime())) throw ERRORS.VALIDATION('Invalid datetime format');

            let isoDay = aptDate.getDay();
            if (isoDay === 0) isoDay = 7;

            const hours = await BusinessHour.getByBusinessId(business.id);
            const dayConfig = hours.find(h => h.day_of_week === isoDay);

            if (!dayConfig || dayConfig.is_closed === 1) {
                throw ERRORS.BAD_REQUEST('Business is closed on this day');
            }

            const aptStartFormatted = aptDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            const aptEndDate = new Date(aptDate.getTime() + durationMinutes * 60000);
            const aptEndFormatted = aptEndDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            const openTimeStr = dayConfig.open_time.substring(0, 5);
            const closeTimeStr = dayConfig.close_time.substring(0, 5);

            if (aptStartFormatted < openTimeStr || aptEndFormatted > closeTimeStr) {
                throw ERRORS.BAD_REQUEST('Appointment is outside of working hours');
            }

            // Double-booking check
            const hasOverlap = await Appointment.checkOverlap(worker_id, appointment_datetime, durationMinutes);
            if (hasOverlap) {
                throw ERRORS.BAD_REQUEST('This time slot is no longer available');
            }

            // === TRANSACTION ===
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Resolve client
            let finalClientId;
            const existingClient = await Client.findByPhone(business.id, safePhone);
            if (existingClient) {
                finalClientId = existingClient.id;
            } else {
                finalClientId = await Client.create(business.id, {
                    name: client_name,
                    phone: safePhone
                }, connection);
            }

            // Create appointment
            const newAptId = await Appointment.create({
                business_id: business.id,
                client_id: finalClientId,
                service_id,
                assigned_to_user_id: worker_id,
                name: client_name,
                phone: safePhone,
                appointment_datetime,
                user_id: business.owner_user_id, // attribute to business owner
                status: 'scheduled',
                notes: 'Booked via public booking page'
            }, connection);

            await connection.commit();

            // Trigger Notifications (Non-blocking)
            try {
                const [serv] = await pool.query('SELECT name FROM services WHERE id=?', [service_id]);
                const [emp] = await pool.query('SELECT first_name FROM user WHERE id=?', [worker_id]);
                
                await NotificationService.handleAppointmentCreated(
                    { id: newAptId, start_time: appointment_datetime },
                    { id: finalClientId, first_name: client_name, phone: safePhone },
                    business,
                    { name: serv[0]?.name },
                    { first_name: emp[0]?.first_name }
                );
            } catch (err) {
                console.error('Notification Service Error on Public Booking:', err);
            }

            res.status(201).json({
                success: true,
                message: 'Appointment booked successfully!',
                data: { id: newAptId }
            });

        } catch (error) {
            if (connection) await connection.rollback();
            console.error('🔴 PublicBooking.createBooking Error:', error);
            next(error);
        } finally {
            if (connection) connection.release();
        }
    }
};

export default PublicBookingController;
