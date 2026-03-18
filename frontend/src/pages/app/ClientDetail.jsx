import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';
import './ClientDetail.css';

export default function ClientDetail() {
    const { clientId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const businessId = user?.activeBusinessId;

    const [client, setClient] = useState(null);
    const [upcoming, setUpcoming] = useState([]);
    const [past, setPast] = useState([]);
    
    const [notes, setNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchClientDetail = useCallback(async () => {
        if (!businessId || !clientId) return;

        setIsLoading(true);
        setError(null);
        try {
            const res = await api.getClientDetail(businessId, clientId);
            if (res.success) {
                setClient(res.data.client);
                setNotes(res.data.client.notes || '');
                
                // Separate appointments into upcoming and past based on datetime
                const now = new Date();
                const allApts = res.data.appointments || [];
                
                const up = [];
                const pa = [];
                allApts.forEach(apt => {
                    if (new Date(apt.appointment_datetime) >= now && apt.status !== 'cancelled' && apt.status !== 'no_show') {
                        up.push(apt);
                    } else {
                        pa.push(apt);
                    }
                });
                
                setUpcoming(up);
                setPast(pa);
            }
        } catch (err) {
            console.error('Failed to fetch client detail:', err);
            setError('Nije moguće učitati podatke o klijentu.');
            toast.error('Greska pri učitavanju klijenta');
        } finally {
            setIsLoading(false);
        }
    }, [businessId, clientId]);

    useEffect(() => {
        fetchClientDetail();
         
    }, [fetchClientDetail]);

    const handleSaveNotes = async () => {
        if (!businessId || !clientId) return;
        setIsSavingNotes(true);
        try {
            const res = await api.updateClientNotes(businessId, clientId, notes);
            if (res.success) {
                toast.success('Bilješke su uspješno spremljene');
            }
        } catch (err) {
            console.error('Failed to save notes:', err);
            toast.error('Greška pri spremanju bilješki');
        } finally {
            setIsSavingNotes(false);
        }
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        return d.toLocaleDateString('hr-HR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    if (isLoading) {
        return (
            <div className="client-detail-page">
                <div className="client-detail-loading">
                    <div className="spinner"></div>
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

    const isWalkIn = client.name === 'Walk-in' && client.phone === 'WALKIN';

    return (
        <div className="client-detail-page">
            <button className="btn-back" onClick={() => navigate('/clients')}>
                ← Natrag na listu klijenata
            </button>

            {/* Profile Header Card */}
            <div className="cd-header-card">
                <div className="cd-profile-main">
                    <div className="cd-profile-info">
                        <h1>
                            {client.name}
                            {isWalkIn && <span className="cd-walkin-badge">Walk-in profil (dijeljeno)</span>}
                        </h1>
                        {!isWalkIn && (
                            <div className="cd-contact-row">
                                <div className="cd-contact-item">
                                    📞 <span>{client.phone}</span>
                                </div>
                                {client.email && (
                                    <div className="cd-contact-item">
                                        ✉️ <span>{client.email}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="cd-stats-row">
                    <div className="cd-stat">
                        <span className="cd-stat-label">Ukupno dolazaka</span>
                        <span className="cd-stat-value">{client.total_appointments}</span>
                    </div>
                    <div className="cd-stat">
                        <span className="cd-stat-label">Nedolasci</span>
                        <span className={`cd-stat-value ${(client.no_show_count || 0) > 0 ? 'danger' : ''}`}>
                            {client.no_show_count || 0}
                        </span>
                    </div>
                </div>
            </div>

            <div className="cd-grid">
                {/* Left Column: History */}
                <div className="cd-col-main">
                    
                    {/* Upcoming Appointments */}
                    <div className="cd-section" style={{ marginBottom: '24px' }}>
                        <h2>📅 Nadolazeći termini</h2>
                        <div className="cd-apt-list">
                            {upcoming.length === 0 ? (
                                <p className="cd-apt-empty">Nema zakazanih nadolazećih termina.</p>
                            ) : (
                                upcoming.map((apt) => (
                                    <div key={apt.id} className="cd-apt-card upcoming">
                                        <div className="cd-apt-info">
                                            <div className="cd-apt-date">{formatDateTime(apt.appointment_datetime)}</div>
                                            <div className="cd-apt-service">{apt.Service?.name || 'Usluga'}</div>
                                            <div className="cd-apt-worker">👤 {apt.User?.name || 'Djelatnik'}</div>
                                        </div>
                                        <div className="cd-apt-status status-open">Zakazano</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Past Appointments */}
                    <div className="cd-section">
                        <h2>🕒 Povijest posjeta</h2>
                        <div className="cd-apt-list">
                            {past.length === 0 ? (
                                <p className="cd-apt-empty">Nema zabilježenih prošlih posjeta.</p>
                            ) : (
                                past.map((apt) => (
                                    <div key={apt.id} className="cd-apt-card past">
                                        <div className="cd-apt-info">
                                            <div className="cd-apt-date">{formatDateTime(apt.appointment_datetime)}</div>
                                            <div className="cd-apt-service">{apt.Service?.name || 'Usluga'}</div>
                                            <div className="cd-apt-worker">👤 {apt.User?.name || 'Djelatnik'}</div>
                                        </div>
                                        <div className={`cd-apt-status status-${apt.status}`}>
                                            {apt.status === 'completed' ? 'Završeno' : 
                                             apt.status === 'cancelled' ? 'Otkazano' : 
                                             apt.status === 'no_show' ? 'Nije došao' : apt.status}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Internal Notes */}
                <div className="cd-col-side">
                    <div className="cd-section">
                        <h2>📝 Interne bilješke</h2>
                        <p style={{ fontSize: '13px', color: '#667085', marginTop: 0, marginBottom: '16px' }}>
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
