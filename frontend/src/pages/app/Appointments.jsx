import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';
import ClientSelector from '../../components/ui/ClientSelector';
import './Appointments.css';

/* ─── Status config ─────────────────────────────────── */
const STATUS_CONFIG = {
    scheduled: { label: 'Scheduled',  color: '#b45309', bg: '#fef9c3', border: '#fde68a' },
    confirmed:  { label: 'Confirmed',  color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
    completed:  { label: 'Completed',  color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' },
    cancelled:  { label: 'Cancelled',  color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
    no_show:    { label: 'No-show',    color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
};
const ALL_STATUSES = Object.keys(STATUS_CONFIG);
// Rows for these statuses get visually muted (opacity applied per-cell,
// NOT on the tr, so the status pill can stay at full opacity)
const DIMMED_STATUSES = new Set(['completed', 'cancelled', 'no_show']);

/* ─── Helpers ────────────────────────────────────────── */
function todayISO() {
    const d = new Date();
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
}
function shiftDate(iso, days) {
    const [y, m, d] = iso.split('-').map(Number);
    // Create Date in local time from components (m-1 because months are 0-indexed)
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}
function formatTime(dtStr) {
    return new Date(dtStr).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' });
}
function formatPrice(p) {
    if (p == null) return null;
    return Number(p).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/* ─── StatusPill with fixed-position popover ─────────── */
// position:fixed lets it escape overflow:hidden on the table.
// wrapRef covers the whole pill+popover so outside-click detection
// doesn't fire before the item's onClick can run.
function StatusPill({ apptId, currentStatus, onStatusChange }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos]   = useState({ top: 0, left: 0 });
    const wrapRef = useRef(null);   // covers wrapper div + popover children
    const btnRef  = useRef(null);   // used only for getBoundingClientRect
    const cfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.scheduled;

    const handleOpen = () => {
        if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + 4, left: r.left });
        }
        setOpen(v => !v);
    };

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            // wrapRef covers the trigger button; the popover is position:fixed
            // so we ALSO need to check the popover DOM node separately.
            const popover = document.getElementById(`pill-popover-${apptId}`);
            const insideWrap    = wrapRef.current && wrapRef.current.contains(e.target);
            const insidePopover = popover && popover.contains(e.target);
            if (!insideWrap && !insidePopover) setOpen(false);
        };
        const onScroll = () => setOpen(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('scroll', onScroll, true);
        };
    }, [open, apptId]);

    const handleSelect = (status) => {
        setOpen(false);
        if (status !== currentStatus) onStatusChange(apptId, status);
    };

    return (
        <div className="apt-pill-wrap" ref={wrapRef}>
            <button
                ref={btnRef}
                className="apt-status-pill"
                style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
                onClick={handleOpen}
                title="Click to change status"
            >
                {cfg.label}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 4 }}>
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
            </button>
            {open && (
                <div
                    id={`pill-popover-${apptId}`}
                    className="apt-popover"
                    style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
                >
                    {ALL_STATUSES.map(s => {
                        const c = STATUS_CONFIG[s];
                        return (
                            <button
                                key={s}
                                className={`apt-popover-item${s === currentStatus ? ' active' : ''}`}
                                style={{ color: c.color }}
                                onClick={() => handleSelect(s)}
                            >
                                <span className="apt-popover-dot" style={{ background: c.color }} />
                                {c.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ─── Single-select staff filter ────────────────────── */
// selectedId: null = all, number = one staff member
function StaffFilter({ team, selectedId, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const select = (id) => {
        // clicking the already-selected one → back to All
        onChange(id === selectedId ? null : id);
        setOpen(false);
    };

    const selected = selectedId != null ? team.find(w => w.user_id === selectedId) : null;
    const label = selected ? `${selected.user_first_name} ${selected.user_last_name}` : 'All staff';

    return (
        <div className="apt-filter-wrap" ref={ref}>
            <button className="apt-filter-btn" onClick={() => setOpen(v => !v)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
                {label}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }}>
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
            </button>
            {open && (
                <div className="apt-popover" style={{ minWidth: 180 }}>
                    <button
                        className={`apt-popover-item${selectedId == null ? ' active' : ''}`}
                        onClick={() => { onChange(null); setOpen(false); }}
                    >
                        <span className="apt-popover-dot" style={{ background: '#6366f1' }} />
                        All staff
                    </button>
                    <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
                    {team.map(w => (
                        <button
                            key={w.user_id}
                            className={`apt-popover-item${selectedId === w.user_id ? ' active' : ''}`}
                            onClick={() => select(w.user_id)}
                        >
                            <span
                                className="apt-popover-dot"
                                style={{ background: selectedId === w.user_id ? '#6366f1' : '#d1d5db' }}
                            />
                            {w.user_first_name} {w.user_last_name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── Single-select status filter pills ─────────────── */
// activeStatus: null = all, string = one status
function StatusFilter({ activeStatus, onChange }) {
    const selectStatus = (s) => {
        // clicking the already-active one → back to All
        onChange(s === activeStatus ? null : s);
    };

    return (
        <div className="apt-status-filter">
            <button
                className={`apt-sf-pill${activeStatus == null ? ' apt-sf-all' : ''}`}
                onClick={() => onChange(null)}
            >
                All
            </button>
            {ALL_STATUSES.map(s => {
                const cfg = STATUS_CONFIG[s];
                const active = activeStatus === s;
                return (
                    <button
                        key={s}
                        className="apt-sf-pill"
                        style={active ? { color: cfg.color, background: cfg.bg, borderColor: cfg.border, fontWeight: 600 } : {}}
                        onClick={() => selectStatus(s)}
                    >
                        {cfg.label}
                    </button>
                );
            })}
        </div>
    );
}

/* ─── Main Component ─────────────────────────────────── */
function Appointments() {
    const { user } = useAuth();
    const location = useLocation();

    const [appointments, setAppointments] = useState([]);
    const [services, setServices]         = useState([]);
    const [team, setTeam]                 = useState([]);
    const [loading, setLoading]           = useState(true);

    // Initialize date from URL query param if present (e.g. ?date=2026-03-22)
    const [date, setDate] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('date') || todayISO();
    });

    // Highlight a specific appointment row (from ?highlight=<id>)
    const [highlightId, setHighlightId] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('highlight');
        return id ? Number(id) : null;
    });

    // Row refs map — used for scroll-to + highlight animation
    const rowRefs = useRef({});

    // Pre-selected client from navigation state (from "Zakaži termin" on client profile)
    const [pendingPreselect, setPendingPreselect] = useState(
        location.state?.preselectedClient || null
    );

    const [showModal, setShowModal]       = useState(false);
    const [editingAppointment, setEditingAppointment] = useState(null);

    // Filters — single-select: null = show all
    const [selectedStaff, setSelectedStaff]   = useState(null);   // null | user_id
    const [activeStatus, setActiveStatus]     = useState(null);   // null | status string

    // Edit form state
    const [formData, setFormData] = useState({
        appointment_date: '',
        appointment_time: '',
        service_id: '',
        assigned_to_user_id: '',
        notes: ''
    });
    const [clientSelection, setClientSelection]   = useState({ mode: 'none' });
    const [clientError, setClientError]           = useState('');

    /* ── Fetch ─────────────────────────────────────────── */
    useEffect(() => {
        if (user?.activeBusinessId) {
            fetchInitialData();
            fetchAppointments();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.activeBusinessId, date]);

    /* ── Scroll to + pulse-highlight the target row after appointments load ── */
    useEffect(() => {
        if (loading || !highlightId) return;
        const el = rowRefs.current[highlightId];
        if (!el) return;

        // Small delay so the browser has painted the row
        const scrollTimer = setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('apt-row--highlight');
        }, 120);

        // Remove the animation class after 2 s so the row returns to normal
        const clearTimer = setTimeout(() => {
            el.classList.remove('apt-row--highlight');
            setHighlightId(null); // prevent re-trigger on re-renders
        }, 2200);

        return () => {
            clearTimeout(scrollTimer);
            clearTimeout(clearTimer);
        };
    }, [loading, highlightId]);

    /* ── Auto-open modal with pre-selected client once data is ready ── */
    useEffect(() => {
        if (pendingPreselect && services.length > 0 && team.length > 0) {
            setEditingAppointment(null);
            setClientSelection({
                mode:     'existing',
                clientId: pendingPreselect.id,
                name:     pendingPreselect.name,
                phone:    pendingPreselect.phone,
            });
            setClientError('');
            setFormData({
                appointment_date:    date,
                appointment_time:    '10:00',
                service_id:          services[0]?.id || '',
                assigned_to_user_id: user?.id || team[0]?.user_id || '',
                notes:               ''
            });
            setShowModal(true);
            setPendingPreselect(null);
        }
    }, [pendingPreselect, services, team, date, user]);

    const fetchInitialData = async () => {
        try {
            const [servicesRes, teamRes] = await Promise.all([
                api.getBusinessServices(user.activeBusinessId),
                api.getBusinessTeam(user.activeBusinessId)
            ]);
            if (servicesRes.success) setServices(servicesRes.data.filter(s => s.is_active));
            if (teamRes.success)     setTeam(teamRes.data);
        } catch (err) {
            console.error('Fetch errors:', err);
            toast.error('Failed to load configuration data');
        }
    };

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const res = await api.getAppointments(date);
            if (res.success) setAppointments(res.data);
        } catch (err) {
            console.error('Fetch error:', err);
            toast.error('Failed to load appointments');
        } finally {
            setLoading(false);
        }
    };

    /* ── Lookup helpers ────────────────────────────────── */
    const getService   = useCallback((id) => services.find(s => s.id === id), [services]);
    const getWorker    = useCallback((id) => team.find(w => w.user_id === id), [team]);

    /* ── Status change ─────────────────────────────────── */
    const handleStatusChange = async (id, newStatus) => {
        try {
            const res = await api.updateAppointment(id, { status: newStatus });
            if (res.success) {
                setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
                toast.success('Status updated');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to update status');
        }
    };

    /* ── Delete ────────────────────────────────────────── */
    const handleDelete = async (id) => {
        if (!window.confirm('Delete this appointment?')) return;
        try {
            const res = await api.deleteAppointment(id);
            if (res.success) {
                setAppointments(prev => prev.filter(a => a.id !== id));
                toast.success('Appointment deleted');
            }
        } catch (err) {
            toast.error(err.message || 'Failed to delete');
        }
    };

    /* ── Open Create Modal (optionally with pre-selected client) ── */
    const openCreate = (preselectedClient = null) => {
        if (services.length === 0 || team.length === 0) {
            toast.error('Define at least one Service and one Team Member before booking.');
            return;
        }
        setEditingAppointment(null);
        setClientSelection(
            preselectedClient
                ? { mode: 'existing', clientId: preselectedClient.id, name: preselectedClient.name, phone: preselectedClient.phone }
                : { mode: 'none' }
        );
        setClientError('');
        setFormData({
            appointment_date: date,
            appointment_time: '10:00',
            service_id: services[0]?.id || '',
            assigned_to_user_id: user?.id || team[0]?.user_id || '',
            notes: ''
        });
        setShowModal(true);
    };

    /* ── Open Edit Modal ───────────────────────────────── */
    const openEdit = (appt) => {
        const dt = new Date(appt.appointment_datetime);
        setEditingAppointment(appt);
        setClientSelection({ mode: 'none' }); // client locked on edit
        setClientError('');
        setFormData({
            appointment_date: dt.toISOString().split('T')[0],
            appointment_time: dt.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            service_id: appt.service_id || '',
            assigned_to_user_id: appt.assigned_to_user_id || '',
            notes: appt.notes || ''
        });
        setShowModal(true);
    };

    /* ── Form change ───────────────────────────────────── */
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'notes') {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
        }
    };

    /* ── Submit (create or edit) ───────────────────────── */
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!editingAppointment && clientSelection.mode === 'none') {
            setClientError('Odaberite klijenta, kreirajte novog ili odaberite Walk-in');
            return;
        }
        setClientError('');

        try {
            if (editingAppointment) {
                /* ── EDIT mode ── */
                const updatePayload = {
                    appointment_datetime: `${formData.appointment_date}T${formData.appointment_time}`,
                    service_id:           Number(formData.service_id),
                    assigned_to_user_id:  Number(formData.assigned_to_user_id),
                    notes:                formData.notes
                };
                const res = await api.updateAppointment(editingAppointment.id, updatePayload);
                if (res.success) toast.success('Appointment updated');
            } else {
                /* ── CREATE mode ── */
                const payload = {
                    appointment_datetime: `${formData.appointment_date}T${formData.appointment_time}`,
                    service_id:           Number(formData.service_id),
                    assigned_to_user_id:  Number(formData.assigned_to_user_id),
                    notes:                formData.notes
                };
                if (clientSelection.mode === 'existing') {
                    payload.client_id = clientSelection.clientId;
                } else if (clientSelection.mode === 'walk_in') {
                    payload.walkIn = true;
                } else if (clientSelection.mode === 'new') {
                    payload.clientName  = clientSelection.name;
                    payload.clientPhone = clientSelection.phone;
                }
                const res = await api.createAppointment(payload);
                if (res.success) toast.success('Termin uspješno kreiran');
            }

            setShowModal(false);
            setEditingAppointment(null);
            setClientSelection({ mode: 'none' });
            fetchAppointments();
        } catch (err) {
            toast.error(err.message || 'Greška pri snimanju termina.');
        }
    };

    const canDelete = (appt) =>
        ['owner', 'admin'].includes(user?.role) || appt.user_id === user?.id || appt.assigned_to_user_id === user?.id;

    /* ── Filtered appointments ─────────────────────── */
    const filtered = appointments.filter(a => {
        if (selectedStaff != null && a.assigned_to_user_id !== selectedStaff) return false;
        if (activeStatus  != null && a.status !== activeStatus)               return false;
        return true;
    });

    /* ── Date navigation ───────────────────────────────── */
    const goToday    = ()    => setDate(todayISO());
    const prevDay    = ()    => setDate(d => shiftDate(d, -1));
    const nextDay    = ()    => setDate(d => shiftDate(d, +1));
    const isToday    = date === todayISO();

    /* ── Render ────────────────────────────────────────── */
    return (
        <div className="apt-page">

            {/* ── Header ── */}
            <div className="apt-header">
                <h1 className="apt-title">Appointments</h1>
                <button className="apt-new-btn" onClick={() => openCreate()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    New Appointment
                </button>
            </div>

            {/* ── Toolbar ── */}
            <div className="apt-toolbar">
                {/* Date nav */}
                <div className="apt-date-nav">
                    <button className="apt-nav-btn" onClick={prevDay} title="Previous day">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="apt-date-input"
                    />
                    <button className="apt-nav-btn" onClick={nextDay} title="Next day">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                    {!isToday && (
                        <button className="apt-today-btn" onClick={goToday}>Danas</button>
                    )}
                </div>

                {/* Staff + Status filters */}
                <div className="apt-filters-right">
                    {team.length > 1 && (
                        <StaffFilter
                            team={team}
                            selectedId={selectedStaff}
                            onChange={setSelectedStaff}
                        />
                    )}
                    <StatusFilter
                        activeStatus={activeStatus}
                        onChange={setActiveStatus}
                    />
                </div>
            </div>

            {/* ── Table ── */}
            {loading ? (
                <div className="apt-loading">
                    <div className="apt-spinner" />
                    <span>Loading schedule…</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="apt-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
                    </svg>
                    <h2>{appointments.length > 0 ? 'No matching appointments' : 'No appointments today'}</h2>
                    <p>{appointments.length > 0 ? 'Try adjusting your filters.' : 'Your schedule is clear for this day.'}</p>
                    {appointments.length === 0 && (
                        <button className="apt-new-btn" style={{ marginTop: 16 }} onClick={() => openCreate()}>
                            Book an Appointment
                        </button>
                    )}
                </div>
            ) : (
                <div className="apt-table-wrap">
                    <table className="apt-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Client</th>
                                <th>Details</th>
                                <th>Staff</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(appt => {
                                const dimmed = DIMMED_STATUSES.has(appt.status);
                                const svc    = getService(appt.service_id);
                                const worker = getWorker(appt.assigned_to_user_id);

                                return (
                                    <tr
                                        key={appt.id}
                                        ref={el => { rowRefs.current[appt.id] = el; }}
                                        className={dimmed ? 'apt-row apt-row--muted' : 'apt-row'}
                                    >
                                        {/* Time */}
                                        <td className="apt-td-time">
                                            <span className="apt-time">{formatTime(appt.appointment_datetime)}</span>
                                            {svc?.duration_minutes && (
                                                <span className="apt-duration">{svc.duration_minutes} min</span>
                                            )}
                                        </td>

                                        {/* Client */}
                                        <td className="apt-td-client">
                                            <div className="apt-client-name">{appt.client_name}</div>
                                            {appt.phone && <div className="apt-client-phone">{appt.phone}</div>}
                                        </td>

                                        {/* Service details */}
                                        <td className="apt-td-details">
                                            <div className="apt-service-name">
                                                {svc?.name || `Service #${appt.service_id}`}
                                            </div>
                                            <div className="apt-service-meta">
                                                {svc?.duration_minutes && <span>{svc.duration_minutes} min</span>}
                                                {svc?.price != null && (
                                                    <>
                                                        {svc?.duration_minutes && <span className="apt-dot">·</span>}
                                                        <span className="apt-price">{formatPrice(svc.price)}</span>
                                                    </>
                                                )}
                                            </div>
                                        </td>

                                        {/* Staff */}
                                        <td className="apt-td-staff">
                                            {worker
                                                ? `${worker.user_first_name} ${worker.user_last_name}`
                                                : `Worker #${appt.assigned_to_user_id}`}
                                        </td>

                                        {/* Status pill */}
                                        <td className="apt-td-status">
                                            <StatusPill
                                                apptId={appt.id}
                                                currentStatus={appt.status || 'scheduled'}
                                                onStatusChange={handleStatusChange}
                                            />
                                        </td>

                                        {/* Actions */}
                                        <td className="apt-td-actions">
                                            <button
                                                className="apt-action-btn apt-action-edit"
                                                onClick={() => openEdit(appt)}
                                                title="Edit appointment"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                            </button>
                                            {canDelete(appt) && (
                                                <button
                                                    className="apt-action-btn apt-action-delete"
                                                    onClick={() => handleDelete(appt.id)}
                                                    title="Delete appointment"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                                                        <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                                                    </svg>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Modal (Create / Edit) ── */}
            {showModal && (
                <div className="apt-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="apt-modal">
                        {/* Modal header */}
                        <div className="apt-modal-header">
                            <h3>{editingAppointment ? 'Edit Appointment' : 'New Appointment'}</h3>
                            <button className="apt-modal-close" onClick={() => setShowModal(false)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M18 6L6 18M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="apt-modal-body">

                            {/* Client selector — locked on edit */}
                            {!editingAppointment ? (
                                <div className="apt-field">
                                    <label className="apt-label">Klijent *</label>
                                    <ClientSelector
                                        businessId={user?.activeBusinessId}
                                        value={clientSelection}
                                        onChange={(sel) => { setClientSelection(sel); setClientError(''); }}
                                        error={clientError}
                                    />
                                </div>
                            ) : (
                                <div className="apt-field">
                                    <label className="apt-label">Klijent</label>
                                    <div className="apt-client-locked">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                                        </svg>
                                        <span>{editingAppointment.name || 'Walk-in'}</span>
                                        <span className="apt-locked-hint">Cannot change client on edit</span>
                                    </div>
                                </div>
                            )}

                            {/* Date + Time */}
                            <div className="apt-field-row">
                                <div className="apt-field">
                                    <label className="apt-label">Date *</label>
                                    <input
                                        type="date"
                                        name="appointment_date"
                                        required
                                        value={formData.appointment_date}
                                        onChange={handleChange}
                                        className="apt-input"
                                    />
                                </div>
                                <div className="apt-field">
                                    <label className="apt-label">Time *</label>
                                    <input
                                        type="time"
                                        name="appointment_time"
                                        required
                                        value={formData.appointment_time}
                                        onChange={handleChange}
                                        className="apt-input"
                                    />
                                </div>
                            </div>

                            {/* Service + Worker */}
                            <div className="apt-field-row">
                                <div className="apt-field">
                                    <label className="apt-label">Service *</label>
                                    <select
                                        name="service_id"
                                        required
                                        value={formData.service_id}
                                        onChange={handleChange}
                                        className="apt-input"
                                    >
                                        {services.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.duration_minutes}min{s.price != null ? ` · ${formatPrice(s.price)}` : ''})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="apt-field">
                                    <label className="apt-label">Worker *</label>
                                    <select
                                        name="assigned_to_user_id"
                                        required
                                        value={formData.assigned_to_user_id}
                                        onChange={handleChange}
                                        className="apt-input"
                                    >
                                        {team.map(w => (
                                            <option key={w.user_id} value={w.user_id}>
                                                {w.user_first_name} {w.user_last_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="apt-field">
                                <label className="apt-label">Notes</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    rows={2}
                                    className="apt-input apt-textarea"
                                    placeholder="Special requests, preparation notes…"
                                />
                            </div>

                            {/* Footer */}
                            <div className="apt-modal-footer">
                                <button
                                    type="button"
                                    className="apt-btn-cancel"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="apt-btn-submit">
                                    {editingAppointment ? 'Save Changes' : 'Book Appointment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Appointments;
