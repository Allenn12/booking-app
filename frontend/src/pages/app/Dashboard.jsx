import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';

function Dashboard() {
  const { user, businesses } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    if (user?.activeBusinessId) {
      fetchDashboardStats();
    }
  }, [user?.activeBusinessId]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardStats(user.activeBusinessId);
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      toast.error('Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  // ─── Greeting based on time of day ───
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Dobro jutro';
    if (hour < 18) return 'Dobar dan';
    return 'Dobra večer';
  };

  // ─── Active business name ───
  const businessName = businesses?.find(
    b => b.business_id === Number(user?.activeBusinessId)
  )?.business_name || 'Moj biznis';

  // ─── Date formatter for Croatian ───
  const formatDate = () => {
    return new Date().toLocaleDateString('hr-HR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (datetime) => {
    return new Date(datetime).toLocaleTimeString('hr-HR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ─── Status badge colors ───
  const statusConfig = {
    scheduled: { label: 'Zakazan', bg: '#e8f4fd', color: '#0d6efd', border: '#b6d4fe' },
    completed: { label: 'Završen', bg: '#d1e7dd', color: '#198754', border: '#a3cfbb' },
    cancelled: { label: 'Otkazan', bg: '#f8d7da', color: '#dc3545', border: '#f1aeb5' },
    no_show: { label: 'Nije došao', bg: '#fff3cd', color: '#856404', border: '#ffe69c' }
  };

  // ─── Invite code for quick copy ───
  const currentBiz = businesses?.find(b => b.business_id === Number(user?.activeBusinessId));
  const inviteCode = currentBiz?.invite_code || '';

  const copyInviteCode = () => {
    if (!inviteCode) return toast.error('Pozivni kod nije dostupan');
    navigator.clipboard.writeText(inviteCode);
    toast.success('Pozivni kod kopiran!');
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#666' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📊</div>
          <p>Učitavanje nadzorne ploče...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '30px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* ═══════════════ GREETING HEADER ═══════════════ */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '28px', color: '#1a1a2e', fontWeight: '700' }}>
          {getGreeting()}, {user?.firstName || 'Korisnik'}! 👋
        </h1>
        <p style={{ margin: 0, color: '#6c757d', fontSize: '15px' }}>
          {businessName} · <span style={{ textTransform: 'capitalize' }}>{formatDate()}</span>
        </p>
      </div>

      {/* ═══════════════ KPI CARDS ═══════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '30px'
      }}>
        {/* Card: Danas */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={cardLabelStyle}>📅 Danas</p>
              <p style={cardNumberStyle}>{stats?.today?.total || 0}</p>
              <p style={cardSubStyle}>
                {stats?.today?.total === 1 ? 'termin' :
                  (stats?.today?.total >= 2 && stats?.today?.total <= 4) ? 'termina' : 'termina'}
              </p>
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span style={miniTagStyle('#d1e7dd', '#198754')}>
              ✓ {stats?.today?.completed || 0} završ.
            </span>
            {stats?.today?.noShow > 0 && (
              <span style={miniTagStyle('#fff3cd', '#856404')}>
                ⚠ {stats?.today?.noShow} no-show
              </span>
            )}
            {stats?.today?.cancelled > 0 && (
              <span style={miniTagStyle('#f8d7da', '#dc3545')}>
                ✕ {stats?.today?.cancelled} otkazan.
              </span>
            )}
          </div>
        </div>

        {/* Card: Ovaj tjedan */}
        <div style={cardStyle}>
          <p style={cardLabelStyle}>📊 Ovaj tjedan</p>
          <p style={cardNumberStyle}>{stats?.week?.total || 0}</p>
          <p style={cardSubStyle}>termina ukupno</p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
            <span style={miniTagStyle('#d1e7dd', '#198754')}>
              ✓ {stats?.week?.completed || 0} završ.
            </span>
            {stats?.week?.noShow > 0 && (
              <span style={miniTagStyle('#fff3cd', '#856404')}>
                ⚠ {stats?.week?.noShow} no-show
              </span>
            )}
          </div>
        </div>

        {/* Card: Tim */}
        <div style={cardStyle}>
          <p style={cardLabelStyle}>👥 Tim</p>
          <p style={cardNumberStyle}>{stats?.team?.count || 0}</p>
          <p style={cardSubStyle}>
            {stats?.team?.count === 1 ? 'član' : 'članova'}
          </p>
          {inviteCode && (
            <div style={{ marginTop: '12px' }}>
              <button
                onClick={copyInviteCode}
                style={{
                  background: '#f0f0f0', border: '1px solid #ddd',
                  borderRadius: '6px', padding: '6px 10px',
                  cursor: 'pointer', fontSize: '12px', color: '#555',
                  display: 'flex', alignItems: 'center', gap: '5px'
                }}
              >
                📋 {inviteCode}
              </button>
            </div>
          )}
        </div>

        {/* Card: SMS Krediti */}
        <div style={{
          ...cardStyle,
          background: stats?.credits?.balance > 0
            ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
            : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          border: stats?.credits?.balance > 0 ? '1px solid #a3cfbb' : '1px solid #dee2e6'
        }}>
          <p style={cardLabelStyle}>💬 SMS Krediti</p>
          <p style={cardNumberStyle}>{stats?.credits?.balance || 0}</p>
          <p style={cardSubStyle}>
            {stats?.credits?.balance > 0 ? 'kredita preostalo' : 'kredita'}
          </p>
          <div style={{ marginTop: '12px' }}>
            <span style={{
              display: 'inline-block',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              background: stats?.credits?.balance > 0 ? '#198754' : '#dc3545',
              color: 'white'
            }}>
              {stats?.credits?.balance > 0 ? 'Aktivno' : 'Nije aktivno'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════ UPCOMING APPOINTMENTS ═══════════════ */}
      <div style={{
        background: 'white', borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        padding: '24px', marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#1a1a2e' }}>
            ⏭️ Nadolazeći termini danas
          </h2>
          <button
            onClick={() => navigate('/appointments')}
            style={{
              background: 'none', border: 'none',
              color: '#0d6efd', cursor: 'pointer',
              fontSize: '14px', fontWeight: '500',
              textDecoration: 'none'
            }}
          >
            Vidi sve termine →
          </button>
        </div>

        {(!stats?.today?.upcoming || stats.today.upcoming.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📅</div>
            <p style={{ margin: 0, fontSize: '15px' }}>Danas nema nadolazećih termina</p>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#aaa' }}>
              Novi termin možete dodati na stranici termina.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stats.today.upcoming.map(appt => (
              <div
                key={appt.id}
                onClick={() => setSelectedAppointment(appt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: '#fafbfc'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#f0f4ff';
                  e.currentTarget.style.borderColor = '#c7d2fe';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#fafbfc';
                  e.currentTarget.style.borderColor = '#f0f0f0';
                }}
              >
                {/* Time */}
                <div style={{
                  minWidth: '55px', textAlign: 'center',
                  fontWeight: '700', fontSize: '16px', color: '#0d6efd'
                }}>
                  {formatTime(appt.appointment_datetime)}
                </div>

                {/* Divider */}
                <div style={{ width: '3px', height: '36px', background: '#0d6efd', borderRadius: '2px', opacity: 0.3 }} />

                {/* Client + Service */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#1a1a2e', fontSize: '15px' }}>
                    {appt.client_name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '2px' }}>
                    {appt.service_name || 'Usluga'}
                    {appt.service_duration ? ` · ${appt.service_duration} min` : ''}
                  </div>
                </div>

                {/* Worker */}
                <div style={{ fontSize: '13px', color: '#888', textAlign: 'right' }}>
                  {appt.worker_name}
                </div>

                {/* Arrow */}
                <div style={{ color: '#ccc', fontSize: '18px' }}>›</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════ MONTHLY STATS + SMS SECTION ═══════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {/* Top Services */}
        <div style={{
          background: 'white', borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1a1a2e' }}>
            🏆 Top usluge ovaj mjesec
          </h3>
          {(!stats?.month?.topServices || stats.month.topServices.length === 0) ? (
            <p style={{ color: '#999', fontSize: '14px' }}>Nema podataka za ovaj mjesec</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.month.topServices.map((svc, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '10px 12px',
                  background: i === 0 ? '#f0f4ff' : '#fafbfc',
                  borderRadius: '8px', border: '1px solid #f0f0f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      width: '24px', height: '24px',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: '700',
                      background: i === 0 ? '#0d6efd' : '#e9ecef',
                      color: i === 0 ? 'white' : '#555'
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontWeight: '500', color: '#333', fontSize: '14px' }}>
                      {svc.name}
                    </span>
                  </div>
                  <span style={{ fontWeight: '600', color: '#0d6efd', fontSize: '14px' }}>
                    {svc.count}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Stats */}
        <div style={{
          background: 'white', borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1a1a2e' }}>
            📈 Statistika
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <StatRow
              icon="👤"
              label="Novi klijenti ovaj mjesec"
              value={stats?.month?.newClients || 0}
            />
            <StatRow
              icon="📇"
              label="Ukupno klijenata"
              value={stats?.month?.totalClients || 0}
            />
            <StatRow
              icon="⚠️"
              label="No-show postotak (tjedan)"
              value={`${stats?.month?.noShowRate || 0}%`}
              valueColor={stats?.month?.noShowRate > 10 ? '#dc3545' : '#198754'}
            />
          </div>
        </div>
      </div>

      {/* ═══════════════ SMS CREDITS TEASER ═══════════════ */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '12px', padding: '28px', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '20px'
      }}>
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>
            💬 SMS Obavijesti za klijente
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#a0aec0', maxWidth: '500px', lineHeight: '1.5' }}>
            Kupite kredite kako bi vaši klijenti automatski primali SMS podsjetnike
            prije termina. Smanjuje nedolaske za do 80%.
          </p>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              padding: '4px 10px', borderRadius: '12px',
              fontSize: '12px', fontWeight: '600',
              background: stats?.credits?.balance > 0 ? 'rgba(25,135,84,0.3)' : 'rgba(220,53,69,0.3)',
              color: stats?.credits?.balance > 0 ? '#86efac' : '#fca5a5'
            }}>
              Stanje: {stats?.credits?.balance || 0} kredita
            </span>
          </div>
        </div>
        <button
          style={{
            padding: '12px 28px',
            background: 'linear-gradient(135deg, #0d6efd, #6366f1)',
            color: 'white', border: 'none',
            borderRadius: '8px', cursor: 'pointer',
            fontWeight: '600', fontSize: '15px',
            boxShadow: '0 4px 12px rgba(13,110,253,0.4)',
            opacity: 0.85
          }}
          onClick={() => toast.info('Kupovina kredita dolazi uskoro!')}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
        >
          Kupi kredite
        </button>
      </div>

      {/* ═══════════════ APPOINTMENT DETAIL MODAL ═══════════════ */}
      {selectedAppointment && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAppointment(null);
          }}
        >
          <div style={{
            background: 'white', borderRadius: '14px',
            width: '100%', maxWidth: '440px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#fafbfc'
            }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#1a1a2e' }}>
                Detalji termina
              </h3>
              <button
                onClick={() => setSelectedAppointment(null)}
                style={{
                  background: 'none', border: 'none',
                  fontSize: '22px', cursor: 'pointer', color: '#999',
                  padding: '0 4px'
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {/* Status Badge */}
              <div style={{ marginBottom: '20px' }}>
                {(() => {
                  const cfg = statusConfig[selectedAppointment.status] || statusConfig.scheduled;
                  return (
                    <span style={{
                      padding: '5px 14px', borderRadius: '20px',
                      fontSize: '13px', fontWeight: '600',
                      background: cfg.bg, color: cfg.color,
                      border: `1px solid ${cfg.border}`
                    }}>
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>

              {/* Details Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <DetailRow icon="👤" label="Klijent" value={selectedAppointment.client_name} />
                <DetailRow icon="📞" label="Telefon" value={selectedAppointment.client_phone || '—'} />
                <DetailRow
                  icon="🕐"
                  label="Vrijeme"
                  value={formatTime(selectedAppointment.appointment_datetime)}
                />
                <DetailRow
                  icon="✂️"
                  label="Usluga"
                  value={`${selectedAppointment.service_name || '—'}${selectedAppointment.service_duration ? ` (${selectedAppointment.service_duration} min)` : ''}`}
                />
                <DetailRow icon="🧑‍💼" label="Radnik" value={selectedAppointment.worker_name || '—'} />
                {selectedAppointment.notes && (
                  <DetailRow icon="📝" label="Napomena" value={selectedAppointment.notes} />
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid #f0f0f0',
              display: 'flex', justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setSelectedAppointment(null)}
                style={{
                  padding: '9px 20px',
                  background: '#f8f9fa', border: '1px solid #dee2e6',
                  borderRadius: '8px', cursor: 'pointer',
                  fontWeight: '500', fontSize: '14px', color: '#495057'
                }}
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function StatRow({ icon, label, value, valueColor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 12px', background: '#fafbfc', borderRadius: '8px',
      border: '1px solid #f0f0f0'
    }}>
      <span style={{ fontSize: '14px', color: '#555' }}>
        {icon} {label}
      </span>
      <span style={{
        fontWeight: '700', fontSize: '16px',
        color: valueColor || '#1a1a2e'
      }}>
        {value}
      </span>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </div>
        <div style={{ fontSize: '15px', color: '#1a1a2e', fontWeight: '500', marginTop: '2px' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────

const cardStyle = {
  background: 'white',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  padding: '20px',
  border: '1px solid #f0f0f0'
};

const cardLabelStyle = {
  margin: '0 0 6px 0',
  fontSize: '13px',
  fontWeight: '600',
  color: '#6c757d',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const cardNumberStyle = {
  margin: 0,
  fontSize: '32px',
  fontWeight: '800',
  color: '#1a1a2e',
  lineHeight: '1.1'
};

const cardSubStyle = {
  margin: '2px 0 0 0',
  fontSize: '13px',
  color: '#999'
};

const miniTagStyle = (bg, color) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '10px',
  fontSize: '11px',
  fontWeight: '600',
  background: bg,
  color: color
});

export default Dashboard;
