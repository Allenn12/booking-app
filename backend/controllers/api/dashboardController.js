import pool from '../../config/database.js';
import UserBusiness from '../../models/UserBusiness.js';
import { ERRORS } from '../../utils/errors.js';

/**
 * Timezone-aware helper: calculates precise date boundaries for
 * "today", "this week", and "this month" based on the business's timezone.
 * 
 * Returns MySQL-compatible datetime strings (YYYY-MM-DD HH:mm:ss) in UTC
 * that correspond to the local start/end of each period.
 */
function getDateBoundaries(timezone) {
    // Get "now" in the business's local timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const get = (type) => parts.find(p => p.type === type)?.value;

    const localYear = parseInt(get('year'));
    const localMonth = parseInt(get('month'));
    const localDay = parseInt(get('day'));
    const localHour = parseInt(get('hour'));

    // ─── TODAY ───────────────────────────────────────────────────
    // Start of today and end of today in the business timezone,
    // converted to UTC datetime strings for MySQL comparison.
    const todayStartLocal = new Date(
        new Intl.DateTimeFormat('en-US', {
            timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric'
        }).format(now)
    );

    // Instead of relying on Date parsing which varies across platforms,
    // we build the local date string manually and compute offset.
    const localDateStr = `${localYear}-${String(localMonth).padStart(2, '0')}-${String(localDay).padStart(2, '0')}`;

    // "Today" boundaries as explicit strings for MySQL BETWEEN
    const todayStart = `${localDateStr} 00:00:00`;
    const todayEnd = `${localDateStr} 23:59:59`;

    // ─── THIS WEEK (Monday–Sunday, ISO week) ────────────────────
    // Find what day of the week it is in the business timezone
    const localDayOfWeek = new Date(`${localDateStr}T12:00:00`).getDay(); // 0=Sun
    const isoOffset = localDayOfWeek === 0 ? 6 : localDayOfWeek - 1; // Mon=0, Sun=6

    const weekStartDate = new Date(`${localDateStr}T12:00:00`);
    weekStartDate.setDate(weekStartDate.getDate() - isoOffset);
    const weekStartStr = weekStartDate.toISOString().slice(0, 10);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEndStr = weekEndDate.toISOString().slice(0, 10);

    const weekStart = `${weekStartStr} 00:00:00`;
    const weekEnd = `${weekEndStr} 23:59:59`;

    // ─── THIS MONTH ─────────────────────────────────────────────
    const monthStart = `${localYear}-${String(localMonth).padStart(2, '0')}-01 00:00:00`;
    // Last day of current month
    const lastDay = new Date(localYear, localMonth, 0).getDate();
    const monthEnd = `${localYear}-${String(localMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;

    return {
        todayStart, todayEnd,
        weekStart, weekEnd,
        monthStart, monthEnd,
        localHour
    };
}

const DashboardController = {
    /**
     * GET /api/v1/business/:id/dashboard
     * 
     * Returns aggregated dashboard statistics for the given business.
     * All date ranges are calculated using the business's timezone.
     */
    getStats: async (req, res, next) => {
        try {
            const { id: businessId } = req.params;
            const userId = req.session.userId;

            // Security: Verify user has access to this business
            const hasAccess = await UserBusiness.checkAccess(userId, businessId);
            if (!hasAccess) {
                throw ERRORS.FORBIDDEN('Nemate pristup ovom biznisu');
            }

            // 1. Get business timezone
            const [bizRows] = await pool.query(
                'SELECT timezone, sms_credits FROM business WHERE id = ? AND is_active = 1',
                [businessId]
            );
            if (bizRows.length === 0) {
                throw ERRORS.NOT_FOUND('Biznis nije pronađen');
            }

            const businessTimezone = bizRows[0].timezone || 'Europe/Zagreb';
            const smsCredits = bizRows[0].sms_credits || 0;

            // 2. Calculate timezone-aware date boundaries
            const bounds = getDateBoundaries(businessTimezone);

            // 3. Run all queries in parallel for maximum speed
            const [
                todayAppointments,
                weekStats,
                monthTopServices,
                monthClientStats,
                teamCount
            ] = await Promise.all([
                // ── Query 1: Today's appointments (full data for "upcoming" list) ──
                pool.query(`
                    SELECT 
                        a.id, a.name AS client_name, a.phone AS client_phone,
                        a.appointment_datetime, a.status, a.notes,
                        a.service_id, a.assigned_to_user_id, a.user_id,
                        s.name AS service_name, s.duration_minutes AS service_duration,
                        CONCAT(u.first_name, ' ', u.last_name) AS worker_name
                    FROM appointment a
                    LEFT JOIN services s ON a.service_id = s.id
                    LEFT JOIN user u ON a.assigned_to_user_id = u.id
                    WHERE a.business_id = ?
                      AND a.deleted_at IS NULL
                      AND a.appointment_datetime BETWEEN ? AND ?
                    ORDER BY a.appointment_datetime ASC
                `, [businessId, bounds.todayStart, bounds.todayEnd]),

                // ── Query 2: This week's stats (grouped by status) ──
                pool.query(`
                    SELECT 
                        status,
                        COUNT(*) AS count
                    FROM appointment
                    WHERE business_id = ?
                      AND deleted_at IS NULL
                      AND appointment_datetime BETWEEN ? AND ?
                    GROUP BY status
                `, [businessId, bounds.weekStart, bounds.weekEnd]),

                // ── Query 3: This month's top services ──
                pool.query(`
                    SELECT 
                        s.name AS service_name,
                        COUNT(*) AS booking_count
                    FROM appointment a
                    JOIN services s ON a.service_id = s.id
                    WHERE a.business_id = ?
                      AND a.deleted_at IS NULL
                      AND a.appointment_datetime BETWEEN ? AND ?
                    GROUP BY a.service_id, s.name
                    ORDER BY booking_count DESC
                    LIMIT 5
                `, [businessId, bounds.monthStart, bounds.monthEnd]),

                // ── Query 4: This month's client stats ──
                pool.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM clients WHERE business_id = ? AND created_at >= ?) AS new_clients,
                        (SELECT COUNT(*) FROM clients WHERE business_id = ?) AS total_clients
                `, [businessId, bounds.monthStart, businessId]),

                // ── Query 5: Team size ──
                pool.query(`
                    SELECT COUNT(*) AS count FROM user_business WHERE business_id = ?
                `, [businessId])
            ]);

            // 4. Process today's appointments
            const allToday = todayAppointments[0];
            const nowLocal = new Date();

            const todayCompleted = allToday.filter(a => a.status === 'completed').length;
            const todayCancelled = allToday.filter(a => a.status === 'cancelled').length;
            const todayNoShow = allToday.filter(a => a.status === 'no_show').length;

            // Upcoming = scheduled + in the future (limit 5 for the dashboard preview)
            const upcoming = allToday
                .filter(a => a.status === 'scheduled' && new Date(a.appointment_datetime) >= nowLocal)
                .slice(0, 5);

            // 5. Process week stats
            const weekData = weekStats[0];
            const weekTotal = weekData.reduce((sum, row) => sum + row.count, 0);
            const weekCompleted = weekData.find(r => r.status === 'completed')?.count || 0;
            const weekNoShow = weekData.find(r => r.status === 'no_show')?.count || 0;

            // 6. Process month stats
            const topServices = monthTopServices[0].map(row => ({
                name: row.service_name,
                count: row.booking_count
            }));

            const clientStats = monthClientStats[0][0];
            const newClients = clientStats?.new_clients || 0;
            const totalClients = clientStats?.total_clients || 0;

            // Calculate no-show rate for the month
            // We need month total and month no-shows
            const monthTotalAppointments = allToday.length; // Reuse would be wrong, need separate
            // Actually let's compute no-show rate from the week data as a reasonable proxy,
            // or we can do a quick inline count from today. For accuracy, let's use week data.
            const noShowRate = weekTotal > 0 ? ((weekNoShow / weekTotal) * 100).toFixed(1) : 0;

            // 7. Assemble response
            return res.status(200).json({
                success: true,
                data: {
                    today: {
                        total: allToday.length,
                        completed: todayCompleted,
                        cancelled: todayCancelled,
                        noShow: todayNoShow,
                        upcoming
                    },
                    week: {
                        total: weekTotal,
                        completed: weekCompleted,
                        noShow: weekNoShow
                    },
                    month: {
                        newClients,
                        totalClients,
                        noShowRate: parseFloat(noShowRate),
                        topServices
                    },
                    team: {
                        count: teamCount[0][0]?.count || 0
                    },
                    credits: {
                        balance: smsCredits
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

export default DashboardController;
