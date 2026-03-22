import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { toast } from 'sonner';
import './AppointmentDetailPanel.css';

export default function AppointmentDetailPanel({ appointment, onClose, onNavigateToSchedule, onStatusChanged }) {
    const [isCancelling, setIsCancelling] = useState(false);
    // Close on Escape key
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!appointment) return null;

    // Date formatting (DD.MM.YYYY.)
    const apptDate = new Date(appointment.appointment_datetime);
    const dateStr = new Intl.DateTimeFormat('hr-HR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    }).format(apptDate);

    // Time formatting (HH:mm)
    const timeStr = apptDate.toLocaleTimeString('hr-HR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    // Formatting revenue / price
    const formatRevenue = (value) => 
        new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(value || 0);

    // Human-readable status badges matching existing logic
    const renderStatusBadge = (status) => {
        let label = 'Zakazano';
        let badgeClass = 'adp-badge-scheduled';
        if (status === 'completed') {
            label = 'Završeno';
            badgeClass = 'adp-badge-completed';
        } else if (status === 'cancelled') {
            label = 'Otkazano';
            badgeClass = 'adp-badge-cancelled';
        } else if (status === 'no_show') {
            label = 'Nije došao/la';
            badgeClass = 'adp-badge-noshow';
        }
        return <span className={`adp-badge ${badgeClass}`}>{label}</span>;
    };

    const handleCancel = async () => {
        if (!window.confirm('Jeste li sigurni da želite otkazati ovaj termin?')) return;
        
        setIsCancelling(true);
        try {
            const res = await api.updateAppointment(appointment.id, { status: 'cancelled' });
            if (res.success) {
                toast.success('Termin je uspješno otkazan');
                if (onStatusChanged) onStatusChanged();
                onClose();
            }
        } catch (err) {
            console.error('Failed to cancel appointment:', err);
            toast.error(err.message || 'Greška pri otkazivanju termina');
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="adp-backdrop" onClick={onClose} aria-hidden="true" />

            {/* Panel */}
            <aside className="adp-panel" role="dialog" aria-modal="true" aria-label="Detalji termina">
                <div className="adp-header">
                    <h2 className="adp-title">Detalji termina</h2>
                    <button className="adp-close-btn" onClick={onClose} title="Zatvori" aria-label="Zatvori panel">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <div className="adp-body">
                    {/* Status header area */}
                    <div className="adp-status-section">
                        {renderStatusBadge(appointment.status)}
                    </div>

                    {/* Datetime Group */}
                    <div className="adp-info-group">
                        <div className="adp-info-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                            </svg>
                        </div>
                        <div className="adp-info-content">
                            <div className="adp-info-label">Datum i vrijeme</div>
                            <div className="adp-info-value">{dateStr} u {timeStr}</div>
                        </div>
                    </div>

                    {/* Service Group */}
                    <div className="adp-info-group">
                        <div className="adp-info-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
                            </svg>
                        </div>
                        <div className="adp-info-content">
                            <div className="adp-info-label">Usluga</div>
                            <div className="adp-info-value">{appointment.service_name || 'Nema usluge'}</div>
                            {appointment.duration_minutes > 0 && (
                                <div className="adp-info-subtext">{appointment.duration_minutes} min</div>
                            )}
                        </div>
                    </div>

                    {/* Worker Group */}
                    <div className="adp-info-group">
                        <div className="adp-info-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                            </svg>
                        </div>
                        <div className="adp-info-content">
                            <div className="adp-info-label">Djelatnik</div>
                            <div className="adp-info-value">{appointment.worker_name || '-'}</div>
                        </div>
                    </div>

                    {/* Price Group */}
                    {appointment.service_price != null && (
                        <div className="adp-info-group">
                            <div className="adp-info-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                                </svg>
                            </div>
                            <div className="adp-info-content">
                                <div className="adp-info-label">Cijena</div>
                                <div className="adp-info-value adp-price">
                                    {formatRevenue(appointment.service_price)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notes Group */}
                    {appointment.notes && (
                        <div className="adp-info-group adp-notes-group">
                            <div className="adp-info-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                                </svg>
                            </div>
                            <div className="adp-info-content">
                                <div className="adp-info-label">Bilješka</div>
                                <div className="adp-info-value">
                                    {appointment.notes}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="adp-footer">
                    {(appointment.status === 'scheduled' || appointment.status === 'confirmed') ? (
                        <div className="adp-footer-actions">
                            <button 
                                type="button" 
                                className="adp-btn-cancel" 
                                onClick={handleCancel}
                                disabled={isCancelling}
                            >
                                {isCancelling ? 'Otkazuje se...' : 'Otkaži termin'}
                            </button>
                            <button 
                                type="button" 
                                className="adp-btn-navigate" 
                                onClick={() => onNavigateToSchedule(appointment)}
                                disabled={isCancelling}
                            >
                                Otvori u terminima →
                            </button>
                        </div>
                    ) : (
                        <div className="adp-footer-actions">
                            <button 
                                type="button" 
                                className="adp-btn-navigate adp-btn-navigate-full" 
                                onClick={() => onNavigateToSchedule(appointment)}
                            >
                                Otvori u terminima →
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
