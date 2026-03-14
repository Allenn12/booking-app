import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';
import './Calendar.css';

/* ═══════════ HELPERS ═══════════ */

const DAY_NAMES = ['PON', 'UTO', 'SRI', 'ČET', 'PET', 'SUB', 'NED'];
const DAY_NAMES_FULL = ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota', 'Nedjelja'];

/** Get Monday of the week for a given date (EU-style) */
function getMonday(d) {
  const dt = new Date(d);
  const day = dt.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/** Format YYYY-MM-DD */
function fmt(d) {
  const dt = new Date(d);
  return dt.getFullYear() + '-' +
    String(dt.getMonth() + 1).padStart(2, '0') + '-' +
    String(dt.getDate()).padStart(2, '0');
}

/** Check if two dates are the same calendar day */
function isSameDay(a, b) {
  return fmt(a) === fmt(b);
}

/** Minute of day from a Date */
function minuteOfDay(d) {
  const dt = new Date(d);
  return dt.getHours() * 60 + dt.getMinutes();
}

/* ═══════════ COMPONENT ═══════════ */

function Calendar() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [team, setTeam] = useState([]);
  const [businessHours, setBusinessHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [popoverPos, setPopoverPos] = useState(null);
  const gridRef = useRef(null);
  const nowLineInterval = useRef(null);
  const [nowMinute, setNowMinute] = useState(minuteOfDay(new Date()));

  // Hours to display on the grid
  const START_HOUR = 7;
  const END_HOUR = 21;
  const TOTAL_HOURS = END_HOUR - START_HOUR;

  // Generate the 7 days of the week
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const weekEnd = weekDays[6];

  // ─── DATA FETCHING ───
  useEffect(() => {
    if (!user?.activeBusinessId) return;
    fetchData();
  }, [user?.activeBusinessId, weekStart]);

  // Update now-line every minute
  useEffect(() => {
    nowLineInterval.current = setInterval(() => {
      setNowMinute(minuteOfDay(new Date()));
    }, 60000);
    return () => clearInterval(nowLineInterval.current);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const dateFrom = fmt(weekStart);
      const dateTo = fmt(weekEnd);

      const [apptRes, servRes, teamRes, bizRes] = await Promise.all([
        api.getAppointmentsRange(dateFrom, dateTo),
        api.getBusinessServices(user.activeBusinessId),
        api.getBusinessTeam(user.activeBusinessId),
        api.getBusinessById(user.activeBusinessId)
      ]);

      if (apptRes.success) setAppointments(apptRes.data);
      if (servRes.success) setServices(servRes.data.filter(s => s.is_active));
      if (teamRes.success) setTeam(teamRes.data);
      if (bizRes.success && bizRes.data.business_hours) {
        setBusinessHours(bizRes.data.business_hours);
      }
    } catch (err) {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  // ─── NAVIGATION ───
  const goToday = () => setWeekStart(getMonday(new Date()));
  const goPrev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const goNext = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  // ─── LOOKUPS ───
  const getServiceName = (id) => services.find(s => s.id === id)?.name || `Service #${id}`;
  const getServiceDuration = (id) => services.find(s => s.id === id)?.duration_minutes || 30;
  const getWorkerName = (id) => {
    const w = team.find(t => t.user_id === id);
    return w ? `${w.user_first_name} ${w.user_last_name || ''}`.trim() : `Worker #${id}`;
  };

  /** Check if a given ISO day (1=Mon…7=Sun) is closed */
  const isDayClosed = (isoDay) => {
    const config = businessHours.find(h => h.day_of_week === isoDay);
    return !config || config.is_closed === 1;
  };

  /** Get ISO day (1-7) from JS Date */
  const getIsoDay = (d) => {
    const day = d.getDay();
    return day === 0 ? 7 : day;
  };

  // ─── APPOINTMENT CLICK → POPOVER ───
  const handleApptClick = (e, appt) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    // Position popover near the clicked block
    let left = rect.right + 8;
    let top = rect.top;
    // Keep within viewport
    if (left + 330 > window.innerWidth) left = rect.left - 330;
    if (top + 300 > window.innerHeight) top = window.innerHeight - 310;
    if (top < 10) top = 10;
    setPopoverPos({ left, top });
    setSelectedAppt(appt);
  };

  const closePopover = () => {
    setSelectedAppt(null);
    setPopoverPos(null);
  };

  // ─── STATUS CHANGE ───
  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await api.updateAppointment(id, { status: newStatus });
      if (res.success) {
        toast.success('Status updated');
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
        if (selectedAppt?.id === id) {
          setSelectedAppt(prev => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // ─── DELETE ───
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this appointment?')) return;
    try {
      const res = await api.deleteAppointment(id);
      if (res.success) {
        toast.success('Appointment deleted');
        setAppointments(prev => prev.filter(a => a.id !== id));
        closePopover();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const canDelete = (appt) => {
    if (['owner', 'admin'].includes(user?.role)) return true;
    return appt.user_id === user?.id || appt.assigned_to_user_id === user?.id;
  };

  // ─── CLICK GRID → Navigate to Appointments page with that date ───
  const handleCellClick = (dayDate, hour) => {
    // Navigate to the appointments page with the selected date pre-filled
    const dateStr = fmt(dayDate);
    window.location.href = `/appointments?date=${dateStr}&time=${String(hour).padStart(2, '0')}:00`;
  };

  // ─── FORMAT HELPERS ───
  const formatWeekLabel = () => {
    const start = weekDays[0];
    const end = weekDays[6];
    const sMonth = start.toLocaleDateString('hr-HR', { month: 'long' });
    const eMonth = end.toLocaleDateString('hr-HR', { month: 'long' });
    const year = end.getFullYear();

    if (sMonth === eMonth) {
      return `${start.getDate()}. – ${end.getDate()}. ${sMonth} ${year}`;
    }
    return `${start.getDate()}. ${sMonth} – ${end.getDate()}. ${eMonth} ${year}`;
  };

  // Scroll to now on first load
  useEffect(() => {
    if (!loading && gridRef.current) {
      const now = new Date();
      const targetMinute = minuteOfDay(now);
      const scrollTo = ((targetMinute - START_HOUR * 60) / (TOTAL_HOURS * 60)) * (TOTAL_HOURS * 60);
      // Scroll so current time is ~1/4 from top
      gridRef.current.scrollTop = Math.max(0, (scrollTo - 120));
    }
  }, [loading]);

  // ─── RENDER ───
  const today = new Date();

  // Group appointments by date string
  const apptsByDate = useMemo(() => {
    const map = {};
    appointments.forEach(a => {
      const dateKey = fmt(new Date(a.appointment_datetime));
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(a);
    });
    return map;
  }, [appointments]);

  return (
    <div className="cal-page">
      {/* ─── TOOLBAR ─── */}
      <div className="cal-toolbar">
        <div className="cal-toolbar-left">
          <h1>Kalendar</h1>
          <div className="cal-nav-group">
            <button className="cal-nav-btn" onClick={goPrev} title="Previous Week">‹</button>
            <button className="cal-nav-btn" onClick={goNext} title="Next Week">›</button>
          </div>
          <button className="cal-today-btn" onClick={goToday}>Danas</button>
          <span className="cal-date-label">{formatWeekLabel()}</span>
        </div>
      </div>

      {loading ? (
        <div className="cal-loading">
          <div className="cal-loading-spinner" />
          Učitavanje rasporeda...
        </div>
      ) : (
        <div className="cal-grid-wrapper" ref={gridRef}>
          <div className="cal-grid">
            {/* ─── Header Row ─── */}
            <div className="cal-header-gutter" />
            {weekDays.map((day, i) => {
              const iso = getIsoDay(day);
              const closed = isDayClosed(iso);
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={i}
                  className={`cal-header-cell${isToday ? ' is-today' : ''}${closed ? ' is-closed' : ''}`}
                >
                  <span className="cal-header-day">{DAY_NAMES[i]}</span>
                  <span className="cal-header-date">{day.getDate()}</span>
                </div>
              );
            })}

            {/* ─── Time Grid ─── */}
            {Array.from({ length: TOTAL_HOURS }, (_, h) => {
              const hour = START_HOUR + h;
              return (
                <React.Fragment key={`row-${hour}`}>
                  {/* Gutter */}
                  <div className="cal-gutter-cell">
                    <span className="cal-gutter-label">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day, di) => {
                    const iso = getIsoDay(day);
                    const closed = isDayClosed(iso);
                    const dateKey = fmt(day);
                    const isFirstHour = h === 0;
                    const isCurrentDayCol = isSameDay(day, today);

                    // Only render appointments in the first hour cell (they're absolutely positioned in the column)
                    const dayAppts = isFirstHour ? (apptsByDate[dateKey] || []) : [];

                    return (
                      <div
                        key={`${di}-${hour}`}
                        className={`cal-day-col${closed ? ' is-closed' : ''}`}
                        style={{ gridRow: `${h + 2}` }} // +2 because row 1 is header
                      >
                        <div
                          className="cal-hour-row"
                          onClick={() => !closed && handleCellClick(day, hour)}
                          title={closed ? 'Zatvoreno' : `${DAY_NAMES_FULL[di]} ${day.getDate()}. - ${String(hour).padStart(2, '0')}:00`}
                        />

                        {/* Half-hour line */}
                        <div className="cal-half-line" style={{ top: '30px' }} />

                        {/* Appointment blocks (rendered only in the first hour row for each day) */}
                        {isFirstHour && dayAppts.map(appt => {
                          const apptTime = new Date(appt.appointment_datetime);
                          const startMin = minuteOfDay(apptTime);
                          const duration = getServiceDuration(appt.service_id);
                          const topPx = ((startMin - START_HOUR * 60) / 60) * 60; // 60px per hour
                          const heightPx = Math.max((duration / 60) * 60, 20);

                          return (
                            <div
                              key={appt.id}
                              className={`cal-appt status-${appt.status}`}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              onClick={(e) => handleApptClick(e, appt)}
                              title={`${appt.name} — ${getServiceName(appt.service_id)}`}
                            >
                              <div className="cal-appt-title">{appt.name}</div>
                              {heightPx > 30 && (
                                <div className="cal-appt-meta">
                                  {apptTime.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
                                  {' · '}
                                  {getServiceName(appt.service_id)}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Now-line */}
                        {isFirstHour && isCurrentDayCol && (() => {
                          const top = ((nowMinute - START_HOUR * 60) / 60) * 60;
                          if (top >= 0 && top <= TOTAL_HOURS * 60) {
                            return <div className="cal-now-line" style={{ top: `${top}px` }} />;
                          }
                          return null;
                        })()}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Appointment Detail Popover ─── */}
      {selectedAppt && popoverPos && (
        <>
          <div className="cal-popover-overlay" onClick={closePopover} />
          <div className="cal-popover" style={{ left: popoverPos.left, top: popoverPos.top }}>
            <div className="cal-popover-header">
              <h3>{selectedAppt.name}</h3>
              <button className="cal-popover-close" onClick={closePopover}>&times;</button>
            </div>
            <div className="cal-popover-body">
              <div className="cal-popover-row">
                <span className="label">Vrijeme</span>
                <span className="value">
                  {new Date(selectedAppt.appointment_datetime).toLocaleDateString('hr-HR', {
                    weekday: 'long', day: 'numeric', month: 'long'
                  })}
                  {', '}
                  {new Date(selectedAppt.appointment_datetime).toLocaleTimeString('hr-HR', {
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="cal-popover-row">
                <span className="label">Usluga</span>
                <span className="value">{getServiceName(selectedAppt.service_id)}</span>
              </div>
              <div className="cal-popover-row">
                <span className="label">Radnik</span>
                <span className="value">{getWorkerName(selectedAppt.assigned_to_user_id)}</span>
              </div>
              {selectedAppt.phone && (
                <div className="cal-popover-row">
                  <span className="label">Telefon</span>
                  <span className="value">{selectedAppt.phone}</span>
                </div>
              )}
              {selectedAppt.notes && (
                <div className="cal-popover-row">
                  <span className="label">Bilješke</span>
                  <span className="value">{selectedAppt.notes}</span>
                </div>
              )}
              <div className="cal-popover-row">
                <span className="label">Status</span>
                <span className="value">
                  <select
                    value={selectedAppt.status}
                    onChange={e => handleStatusChange(selectedAppt.id, e.target.value)}
                    style={{
                      padding: '4px 8px', borderRadius: '6px',
                      border: '1px solid #dee2e6', fontSize: '13px'
                    }}
                  >
                    <option value="scheduled">Zakazano</option>
                    <option value="completed">Završeno</option>
                    <option value="cancelled">Otkazano</option>
                    <option value="no_show">Nije se pojavio/la</option>
                  </select>
                </span>
              </div>
            </div>
            <div className="cal-popover-footer">
              {canDelete(selectedAppt) && (
                <button
                  className="btn-danger"
                  onClick={() => handleDelete(selectedAppt.id)}
                >
                  Obriši
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Calendar;
