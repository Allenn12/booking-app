import pool from '../../config/database.js';
import { ERRORS } from '../../utils/errors.js';
import UserBusiness from '../../models/UserBusiness.js';

// ─── Date Boundaries Helper ───────────────────────────────────────────────
function buildDateRange(period) {
  const now = new Date();
  let start, end;

  switch (period) {
    case 'today': {
      const d = now.toISOString().slice(0, 10);
      start = `${d} 00:00:00`;
      end   = `${d} 23:59:59`;
      break;
    }
    case 'week': {
      const day  = now.getDay();            // 0=Sun
      const iso  = day === 0 ? 6 : day - 1; // Mon offset
      const mon  = new Date(now); mon.setDate(now.getDate() - iso);
      const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
      start = `${mon.toISOString().slice(0, 10)} 00:00:00`;
      end   = `${sun.toISOString().slice(0, 10)} 23:59:59`;
      break;
    }
    case 'month': {
      const y = now.getFullYear(), m = now.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      start = `${y}-${String(m).padStart(2,'0')}-01 00:00:00`;
      end   = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')} 23:59:59`;
      break;
    }
    case 'last_month': {
      const d2 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y2 = d2.getFullYear(), m2 = d2.getMonth() + 1;
      const lastDay2 = new Date(y2, m2, 0).getDate();
      start = `${y2}-${String(m2).padStart(2,'0')}-01 00:00:00`;
      end   = `${y2}-${String(m2).padStart(2,'0')}-${String(lastDay2).padStart(2,'0')} 23:59:59`;
      break;
    }
    case '30d':
    default: {
      const d30 = new Date(now); d30.setDate(now.getDate() - 29);
      start = `${d30.toISOString().slice(0, 10)} 00:00:00`;
      end   = `${now.toISOString().slice(0, 10)} 23:59:59`;
      break;
    }
  }
  return { start, end };
}

function prevRange(period) {
  // Returns same-length period immediately before the given one
  const now = new Date();
  switch (period) {
    case 'today': {
      const d = new Date(now); d.setDate(now.getDate() - 1);
      const ds = d.toISOString().slice(0, 10);
      return { start: `${ds} 00:00:00`, end: `${ds} 23:59:59` };
    }
    case 'week': {
      const day = now.getDay(); const iso = day === 0 ? 6 : day - 1;
      const mon = new Date(now); mon.setDate(now.getDate() - iso - 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: `${mon.toISOString().slice(0,10)} 00:00:00`, end: `${sun.toISOString().slice(0,10)} 23:59:59` };
    }
    case 'month': {
      const d2 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y2 = d2.getFullYear(), m2 = d2.getMonth() + 1;
      const lastDay2 = new Date(y2, m2, 0).getDate();
      return { start: `${y2}-${String(m2).padStart(2,'0')}-01 00:00:00`, end: `${y2}-${String(m2).padStart(2,'0')}-${String(lastDay2).padStart(2,'0')} 23:59:59` };
    }
    case '30d':
    default: {
      const d60 = new Date(now); d60.setDate(now.getDate() - 59);
      const d31 = new Date(now); d31.setDate(now.getDate() - 30);
      return { start: `${d60.toISOString().slice(0,10)} 00:00:00`, end: `${d31.toISOString().slice(0,10)} 23:59:59` };
    }
  }
}

// ─── Shared security check ────────────────────────────────────────────────
async function assertAccess(req) {
  const businessId = req.params.id;
  const userId = req.session.userId;
  const ok = await UserBusiness.checkAccess(userId, businessId);
  if (!ok) throw ERRORS.FORBIDDEN('Nemate pristup ovom biznisu');
  return businessId;
}

const AnalyticsController = {

  // ─── GET /business/:id/analytics/overview ─────────────────────────────
  getOverview: async (req, res, next) => {
    try {
      const businessId = await assertAccess(req);
      const period = req.query.period || '30d';
      const { start, end } = buildDateRange(period);
      const prev = prevRange(period);

      const [
        revenueRows,
        prevRevenueRows,
        statusRows,
        trendRows,
        heatmapRows,
        topServicesRows,
        newClientsRows,
        prevNewClientsRows
      ] = await Promise.all([
        // Current revenue
        pool.query(`
          SELECT COALESCE(SUM(s.price), 0) AS revenue, COUNT(*) AS bookings
          FROM appointment a
          JOIN services s ON a.service_id = s.id
          WHERE a.business_id = ? AND a.status = 'completed'
            AND a.deleted_at IS NULL
            AND a.appointment_datetime BETWEEN ? AND ?
        `, [businessId, start, end]),

        // Previous revenue (for % change)
        pool.query(`
          SELECT COALESCE(SUM(s.price), 0) AS revenue, COUNT(*) AS bookings
          FROM appointment a
          JOIN services s ON a.service_id = s.id
          WHERE a.business_id = ? AND a.status = 'completed'
            AND a.deleted_at IS NULL
            AND a.appointment_datetime BETWEEN ? AND ?
        `, [businessId, prev.start, prev.end]),

        // Status breakdown (completion rate)
        pool.query(`
          SELECT status, COUNT(*) AS count
          FROM appointment
          WHERE business_id = ? AND deleted_at IS NULL
            AND appointment_datetime BETWEEN ? AND ?
          GROUP BY status
        `, [businessId, start, end]),

        // Daily revenue trend (last 30 or within period)
        pool.query(`
          SELECT DATE(a.appointment_datetime) AS day,
                 COALESCE(SUM(s.price), 0) AS revenue,
                 COUNT(*) AS bookings
          FROM appointment a
          JOIN services s ON a.service_id = s.id
          WHERE a.business_id = ? AND a.status = 'completed'
            AND a.deleted_at IS NULL
            AND a.appointment_datetime BETWEEN ? AND ?
          GROUP BY DATE(a.appointment_datetime)
          ORDER BY day ASC
        `, [businessId, start, end]),

        // Heatmap: hour × day_of_week booking counts
        pool.query(`
          SELECT HOUR(appointment_datetime) AS hour,
                 DAYOFWEEK(appointment_datetime) AS dow,
                 COUNT(*) AS count
          FROM appointment
          WHERE business_id = ? AND deleted_at IS NULL
            AND appointment_datetime BETWEEN ? AND ?
          GROUP BY HOUR(appointment_datetime), DAYOFWEEK(appointment_datetime)
        `, [businessId, start, end]),

        // Top 5 services by revenue
        pool.query(`
          SELECT s.name, COALESCE(SUM(s.price), 0) AS revenue, COUNT(*) AS bookings
          FROM appointment a
          JOIN services s ON a.service_id = s.id
          WHERE a.business_id = ? AND a.status = 'completed'
            AND a.deleted_at IS NULL
            AND a.appointment_datetime BETWEEN ? AND ?
          GROUP BY s.id, s.name
          ORDER BY revenue DESC
          LIMIT 5
        `, [businessId, start, end]),

        // New clients in current period
        pool.query(`
          SELECT COUNT(*) AS count
          FROM clients
          WHERE business_id = ? 
            AND created_at BETWEEN ? AND ?
        `, [businessId, start, end]),

        // New clients in previous period
        pool.query(`
          SELECT COUNT(*) AS count
          FROM clients
          WHERE business_id = ? 
            AND created_at BETWEEN ? AND ?
        `, [businessId, prev.start, prev.end]),
      ]);

      const revenue     = parseFloat(revenueRows[0][0].revenue) || 0;
      const prevRevenue = parseFloat(prevRevenueRows[0][0].revenue) || 0;
      const bookings    = parseInt(revenueRows[0][0].bookings) || 0;
      const pctChange   = prevRevenue > 0
        ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100)
        : null;

      const statuses = statusRows[0];
      const completed  = statuses.find(r => r.status === 'completed')?.count || 0;
      const cancelled  = statuses.find(r => r.status === 'cancelled')?.count || 0;
      const no_show    = statuses.find(r => r.status === 'no_show')?.count || 0;
      const total      = completed + cancelled + no_show;

      const newClients = parseInt(newClientsRows[0][0].count) || 0;
      const prevNewClients = parseInt(prevNewClientsRows[0][0].count) || 0;
      const newClientsPctChange = prevNewClients > 0
        ? Math.round(((newClients - prevNewClients) / prevNewClients) * 100)
        : null;

      // Heatmap: build 7×24 matrix [dow][hour]
      // MySQL DAYOFWEEK: 1=Sun, 2=Mon ... 7=Sat
      const heatmapMatrix = {};
      for (const row of heatmapRows[0]) {
        const key = `${row.dow}-${row.hour}`;
        heatmapMatrix[key] = parseInt(row.count);
      }

      res.json({
        success: true,
        data: {
          hasEnoughData: total >= 5,
          period: { start, end },
          revenue, prevRevenue, pctChange,
          bookings,
          newClients, prevNewClients, newClientsPctChange,
          completionStats: { total, completed, cancelled, no_show },
          trend: trendRows[0].map(r => ({ day: r.day, revenue: parseFloat(r.revenue), bookings: parseInt(r.bookings) })),
          heatmap: heatmapRows[0].map(r => ({ hour: r.hour, dow: r.dow, count: parseInt(r.count) })),
          topServices: topServicesRows[0].map(r => ({ name: r.name, revenue: parseFloat(r.revenue), bookings: parseInt(r.bookings) })),
        }
      });
    } catch (err) { next(err); }
  },

  // ─── GET /business/:id/analytics/revenue ──────────────────────────────
  getRevenue: async (req, res, next) => {
    try {
      const businessId = await assertAccess(req);
      const period  = req.query.period || '30d';
      const groupBy = req.query.groupBy || 'day'; // day | week | month
      const serviceId = req.query.service_id || null;
      const staffId   = req.query.staff_id   || null;
      const { start, end } = buildDateRange(period);
      const prev = prevRange(period);

      let groupExpr, groupLabel;
      switch (groupBy) {
        case 'week':  groupExpr = "DATE(DATE_SUB(a.appointment_datetime, INTERVAL (DAYOFWEEK(a.appointment_datetime)-2+7)%7 DAY))"; groupLabel = 'week'; break;
        case 'month': groupExpr = "DATE_FORMAT(a.appointment_datetime, '%Y-%m-01')"; groupLabel = 'month'; break;
        default:      groupExpr = "DATE(a.appointment_datetime)"; groupLabel = 'day';
      }

      const whereExtras = [];
      const params = [businessId, start, end];
      const prevParams = [businessId, prev.start, prev.end];
      if (serviceId) { whereExtras.push('a.service_id = ?'); params.push(serviceId); prevParams.push(serviceId); }
      if (staffId)   { whereExtras.push('a.assigned_to_user_id = ?'); params.push(staffId); prevParams.push(staffId); }
      const extraSQL = whereExtras.length ? 'AND ' + whereExtras.join(' AND ') : '';

      const [
        trendRows,
        prevTotalRows,
        byServiceRows,
        byDowRows,
        servicesListRows,
        staffListRows,
      ] = await Promise.all([
        pool.query(`
          SELECT ${groupExpr} AS period,
                 COALESCE(SUM(s.price), 0) AS revenue,
                 COUNT(*) AS bookings,
                 COALESCE(AVG(s.price), 0) AS avg_ticket
          FROM appointment a
          JOIN services s ON a.service_id = s.id
          WHERE a.business_id = ? AND a.status = 'completed'
            AND a.deleted_at IS NULL
            AND a.appointment_datetime BETWEEN ? AND ?
            ${extraSQL}
          GROUP BY ${groupExpr}
          ORDER BY ${groupExpr} ASC
        `, params),

        pool.query(`
          SELECT COALESCE(SUM(s.price), 0) AS revenue, COUNT(*) AS bookings
          FROM appointment a
          JOIN services s ON a.service_id = s.id
          WHERE a.business_id = ? AND a.status = 'completed'
            AND a.deleted_at IS NULL
            AND a.appointment_datetime BETWEEN ? AND ?
          GROUP BY a.business_id
        `, prevParams.slice(0, 3)),

        pool.query(`
          SELECT s.id, s.name,
                 COALESCE(SUM(s.price), 0) AS revenue,
                 COUNT(*) AS bookings,
                 COALESCE(AVG(s.price), 0) AS avg_price
          FROM appointment a
          JOIN services s ON a.service_id = s.id
          WHERE a.business_id = ? AND a.status = 'completed'
            AND a.deleted_at IS NULL
            AND a.appointment_datetime BETWEEN ? AND ?
          GROUP BY s.id, s.name
          ORDER BY revenue DESC
        `, [businessId, start, end]),

        pool.query(`
          SELECT DAYOFWEEK(a.appointment_datetime) AS dow,
                 COALESCE(SUM(s.price), 0) AS revenue,
                 COUNT(*) AS bookings
          FROM appointment a
          JOIN services s ON a.service_id = s.id
          WHERE a.business_id = ? AND a.status = 'completed'
            AND a.deleted_at IS NULL
            AND a.appointment_datetime BETWEEN ? AND ?
          GROUP BY DAYOFWEEK(a.appointment_datetime)
          ORDER BY dow ASC
        `, [businessId, start, end]),

        pool.query('SELECT id, name FROM services WHERE business_id = ? AND is_active = 1 ORDER BY name', [businessId]),
        pool.query(`SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name FROM user u JOIN user_business ub ON u.id = ub.user_id WHERE ub.business_id = ? ORDER BY u.first_name`, [businessId]),
      ]);

      const curRevenue  = trendRows[0].reduce((s, r) => s + parseFloat(r.revenue), 0);
      const prevRevenue = parseFloat(prevTotalRows[0][0]?.revenue) || 0;
      const curBookings = trendRows[0].reduce((s, r) => s + parseInt(r.bookings), 0);
      const pctChange   = prevRevenue > 0 ? Math.round(((curRevenue - prevRevenue) / prevRevenue) * 100) : null;
      const avgTicket   = curBookings > 0 ? Math.round(curRevenue / curBookings) : 0;

      const DOW_NAMES = ['', 'Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

      res.json({
        success: true,
        data: {
          hasEnoughData: curBookings >= 5,
          period: { start, end },
          summary: { revenue: curRevenue, prevRevenue, pctChange, bookings: curBookings, avgTicket },
          trend: trendRows[0].map(r => ({
            period: r.period,
            revenue: parseFloat(r.revenue),
            bookings: parseInt(r.bookings),
            avgTicket: Math.round(parseFloat(r.avg_ticket))
          })),
          byService: byServiceRows[0].map(r => ({
            id: r.id, name: r.name,
            revenue: parseFloat(r.revenue),
            bookings: parseInt(r.bookings),
            avgPrice: Math.round(parseFloat(r.avg_price))
          })),
          byDow: byDowRows[0].map(r => ({
            dow: r.dow,
            label: DOW_NAMES[r.dow],
            revenue: parseFloat(r.revenue),
            bookings: parseInt(r.bookings)
          })),
          filters: {
            services: servicesListRows[0],
            staff: staffListRows[0],
          }
        }
      });
    } catch (err) { next(err); }
  },

  // ─── GET /business/:id/analytics/clients ──────────────────────────────
  getClients: async (req, res, next) => {
    try {
      const businessId = await assertAccess(req);
      const period = req.query.period || '30d';
      const { start, end } = buildDateRange(period);
      const prev = prevRange(period);

      const [
        retentionRows,
        newVsReturningRows,
        topClientsRows,
        atRiskRows,
        noShowRows,
      ] = await Promise.all([

        // Retention: clients who had completed appt in prev period AND current period
        pool.query(`
          SELECT 
            COUNT(DISTINCT c.client_id) AS retained,
            (SELECT COUNT(DISTINCT client_id) FROM appointment 
             WHERE business_id = ? AND status = 'completed' AND deleted_at IS NULL 
             AND appointment_datetime BETWEEN ? AND ?) AS total_prev
          FROM appointment c
          WHERE c.business_id = ? AND c.status = 'completed' AND c.deleted_at IS NULL
            AND c.appointment_datetime BETWEEN ? AND ?
            AND c.client_id IN (
              SELECT DISTINCT client_id FROM appointment
              WHERE business_id = ? AND status = 'completed' AND deleted_at IS NULL
              AND appointment_datetime BETWEEN ? AND ?
            )
        `, [businessId, prev.start, prev.end, businessId, start, end, businessId, prev.start, prev.end]),

        // New vs Returning per month (last 6 months)
        // Optimized: A client is 'new' in the month of their FIRST appointment.
        // Everyone else appearing in that month is 'returning'.
        pool.query(`
          SELECT 
            visits.month,
            COUNT(DISTINCT CASE WHEN visits.is_first = 1 THEN visits.client_id END) AS new_clients,
            COUNT(DISTINCT CASE WHEN visits.is_first = 0 THEN visits.client_id END) AS returning_clients
          FROM (
            SELECT 
              DATE_FORMAT(a.appointment_datetime, '%Y-%m') AS month,
              a.client_id,
              CASE WHEN a.appointment_datetime = first_appts.first_date THEN 1 ELSE 0 END AS is_first
            FROM appointment a
            JOIN (
              SELECT client_id, MIN(appointment_datetime) AS first_date
              FROM appointment
              WHERE business_id = ? AND status = 'completed' AND deleted_at IS NULL
              GROUP BY client_id
            ) first_appts ON a.client_id = first_appts.client_id
            WHERE a.business_id = ? AND a.status = 'completed' AND a.deleted_at IS NULL
              AND a.appointment_datetime >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 6 MONTH), '%Y-%m-01')
          ) visits
          GROUP BY visits.month
          ORDER BY visits.month ASC
        `, [businessId, businessId]),

        // Top 10 clients by revenue
        pool.query(`
          SELECT c.id, c.name, c.phone,
                 COALESCE(SUM(s.price), 0) AS total_revenue,
                 COUNT(*) AS total_visits,
                 MAX(a.appointment_datetime) AS last_visit,
                 DATEDIFF(NOW(), MAX(a.appointment_datetime)) AS days_since_last
          FROM appointment a
          JOIN services s ON a.service_id = s.id
          JOIN clients c ON a.client_id = c.id
          WHERE a.business_id = ? AND a.status = 'completed'
            AND a.deleted_at IS NULL AND a.client_id IS NOT NULL
          GROUP BY c.id, c.name, c.phone
          ORDER BY total_revenue DESC
          LIMIT 10
        `, [businessId]),

        // At-risk clients: Improved detection logic
        pool.query(`
          SELECT c.id, c.name, c.phone,
                 stats.total_visits,
                 stats.last_visit,
                 DATEDIFF(NOW(), stats.last_visit) AS days_since_last,
                 stats.avg_interval_days
          FROM (
            SELECT client_id,
                   COUNT(*) AS total_visits,
                   MAX(appointment_datetime) AS last_visit,
                   ROUND(DATEDIFF(MAX(appointment_datetime), MIN(appointment_datetime)) / (COUNT(*) - 1)) AS avg_interval_days
            FROM appointment
            WHERE business_id = ? AND status = 'completed' AND deleted_at IS NULL AND client_id IS NOT NULL
            GROUP BY client_id
            HAVING COUNT(*) >= 2
          ) stats
          JOIN clients c ON stats.client_id = c.id
          WHERE c.phone != 'WALKIN'
            AND DATEDIFF(NOW(), stats.last_visit) > (stats.avg_interval_days * 1.5)
            AND DATEDIFF(NOW(), stats.last_visit) < 365
          ORDER BY days_since_last DESC
          LIMIT 20
        `, [businessId]),

        // No-show stats
        pool.query(`
          SELECT
            COUNT(CASE WHEN status = 'no_show' THEN 1 END) AS no_shows,
            COUNT(*) AS total
          FROM appointment
          WHERE business_id = ? AND deleted_at IS NULL
            AND appointment_datetime BETWEEN ? AND ?
        `, [businessId, start, end]),
      ]);

      const retRow    = retentionRows[0][0] || { retained: 0, total_prev: 0 };
      const retained  = parseInt(retRow.retained) || 0;
      const totalPrev = parseInt(retRow.total_prev) || 0;
      const retentionRate = totalPrev > 0 ? Math.round((retained / totalPrev) * 100) : null;

      const nsRow   = noShowRows[0][0] || { no_shows: 0, total: 0 };
      const noShows = parseInt(nsRow.no_shows) || 0;
      const nsTotal = parseInt(nsRow.total) || 0;
      const noShowRate = nsTotal > 0 ? parseFloat(((noShows / nsTotal) * 100).toFixed(1)) : 0;

      res.json({
        success: true,
        data: {
          hasEnoughData: nsTotal >= 5,
          period: { start, end },
          retentionRate,
          noShowRate,
          newVsReturning: newVsReturningRows[0].map(r => ({
            month: r.month,
            newClients: parseInt(r.new_clients),
            returningClients: parseInt(r.returning_clients || 0)
          })),
          topClients: topClientsRows[0].map(r => ({
            id: r.id, name: r.name, phone: r.phone,
            totalRevenue: parseFloat(r.total_revenue),
            totalVisits: parseInt(r.total_visits),
            lastVisit: r.last_visit,
            daysSinceLast: parseInt(r.days_since_last)
          })),
          atRiskClients: atRiskRows[0].map(r => ({
            id: r.id, name: r.name, phone: r.phone,
            totalVisits: parseInt(r.total_visits),
            lastVisit: r.last_visit,
            daysSinceLast: parseInt(r.days_since_last),
            avgIntervalDays: parseInt(r.avg_interval_days)
          })),
        }
      });
    } catch (err) { next(err); }
  },

  // ─── GET /business/:id/analytics/staff ────────────────────────────────
  getStaff: async (req, res, next) => {
    try {
      const businessId = await assertAccess(req);
      const period = req.query.period || '30d';
      const { start, end } = buildDateRange(period);

      const [staffRows, trendRows, businessHoursRows] = await Promise.all([
        // Per-staff performance
        pool.query(`
          SELECT
            u.id,
            CONCAT(u.first_name, ' ', u.last_name) AS name,
            COUNT(*) AS bookings,
            COALESCE(SUM(CASE WHEN a.status = 'completed' THEN s.price ELSE 0 END), 0) AS revenue,
            COALESCE(AVG(CASE WHEN a.status = 'completed' THEN s.price END), 0) AS avg_ticket,
            SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) AS no_shows,
            SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
            COALESCE(SUM(CASE WHEN a.status = 'completed' THEN s.duration_minutes ELSE 0 END), 0) AS booked_minutes
          FROM appointment a
          JOIN services s ON a.service_id = s.id
          JOIN user u ON a.assigned_to_user_id = u.id
          WHERE a.business_id = ? AND a.deleted_at IS NULL
            AND a.appointment_datetime BETWEEN ? AND ?
          GROUP BY u.id, u.first_name, u.last_name
          ORDER BY revenue DESC
        `, [businessId, start, end]),

        // Monthly revenue trend per staff (last 6 months)
        pool.query(`
          SELECT
            CONCAT(u.first_name, ' ', u.last_name) AS staff_name,
            DATE_FORMAT(a.appointment_datetime, '%Y-%m') AS month,
            COALESCE(SUM(s.price), 0) AS revenue
          FROM appointment a
          JOIN services s ON a.service_id = s.id
          JOIN user u ON a.assigned_to_user_id = u.id
          WHERE a.business_id = ? AND a.status = 'completed'
            AND a.deleted_at IS NULL
            AND a.appointment_datetime >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
          GROUP BY u.id, u.first_name, u.last_name, DATE_FORMAT(a.appointment_datetime, '%Y-%m')
          ORDER BY month ASC
        `, [businessId]),

        // Business hours for utilization calc (days per week business is open)
        pool.query('SELECT * FROM business_hours WHERE business_id = ?', [businessId]),
      ]);

      // Compute utilization: estimate available hours from business hours
      const hours = businessHoursRows[0];
      const openDays = hours.filter(h => !h.is_closed).length;
      const avgHoursPerDay = hours
        .filter(h => !h.is_closed && h.open_time && h.close_time)
        .reduce((sum, h) => {
          const [oh, om] = h.open_time.split(':').map(Number);
          const [ch, cm] = h.close_time.split(':').map(Number);
          return sum + ((ch * 60 + cm) - (oh * 60 + om));
        }, 0) / (openDays || 1);

      // Rough days in period
      const msPerDay = 86400000;
      const periodDays = Math.round((new Date(end) - new Date(start)) / msPerDay) + 1;
      const periodWeeks = periodDays / 7;
      const totalAvailableMinutes = avgHoursPerDay * periodWeeks * openDays;

      const staff = staffRows[0].map(r => ({
        id: r.id,
        name: r.name,
        bookings: parseInt(r.bookings),
        revenue: parseFloat(r.revenue),
        avgTicket: Math.round(parseFloat(r.avg_ticket)),
        completed: parseInt(r.completed),
        noShows: parseInt(r.no_shows),
        cancelled: parseInt(r.cancelled),
        bookedMinutes: parseInt(r.booked_minutes),
        utilizationPct: totalAvailableMinutes > 0
          ? Math.min(100, Math.round((parseInt(r.booked_minutes) / totalAvailableMinutes) * 100))
          : 0,
        noShowRate: parseInt(r.bookings) > 0
          ? parseFloat(((parseInt(r.no_shows) / parseInt(r.bookings)) * 100).toFixed(1))
          : 0,
      }));

      // Build trend series per month
      const monthSet = [...new Set(trendRows[0].map(r => r.month))].sort();
      const staffNames = [...new Set(trendRows[0].map(r => r.staff_name))];
      const trendByMonth = monthSet.map(month => {
        const row = { month };
        for (const sName of staffNames) {
          const r = trendRows[0].find(x => x.month === month && x.staff_name === sName);
          row[sName] = r ? parseFloat(r.revenue) : 0;
        }
        return row;
      });

      res.json({
        success: true,
        data: {
          hasEnoughData: staff.length > 0 && staff.reduce((s, x) => s + x.bookings, 0) >= 5,
          period: { start, end },
          staff,
          staffNames,
          trendByMonth,
        }
      });
    } catch (err) { next(err); }
  },
};

export default AnalyticsController;
