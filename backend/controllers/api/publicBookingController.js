import pool from '../../config/database.js';
import { ERRORS } from '../../utils/errors.js';
import Business from '../../models/Business.js';
import Appointment from '../../models/Appointment.js';
import Client from '../../models/Client.js';
import BusinessHour from '../../models/BusinessHour.js';
import { normalizePhone } from '../../utils/phoneFormatter.js';
import NotificationService from '../../services/NotificationService.js';
import AvailabilityService from '../../services/AvailabilityService.js';

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
                    data: { 
                        booking_disabled: true, 
                        business_name: business.name,
                        logo_url: business.logo_url
                    }
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
                        description: business.description,
                        logo_url: business.logo_url,
                        cover_image_url: business.cover_image_url,
                        instagram_url: business.instagram_url,
                        facebook_url: business.facebook_url,
                        currency: business.currency,
                        timezone: business.timezone,
                        booking_window_days: business.booking_window_days
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
     * GET /api/v1/public/book/:slug/availability-range?start=YYYY-MM-DD&end=YYYY-MM-DD&service_id=N
     * Returns boolean availability for a date range per day.
     */
    getAvailabilityRange: async (req, res, next) => {
        try {
            const { slug } = req.params;
            const { start, end, service_id } = req.query;

            if (!start || !end) throw ERRORS.VALIDATION('Start and end dates are required (?start=YYYY-MM-DD&end=YYYY-MM-DD)');
            if (!service_id) throw ERRORS.VALIDATION('Service ID is required (?service_id=N)');

            const business = await Business.findBySlug(slug);
            if (!business) throw ERRORS.NOT_FOUND('Business not found');
            if (!business.allow_public_booking) {
                return res.status(200).json({ success: true, data: { booking_disabled: true, dates: {} } });
            }

            const startObj = new Date(start + 'T00:00:00');
            const endObj = new Date(end + 'T00:00:00');
            if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
                throw ERRORS.VALIDATION('Invalid date format. Use YYYY-MM-DD');
            }

            const maxDate = new Date();
            maxDate.setHours(0, 0, 0, 0);
            maxDate.setDate(maxDate.getDate() + business.booking_window_days);
            if (startObj > maxDate) {
                throw ERRORS.BAD_REQUEST(`Requested start date is outside the allowed booking window`);
            }

            const data = await AvailabilityService.getAvailabilityRange(business.id, service_id, start, end);

            res.status(200).json({
                success: true,
                data: {
                    booking_disabled: false,
                    dates: data
                }
            });
        } catch (error) {
            console.error('🔴 PublicBooking.getAvailabilityRange Error:', error);
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

            const maxDate = new Date(today);
            maxDate.setDate(maxDate.getDate() + business.booking_window_days);
            if (dateObj > maxDate) {
                 throw ERRORS.BAD_REQUEST(`Requested date is outside the allowed booking window`);
            }

            // Get service duration
            const [serviceRows] = await pool.query(
                'SELECT duration_minutes FROM services WHERE id = ? AND business_id = ? AND is_active = 1',
                [service_id, business.id]
            );
            if (serviceRows.length === 0) throw ERRORS.NOT_FOUND('Service not found or inactive');
            const durationMinutes = serviceRows[0].duration_minutes;

            // Get team members
            const [team] = await pool.query(
                `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name 
                 FROM user u 
                 JOIN user_business ub ON u.id = ub.user_id 
                 WHERE ub.business_id = ?`,
                [business.id]
            );

            const slots = [];
            // Build availability slots for each team member
            for (const worker of team) {
                const workerSlots = await AvailabilityService.getAvailableSlots(
                    business.id, worker.id, service_id, date
                );

                for (const slot of workerSlots) {
                    slots.push({
                        worker_id: worker.id,
                        worker_name: worker.name,
                        time: slot.time,
                    });
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
                client_phone,
                client_email = null,
                sms_marketing_consent = false
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

            // === TRANSACTION ===
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Validate slot (checks hours, schedules, constraints, and double-bookings with FOR UPDATE lock)
            const validationResult = await AvailabilityService.validateSlot(
                business.id, worker_id, service_id, appointment_datetime, connection
            );
            
            if (!validationResult.valid) {
                throw ERRORS.BAD_REQUEST(validationResult.reason);
            }

            // Resolve client
            let finalClientId;
            const existingClient = await Client.findByPhone(business.id, safePhone);
            if (existingClient) {
                finalClientId = existingClient.id;
                if (sms_marketing_consent) {
                    await pool.query( // Using pool because client resolution inside transaction is not fully locked yet in original code (connection is used for creation but we can still use it)
                        `UPDATE clients 
                         SET sms_marketing_consent = 1, consent_given_at = NOW(), consent_source = 'booking_form' 
                         WHERE id = ? AND business_id = ?`,
                        [finalClientId, business.id]
                    );
                }
            } else {
                finalClientId = await Client.create(business.id, {
                    name: client_name,
                    phone: safePhone,
                    email: client_email
                }, connection);
                if (sms_marketing_consent) {
                    await connection.query(
                        `UPDATE clients 
                         SET sms_marketing_consent = 1, consent_given_at = NOW(), consent_source = 'booking_form' 
                         WHERE id = ? AND business_id = ?`,
                        [finalClientId, business.id]
                    );
                }
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

            // Increment client stats (non-blocking, outside transaction)
            try {
                await Client.incrementStats(finalClientId, business.id);
            } catch (err) {
                console.error('⚠️ Client.incrementStats failed (public):', err.message);
            }

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
    },

    /**
     * GET /api/v1/public/book/:slug/confirmation/:bookingId
     * Get booking details for the success page
     */
    getBookingConfirmation: async (req, res, next) => {
        try {
            const { slug, bookingId } = req.params;
            
            const business = await Business.findBySlug(slug);
            if (!business) throw ERRORS.NOT_FOUND('Business not found');

            const [rows] = await pool.query(
                `SELECT a.id, a.appointment_datetime, a.status,
                        s.name as service_name, s.duration_minutes, s.price,
                        c.name as client_name, c.phone as client_phone,
                        u.first_name as worker_firstName, u.last_name as worker_lastName
                 FROM appointment a
                 JOIN services s ON a.service_id = s.id
                 JOIN clients c ON a.client_id = c.id
                 JOIN user u ON a.assigned_to_user_id = u.id
                 WHERE a.id = ? AND a.business_id = ?`,
                [bookingId, business.id]
            );

            if (rows.length === 0) throw ERRORS.NOT_FOUND('Booking not found');

            const booking = rows[0];
            
            res.status(200).json({
                success: true,
                data: {
                    business: {
                        name: business.name,
                        phone: business.phone,
                        address: business.address,
                        city: business.city,
                        currency: business.currency,
                        timezone: business.timezone
                    },
                    booking: {
                        id: booking.id,
                        datetime: booking.appointment_datetime,
                        status: booking.status,
                        service: {
                            name: booking.service_name,
                            duration: booking.duration_minutes,
                            price: booking.price
                        },
                        worker: {
                            name: `${booking.worker_firstName} ${booking.worker_lastName}`
                        },
                        client: {
                            name: booking.client_name,
                            phone: booking.client_phone
                        }
                    }
                }
            });

        } catch (error) {
            console.error('🔴 PublicBooking.getBookingConfirmation Error:', error);
            next(error);
        }
    }
};

export default PublicBookingController;
