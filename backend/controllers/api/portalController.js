/**
 * Portal Controller
 * =================
 * Handles the customer-facing magic link portal.
 * Auth model: portal_token in URL is the sole credential.
 * All endpoints are public (no session/JWT required).
 *
 * Endpoints:
 *   GET  /api/v1/portal/:token                         → getPortal
 *   POST /api/v1/portal/:token/cancel/:appointmentId   → cancelAppointment
 *   POST /api/v1/portal/lookup                         → lookupPortalLink
 */

import pool from '../../config/database.js';
import { ERRORS } from '../../utils/errors.js';
import Client from '../../models/Client.js';
import Business from '../../models/Business.js';
import NotificationService from '../../services/NotificationService.js';
import { normalizePhone } from '../../utils/phoneFormatter.js';

// EmailTemplateService is imported lazily (Phase 4) — placeholder until then
let EmailTemplateService = null;
async function getEmailService() {
    if (!EmailTemplateService) {
        try {
            const mod = await import('../../services/EmailTemplateService.js');
            EmailTemplateService = mod.default;
        } catch {
            // Phase 4 not yet implemented — silently skip
            EmailTemplateService = null;
        }
    }
    return EmailTemplateService;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Checks if an appointment can be cancelled (>= 24 hours before start).
 * Calculation in UTC — no timezone issues since DATETIME diff is duration only.
 * @param {Date|string} appointmentDatetime - The appointment's start datetime (UTC)
 * @returns {boolean}
 */
function canCancelAppointment(appointmentDatetime) {
    const now = new Date();
    const aptTime = new Date(appointmentDatetime);
    const hoursUntil = (aptTime - now) / (1000 * 60 * 60);
    return hoursUntil >= 24;
}

/**
 * Safe fetch — returns selected business fields only. Never exposes internal config.
 */
async function getPortalBusiness(businessId) {
    const business = await Business.getById(businessId);
    if (!business) return null;
    return {
        name:     business.name,
        phone:    business.phone    || null,
        email:    business.email    || null,
        address:  business.address  || null,
        city:     business.city     || null,
        currency: business.currency || 'EUR',
        timezone: business.timezone || 'Europe/Zagreb',
        slug:     business.slug     || null,
    };
}

/**
 * Fetch portal-safe appointment list for a client.
 * Returns upcoming + past separately. Does not expose internal IDs of workers.
 */
async function fetchClientAppointments(clientId, businessId) {
    const [upcoming] = await pool.query(`
        SELECT 
            a.id,
            a.appointment_datetime,
            a.status,
            s.name              AS service_name,
            s.duration_minutes,
            s.price             AS service_price,
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS worker_name
        FROM appointment a
        LEFT JOIN services s ON a.service_id = s.id
        LEFT JOIN user u     ON a.assigned_to_user_id = u.id
        WHERE a.client_id   = ?
          AND a.business_id = ?
          AND a.status IN ('scheduled', 'confirmed')
          AND a.appointment_datetime > NOW()
          AND a.deleted_at IS NULL
        ORDER BY a.appointment_datetime ASC
    `, [clientId, businessId]);

    const [past] = await pool.query(`
        SELECT 
            a.id,
            a.appointment_datetime,
            a.status,
            s.name              AS service_name,
            s.duration_minutes,
            s.price             AS service_price,
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS worker_name
        FROM appointment a
        LEFT JOIN services s ON a.service_id = s.id
        LEFT JOIN user u     ON a.assigned_to_user_id = u.id
        WHERE a.client_id   = ?
          AND a.business_id = ?
          AND (
              a.status IN ('completed', 'cancelled', 'no_show')
              OR a.appointment_datetime <= NOW()
          )
          AND a.deleted_at IS NULL
        ORDER BY a.appointment_datetime DESC
        LIMIT 20
    `, [clientId, businessId]);

    // Attach can_cancel to each upcoming appointment
    const upcomingWithCancel = upcoming.map(apt => ({
        ...apt,
        can_cancel: canCancelAppointment(apt.appointment_datetime),
    }));

    return { upcoming: upcomingWithCancel, past };
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/v1/portal/:token
// ──────────────────────────────────────────────────────────────────────────────
export async function getPortal(req, res, next) {
    try {
        const { token } = req.params;

        // 1. Auth: find client by portal token (also checks active = 1)
        const client = await Client.findByPortalToken(token);
        if (!client) {
            throw ERRORS.NOT_FOUND('Portal link is invalid or has been deactivated.');
        }

        // 2. Fetch business (portal-safe subset of fields)
        const business = await getPortalBusiness(client.business_id);
        if (!business) {
            throw ERRORS.NOT_FOUND('Business not found.');
        }

        // 3. Fetch appointments (upcoming + past)
        const { upcoming, past } = await fetchClientAppointments(client.id, client.business_id);

        // 4. Return — only expose safe customer fields, never notes or internal data
        return res.status(200).json({
            success: true,
            data: {
                customer: {
                    name:  client.name,
                    email: client.email  || null,
                    phone: client.phone,
                },
                business,
                appointments: { upcoming, past },
            },
        });
    } catch (error) {
        next(error);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/v1/portal/:token/cancel/:appointmentId
// ──────────────────────────────────────────────────────────────────────────────
export async function cancelAppointment(req, res, next) {
    try {
        const { token, appointmentId } = req.params;

        // Validate appointmentId is a number (prevent injection / path traversal)
        const aptId = parseInt(appointmentId, 10);
        if (!aptId || isNaN(aptId)) {
            throw ERRORS.BAD_REQUEST('Invalid appointment ID.');
        }

        // 1. Auth: find client by portal token
        const client = await Client.findByPortalToken(token);
        if (!client) {
            throw ERRORS.NOT_FOUND('Portal link is invalid or has been deactivated.');
        }

        // 2. SECURITY CRITICAL: ownership verification via JOIN.
        //    Verifies that this appointment belongs to THIS client (via the token).
        //    Never trust appointmentId alone — an attacker could guess/enumerate IDs.
        const [ownerCheck] = await pool.query(`
            SELECT 
                a.id,
                a.appointment_datetime,
                a.status,
                a.business_id,
                a.service_id,
                a.assigned_to_user_id,
                a.client_id,
                s.name AS service_name,
                CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS worker_name
            FROM appointment a
            JOIN clients c ON a.client_id = c.id
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN user u ON a.assigned_to_user_id = u.id
            WHERE a.id = ?
              AND c.portal_token = ?
              AND a.deleted_at IS NULL
        `, [aptId, token]);

        if (ownerCheck.length === 0) {
            // Do NOT reveal whether the appointment exists or belongs to someone else
            throw ERRORS.FORBIDDEN('You do not have permission to cancel this appointment.');
        }

        const appointment = ownerCheck[0];

        // 3. Check appointment is still cancellable (not already cancelled/completed)
        if (['cancelled', 'completed', 'no_show'].includes(appointment.status)) {
            throw ERRORS.BAD_REQUEST('This appointment cannot be cancelled — it is already ' + appointment.status + '.');
        }

        // 4. 24-hour rule check
        if (!canCancelAppointment(appointment.appointment_datetime)) {
            throw ERRORS.BAD_REQUEST(
                'Nije moguće otkazati termin manje od 24 sata ranije. ' +
                'Molimo kontaktirajte salon direktno.'
            );
        }

        // 5. Update status to cancelled
        await pool.query(
            `UPDATE appointment SET status = 'cancelled', updated_at = NOW() WHERE id = ? AND business_id = ?`,
            [aptId, appointment.business_id]
        );

        // 6. Fetch business info for notifications
        const business = await Business.getById(appointment.business_id);

        // 7. Trigger SMS notification to business/client (non-blocking)
        try {
            await NotificationService.handleAppointmentCancelled(
                {
                    id: appointment.id,
                    start_time: appointment.appointment_datetime,
                },
                {
                    id: client.id,
                    first_name: client.name,
                    phone: client.phone,
                },
                business,
                { name: appointment.service_name },
                { first_name: appointment.worker_name }
            );
        } catch (notifErr) {
            console.error('[Portal] SMS notification failed (non-blocking):', notifErr.message);
        }

        // 8. Send cancellation confirmation email (non-blocking, only if client has email)
        if (client.email) {
            try {
                const emailSvc = await getEmailService();
                if (emailSvc) {
                    await emailSvc.sendCancellationConfirmation({
                        to: client.email,
                        business,
                        appointment: {
                            datetime:        appointment.appointment_datetime,
                            service_name:    appointment.service_name,
                            worker_name:     appointment.worker_name,
                        },
                    });
                }
            } catch (emailErr) {
                console.error('[Portal] Cancellation email failed (non-blocking):', emailErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Appointment cancelled successfully.',
            data: { appointmentId: aptId, status: 'cancelled' },
        });
    } catch (error) {
        next(error);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/v1/portal/lookup
// ──────────────────────────────────────────────────────────────────────────────
export async function lookupPortalLink(req, res, next) {
    try {
        const { phone } = req.body;

        // Normalize phone — if invalid, just return success (no enumeration)
        let normalizedPhone;
        try {
            normalizedPhone = normalizePhone(phone);
        } catch {
            // Invalid phone format — return success to prevent enumeration
            return res.status(200).json({
                success: true,
                message: 'If an account exists with that number, your link has been sent.'
            });
        }

        // Find ALL clients with this phone across all businesses
        const [matchingClients] = await pool.query(`
            SELECT c.id, c.name, c.email, c.portal_token, c.business_id
            FROM clients c
            WHERE c.phone = ?
              AND c.phone != 'WALKIN'
              AND c.portal_token IS NOT NULL
              AND c.portal_token_active = 1
              AND c.email IS NOT NULL
        `, [normalizedPhone]);

        // For each match, send a separate email from that business (non-blocking)
        if (matchingClients.length > 0) {
            const emailSvc = await getEmailService();

            for (const matchClient of matchingClients) {
                try {
                    if (!emailSvc) break;

                    const business = await Business.getById(matchClient.business_id);
                    if (!business) continue;

                    const portalUrl = `${process.env.FRONTEND_URL}/portal/${matchClient.portal_token}`;

                    // Correction 6: Send SEPARATE emails, one per business,
                    // each appearing to come FROM that business
                    await emailSvc.sendPortalLinkReminder({
                        to:       matchClient.email,
                        business,
                        portalUrl,
                        clientName: matchClient.name,
                    });
                } catch (emailErr) {
                    console.error(`[Portal] Lookup email failed for client ${matchClient.id} (non-blocking):`, emailErr.message);
                }
            }
        }

        // ALWAYS return 200 — never reveal whether phone was found (prevents enumeration)
        return res.status(200).json({
            success: true,
            message: 'If an account exists with that number, your link has been sent.'
        });
    } catch (error) {
        next(error);
    }
}

export default { getPortal, cancelAppointment, lookupPortalLink };
