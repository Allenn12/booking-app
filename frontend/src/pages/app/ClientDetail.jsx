import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';
import ClientEditPanel from '../../components/ui/ClientEditPanel';
import AppointmentDetailPanel from '../../components/ui/AppointmentDetailPanel';
import './ClientDetail.css';

/* ─── Status label map ─── */
const STATUS_LABELS = {
    scheduled: 'Zakazano',
    confirmed: 'Potvrđeno',
    completed: 'Završeno',
    cancelled: 'Otkazano',
    no_show:   'Nije došao',
};

/* ─── Helpers ─── */
function formatDateTime(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('hr-HR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatDateShort(dateString) {
    if (!dateString) return 'Nikad';
    return new Date(dateString).toLocaleDateString('hr-HR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

function formatRevenue(amount) {
    if (amount == null || isNaN(amount)) return '0,00 €';
    return Number(amount).toLocaleString('hr-HR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' €';
}

export default function ClientDetail() {
    const { clientId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const businessId = user?.activeBusinessId;

    const [client,     setClient]     = useState(null);
    const [upcoming,   setUpcoming]   = useState([]);
    const [history,    setHistory]    = useState([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyPage,  setHistoryPage]  = useState(1);
    const HISTORY_LIMIT = 10;

    const [notes,        setNotes]        = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [isLoading,    setIsLoading]    = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error,        setError]        = useState(null);
    const [showEditPanel, setShowEditPanel] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    /* ─── Fetch client detail ─── */
    const fetchClientDetail = useCallback(async (page = 1, append = false) => {
        if (!businessId || !clientId) return;

        if (page === 1) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }
        setError(null);

        try {
            const res = await api.getClientDetail(businessId, clientId, {
                historyPage:  page,
                historyLimit: HISTORY_LIMIT,
            });

            if (res.success) {
                const data = res.data;
                setClient(data.client);
                if (!append) {
                    // Only set notes on first load to avoid overwriting unsaved drafts 
                    setNotes(data.client.notes || '');
                }
                setUpcoming(data.upcoming || []);
                setHistory(prev => append ? [...prev, ...(data.history || [])] : (data.history || []));
                setHistoryTotal(data.historyTotal || 0);
                setHistoryPage(page);
            }
        } catch (err) {
            console.error('Failed to fetch client detail:', err);
            setError('Nije moguće učitati podatke o klijentu.');
            toast.error('Greška pri učitavanju klijenta');
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [businessId, clientId]);

    useEffect(() => {
        fetchClientDetail(1, false);
    }, [fetchClientDetail]);

    /* ─── Load more history ─── */
    const handleLoadMore = () => {
        fetchClientDetail(historyPage + 1, true);
    };

    /* ─── Save notes ─── */
    const handleSaveNotes = async () => {
        if (!businessId || !clientId) return;
        setIsSavingNotes(true);
        try {
            const res = await api.updateClientNotes(businessId, clientId, notes);
            if (res.success) {
                toast.success('Bilješke su uspješno spremljene');
                // Keep client.notes in sync
                setClient(prev => ({ ...prev, notes }));
            }
        } catch (err) {
            console.error('Failed to save notes:', err);
            toast.error('Greška pri spremanju bilješki');
        } finally {
            setIsSavingNotes(false);
        }
    };

    /* ─── Navigate to appointment in schedule ─── */
    const handleAppointmentClick = (apt) => {
        const dateStr = new Date(apt.appointment_datetime)
            .toISOString()
            .split('T')[0];
        navigate(`/appointments?date=${dateStr}&highlight=${apt.id}`);
    };

    /* ─── Copy portal link ─── */
    const handleCopyPortalLink = useCallback(() => {
        if (!client?.portal_token) {
            toast.error('Ovaj klijent nema portal link (walk-in ili stariji zapis).');
            return;
        }
        const FRONTEND_URL = import.meta.env.VITE_APP_URL || window.location.origin;
        const portalUrl = `${FRONTEND_URL}/portal/${client.portal_token}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(portalUrl)
                .then(() => toast.success('Portal link kopiran u clipboard!'))
                .catch(() => {
                    // Fallback: open in new tab
                    window.open(portalUrl, '_blank', 'noopener');
                });
        } else {
            window.open(portalUrl, '_blank', 'noopener');
        }
    }, [client]);

    /* ─── Book new appointment for this client ─── */
    const handleBookAppointment = () => {
        navigate('/appointments', {
            state: { preselectedClient: { id: client.id, name: client.name, phone: client.phone } }
        });
    };

    /* ─── Handle edit panel save ─── */
    const handleClientSaved = (updatedClient) => {
        setClient(updatedClient);
        // Sync notes textarea if notes were part of the update
        if (updatedClient.notes !== undefined) {
            setNotes(updatedClient.notes || '');
        }
        setShowEditPanel(false);
    };

    /* ─── Loading / error states ─── */
    if (isLoading) {
        return (
            <div className="client-detail-page">
                <div className="client-detail-loading">
                    <div className="spinner" />
                    <p>Učitavanje profila klijenta...</p>
                </div>
            </div>
        );
    }

    if (error || !client) {
        return (
            <div className="client-detail-page">
                <button className="btn-back" onClick={() => navigate('/clients')}>
                    ← Natrag na klijente
                </button>
                <div className="client-detail-error">
                    <h3>Upozorenje</h3>
                    <p>{error || 'Klijent nije pronađen.'}</p>
                </div>
            </div>
        );
    }

    const isWalkIn = client.phone === 'WALKIN';
    const hasMoreHistory = history.length < historyTotal;

    return (
        <div className="client-detail-page">
            {/* Edit panel (slide-over) */}
            {showEditPanel && (
                <ClientEditPanel
                    client={client}
                    businessId={businessId}
                    onClose={() => setShowEditPanel(false)}
                    onSaved={handleClientSaved}
                />
            )}

            {/* Appointment Detail Panel (slide-over) */}
            <AppointmentDetailPanel
                appointment={selectedAppointment}
                businessId={businessId}
                onClose={() => setSelectedAppointment(null)}
                onNavigateToSchedule={handleAppointmentClick}
                onStatusChanged={() => fetchClientDetail(1, false)}
            />

            <button className="btn-back" onClick={() => navigate('/clients')}>
                ← Natrag na listu klijenata
            </button>

            {/* ── Profile Header Card ── */}
            <div className="cd-header-card">
                <div className="cd-profile-main">
                    <div className="cd-avatar">
                        {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="cd-profile-info">
                        <div className="cd-name-row">
                            <h1>{client.name}</h1>
                            {isWalkIn && (
                                <span className="cd-walkin-badge">Walk-in profil (dijeljeno)</span>
                            )}
                        </div>
                        {!isWalkIn && (
                            <div className="cd-contact-row">
                                {client.phone && (
                                    <div className="cd-contact-item">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.86 9.5a19.79 19.79 0 01-3-8.59A2 2 0 012.83 1h2.93a2 2 0 011.97 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.64a16 16 0 006.35 6.35l1.02-1.02a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                                        </svg>
                                        <span>{client.phone}</span>
                                    </div>
                                )}
                                {client.email && (
                                    <div className="cd-contact-item">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M4 4h16v16H4z" /><path d="M22 6l-10 7L2 6"/>
                                        </svg>
                                        <span>{client.email}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {!isWalkIn && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Portal link button — only if client has a token */}
                        {client.portal_token && (
                            <button
                                className="cd-edit-btn"
                                onClick={handleCopyPortalLink}
                                title="Kopiraj portal link klijenta"
                                style={{ background: 'var(--color-cta)', color: 'white', borderColor: 'var(--color-cta)' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                                </svg>
                                Portal link
                            </button>
                        )}
                        <button
                            className="cd-edit-btn"
                            onClick={() => setShowEditPanel(true)}
                            title="Uredi podatke klijenta"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Uredi
                        </button>
                    </div>
                )}
            </div>

            {/* ── Stats row ── */}
            <div className="cd-stats-band">
                <div className="cd-stat">
                    <span className="cd-stat-label">Ukupno dolazaka</span>
                    <span className="cd-stat-value">{client.total_appointments || 0}</span>
                </div>
                <div className="cd-stat-divider" />
                <div className="cd-stat">
                    <span className="cd-stat-label">Nedolasci</span>
                    <span className={`cd-stat-value${(client.no_show_count || 0) > 0 ? ' danger' : ''}`}>
                        {client.no_show_count || 0}
                    </span>
                </div>
                <div className="cd-stat-divider" />
                <div className="cd-stat">
                    <span className="cd-stat-label">Zadnji posjet</span>
                    <span className="cd-stat-value">{formatDateShort(client.last_appointment_at)}</span>
                </div>
                <div className="cd-stat-divider" />
                <div className="cd-stat">
                    <span className="cd-stat-label">Ukupan prihod</span>
                    <span className="cd-stat-value revenue">{formatRevenue(client.total_revenue)}</span>
                </div>
            </div>

            <div className="cd-grid">
                {/* ── Left column: appointments ── */}
                <div className="cd-col-main">

                    {/* Upcoming Appointments */}
                    <div className="cd-section" style={{ marginBottom: '24px' }}>
                        <div className="cd-section-header">
                            <h2>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                                </svg>
                                Nadolazeći termini
                                {upcoming.length > 0 && (
                                    <span className="cd-section-count">{upcoming.length}</span>
                                )}
                            </h2>
                            {!isWalkIn && (
                                <button className="cd-book-btn" onClick={handleBookAppointment} title="Zakaži novi termin">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M12 5v14M5 12h14"/>
                                    </svg>
                                    Zakaži termin
                                </button>
                            )}
                        </div>

                        <div className="cd-apt-list">
                            {upcoming.length === 0 ? (
                                <div className="cd-apt-empty-state">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                                        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                                    </svg>
                                    <p>Nema zakazanih nadolazećih termina.</p>
                                </div>
                            ) : (
                                upcoming.map((apt) => (
                                    <div
                                        key={apt.id}
                                        className="cd-apt-card upcoming"
                                        onClick={() => setSelectedAppointment(apt)}
                                        title="Prikaži detalje termina"
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && setSelectedAppointment(apt)}
                                    >
                                        <div className="cd-apt-info">
                                            <div className="cd-apt-date">{formatDateTime(apt.appointment_datetime)}</div>
                                            <div className="cd-apt-service">{apt.service_name || 'Usluga'}</div>
                                            <div className="cd-apt-meta">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                                                </svg>
                                                {apt.worker_name || 'Djelatnik'}
                                                {apt.duration_minutes && (
                                                    <>
                                                        <span className="cd-dot">·</span>
                                                        {apt.duration_minutes} min
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="cd-apt-right">
                                            <span className={`cd-apt-status status-${apt.status}`}>
                                                {STATUS_LABELS[apt.status] || apt.status}
                                            </span>
                                            <svg className="cd-apt-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M9 18l6-6-6-6"/>
                                            </svg>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Visit History */}
                    <div className="cd-section">
                        <div className="cd-section-header">
                            <h2>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                </svg>
                                Povijest posjeta
                                {historyTotal > 0 && (
                                    <span className="cd-section-count">{historyTotal}</span>
                                )}
                            </h2>
                        </div>

                        <div className="cd-apt-list">
                            {history.length === 0 ? (
                                <div className="cd-apt-empty-state">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    <p>Nema zabilježenih prošlih posjeta.</p>
                                </div>
                            ) : (
                                <>
                                    {history.map((apt) => (
                                        <div
                                            key={apt.id}
                                            className="cd-apt-card past"
                                            onClick={() => setSelectedAppointment(apt)}
                                            title="Prikaži detalje termina"
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === 'Enter' && setSelectedAppointment(apt)}
                                        >
                                            <div className="cd-apt-info">
                                                <div className="cd-apt-date">{formatDateTime(apt.appointment_datetime)}</div>
                                                <div className="cd-apt-service">{apt.service_name || 'Usluga'}</div>
                                                <div className="cd-apt-meta">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                                                    </svg>
                                                    {apt.worker_name || 'Djelatnik'}
                                                    {apt.service_price != null && (
                                                        <>
                                                            <span className="cd-dot">·</span>
                                                            <span className="cd-apt-price">{formatRevenue(apt.service_price)}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="cd-apt-right">
                                                <span className={`cd-apt-status status-${apt.status}`}>
                                                    {STATUS_LABELS[apt.status] || apt.status}
                                                </span>
                                                <svg className="cd-apt-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M9 18l6-6-6-6"/>
                                                </svg>
                                            </div>
                                        </div>
                                    ))}

                                    {hasMoreHistory && (
                                        <button
                                            className="cd-show-more-btn"
                                            onClick={handleLoadMore}
                                            disabled={isLoadingMore}
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <span className="cd-small-spinner" />
                                                    Učitavanje...
                                                </>
                                            ) : (
                                                `Prikaži više (još ${historyTotal - history.length})`
                                            )}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Right column: internal notes ── */}
                <div className="cd-col-side">
                    <div className="cd-section">
                        <h2>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                            </svg>
                            Interne bilješke
                        </h2>
                        <p className="cd-notes-hint">
                            Ove bilješke su vidljive samo osoblju salona. Klijent ih ne može vidjeti.
                        </p>

                        <div className="cd-notes-editor">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Unesite bilješke o klijentu (alergije, preferencije, posebni zahtjevi)..."
                            />
                            <div className="cd-notes-actions">
                                <button
                                    className="btn-save-notes"
                                    onClick={handleSaveNotes}
                                    disabled={isSavingNotes || notes === (client.notes || '')}
                                >
                                    {isSavingNotes ? 'Spremanje...' : 'Spremi bilješke'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
