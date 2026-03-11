import React, { useState } from 'react';
import { toast } from 'sonner';

// ─── Mock Data ──────────────────────────────────────────────

const MOCK_LOGS = [
    { id: 1, date: '2026-03-11 09:15', client: 'Ana Marić', phone: '+385911234567', type: 'confirmation', status: 'delivered', credits: 1, message: 'Poštovani/a Ana Marić, vaš termin za Šišanje je potvrđen za 10:00, 12.03.2026. Salon Lucija' },
    { id: 2, date: '2026-03-11 08:00', client: 'Marko Horvat', phone: '+385921234567', type: 'reminder', status: 'sent', credits: 1, message: 'Podsjetnik: sutra u 09:30 imate zakazan termin za Bojanje kose kod Ivana. Salon Lucija' },
    { id: 3, date: '2026-03-10 14:30', client: 'Petra Novak', phone: '+385981234567', type: 'cancellation', status: 'delivered', credits: 1, message: 'Obavijest: vaš termin za Manikura (15:00, 11.03.2026.) je otkazan. Javite nam se za novi termin. Salon Lucija' },
    { id: 4, date: '2026-03-10 10:00', client: 'Ivan Babić', phone: '+385951234567', type: 'confirmation', status: 'failed', credits: 0, message: 'Poštovani/a Ivan Babić, vaš termin...', error: 'Unreachable: Phone number is not a mobile number' },
    { id: 5, date: '2026-03-09 17:45', client: 'Lucija Katić', phone: '+385991234567', type: 'reminder', status: 'delivered', credits: 1, message: 'Podsjetnik: sutra u 11:00 imate zakazan termin za Pedikura kod Marko. Salon Lucija' },
    { id: 6, date: '2026-03-09 12:00', client: 'Tomislav Jurić', phone: '+385911234568', type: 'confirmation', status: 'cancelled', credits: 0, message: 'Poštovani/a Tomislav Jurić, vaš termin za Šišanje je potvrđen za 14:00, 10.03.2026. Salon Lucija' },
    { id: 7, date: '2026-03-08 08:00', client: 'Ana Marić', phone: '+385911234567', type: 'reminder', status: 'delivered', credits: 1, message: 'Podsjetnik: sutra u 10:00 imate zakazan termin za Šišanje kod Ivana. Salon Lucija' },
];

const MOCK_TRANSACTIONS = [
    { id: 1, date: '2026-03-01 10:00', type: 'purchase', amount: 100, balance: 100, description: 'Kupnja 100 kredita' },
    { id: 2, date: '2026-03-05 09:15', type: 'usage', amount: -1, balance: 99, description: 'SMS podsjetnik — Ana Marić' },
    { id: 3, date: '2026-03-05 14:30', type: 'usage', amount: -1, balance: 98, description: 'SMS potvrda — Marko Horvat' },
    { id: 4, date: '2026-03-10 10:00', type: 'refund', amount: 1, balance: 99, description: 'Povrat — neuspjeli SMS Ivan Babić' },
];

const STATUS_CONFIG = {
    pending: { label: 'Na čekanju', color: '#f59e0b', bg: '#fffbeb', icon: '🟡' },
    sent: { label: 'Poslano', color: '#198754', bg: '#f0fdf4', icon: '🟢' },
    delivered: { label: 'Dostavljeno', color: '#0d6efd', bg: '#eff6ff', icon: '🔵' },
    failed: { label: 'Neuspjelo', color: '#dc3545', bg: '#fef2f2', icon: '🔴' },
    cancelled: { label: 'Otkazano', color: '#6c757d', bg: '#f8f9fa', icon: '⚫' }
};

const TYPE_LABELS = {
    confirmation: 'Potvrda',
    reminder: 'Podsjetnik',
    cancellation: 'Otkazivanje'
};

// ─── Main Component ─────────────────────────────────────────

function LogsAndBilling() {
    const [dateFilter, setDateFilter] = useState('7');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [expandedRow, setExpandedRow] = useState(null);
    const [showTransactions, setShowTransactions] = useState(false);

    // Mock values
    const creditBalance = 47;
    const monthlyUsage = 23;
    const isActive = creditBalance > 0;

    // Filter logs
    const filteredLogs = MOCK_LOGS.filter(log => {
        if (typeFilter !== 'all' && log.type !== typeFilter) return false;
        if (statusFilter !== 'all' && log.status !== statusFilter) return false;
        return true;
    });

    return (
        <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Page Header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', color: '#1a1a2e', fontWeight: '700' }}>
                    📊 Dnevnik i krediti
                </h1>
                <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
                    Pratite poslane poruke, stanje kredita i povijest transakcija.
                </p>
            </div>

            {/* ═══ Credit Balance Card ═══ */}
            <div style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                borderRadius: '16px', padding: '28px 32px',
                color: 'white', marginBottom: '28px',
                boxShadow: '0 8px 32px rgba(26,26,46,0.3)',
                display: 'grid', gridTemplateColumns: '1fr auto', gap: '20px', alignItems: 'center'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '42px', fontWeight: '800', lineHeight: 1 }}>{creditBalance}</span>
                        <span style={{ fontSize: '16px', color: '#a0aec0', marginTop: '8px' }}>kredita</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                            background: isActive ? 'rgba(25,135,84,0.2)' : 'rgba(220,53,69,0.2)',
                            color: isActive ? '#6ee7a0' : '#fca5a5'
                        }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#6ee7a0' : '#fca5a5' }} />
                            {isActive ? 'Aktivno' : 'Neaktivno'}
                        </span>
                        <span style={{ color: '#a0aec0', fontSize: '13px' }}>
                            Ovaj mjesec: {monthlyUsage} SMS-a poslano
                        </span>
                    </div>

                    {/* Credits progress bar */}
                    <div style={{
                        marginTop: '14px', height: '6px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '3px', maxWidth: '300px'
                    }}>
                        <div style={{
                            height: '100%', width: `${Math.min((creditBalance / 100) * 100, 100)}%`,
                            background: 'linear-gradient(90deg, #6ee7a0, #38bdf8)',
                            borderRadius: '3px', transition: 'width 0.5s ease'
                        }} />
                    </div>
                </div>

                <button
                    onClick={() => toast.info('Kupovina kredita dolazi uskoro!')}
                    style={{
                        padding: '14px 28px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white', border: 'none', borderRadius: '10px',
                        fontWeight: '700', fontSize: '15px', cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                        transition: 'transform 0.15s ease',
                        whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    💳 Kupi kredite
                </button>
            </div>

            {/* ═══ Notification Logs ═══ */}
            <div style={{
                background: 'white', borderRadius: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                overflow: 'hidden', marginBottom: '24px'
            }}>
                {/* Filter Row */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center'
                }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a2e', marginRight: '4px' }}>Filtriraj:</span>

                    <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={filterSelectStyle}>
                        <option value="7">Zadnjih 7 dana</option>
                        <option value="30">Zadnjih 30 dana</option>
                        <option value="all">Sve</option>
                    </select>

                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={filterSelectStyle}>
                        <option value="all">Svi tipovi</option>
                        <option value="confirmation">Potvrda</option>
                        <option value="reminder">Podsjetnik</option>
                        <option value="cancellation">Otkazivanje</option>
                    </select>

                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterSelectStyle}>
                        <option value="all">Svi statusi</option>
                        <option value="sent">Poslano</option>
                        <option value="delivered">Dostavljeno</option>
                        <option value="failed">Neuspjelo</option>
                        <option value="cancelled">Otkazano</option>
                    </select>
                </div>

                {/* Table Header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 1fr 110px 120px 70px',
                    padding: '10px 20px',
                    background: '#fafbfc',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: '12px', fontWeight: '600', color: '#888',
                    textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>
                    <span>Datum i vrijeme</span>
                    <span>Klijent</span>
                    <span>Tip</span>
                    <span>Status</span>
                    <span style={{ textAlign: 'right' }}>Krediti</span>
                </div>

                {/* Table Rows */}
                {filteredLogs.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999', fontSize: '15px' }}>
                        Još nema poslanih obavijesti 📨
                    </div>
                ) : (
                    filteredLogs.map(log => {
                        const statusCfg = STATUS_CONFIG[log.status];
                        const isExpanded = expandedRow === log.id;
                        return (
                            <div key={log.id}>
                                <div
                                    onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '160px 1fr 110px 120px 70px',
                                        padding: '14px 20px',
                                        borderBottom: '1px solid #f7f7f7',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s',
                                        background: isExpanded ? '#fafbff' : 'transparent',
                                        alignItems: 'center'
                                    }}
                                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#fafbfc'; }}
                                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <span style={{ fontSize: '13px', color: '#555' }}>{log.date}</span>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a2e' }}>{log.client}</div>
                                        <div style={{ fontSize: '12px', color: '#999' }}>{log.phone}</div>
                                    </div>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '3px 10px', borderRadius: '4px',
                                        fontSize: '12px', fontWeight: '600',
                                        background: '#f0f4ff', color: '#4338ca'
                                    }}>
                                        {TYPE_LABELS[log.type]}
                                    </span>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '3px 10px', borderRadius: '4px',
                                        fontSize: '12px', fontWeight: '600',
                                        background: statusCfg.bg, color: statusCfg.color
                                    }}>
                                        {statusCfg.icon} {statusCfg.label}
                                    </span>
                                    <span style={{ textAlign: 'right', fontSize: '14px', fontWeight: '600', color: log.credits > 0 ? '#dc3545' : '#999' }}>
                                        {log.credits > 0 ? `-${log.credits}` : '—'}
                                    </span>
                                </div>

                                {/* Expanded Detail */}
                                {isExpanded && (
                                    <div style={{
                                        padding: '14px 20px 14px 40px',
                                        background: '#fafbff',
                                        borderBottom: '1px solid #e9ecef',
                                        fontSize: '13px', lineHeight: '1.7'
                                    }}>
                                        <div style={{ marginBottom: '8px' }}>
                                            <span style={{ fontWeight: '600', color: '#555' }}>Poruka: </span>
                                            <span style={{ color: '#333' }}>{log.message}</span>
                                        </div>
                                        {log.error && (
                                            <div style={{
                                                padding: '8px 12px', background: '#fef2f2',
                                                borderRadius: '6px', color: '#dc3545',
                                                fontSize: '12px'
                                            }}>
                                                ❌ Greška: {log.error}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* ═══ Transaction History ═══ */}
            <div style={{
                background: 'white', borderRadius: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                overflow: 'hidden'
            }}>
                <div
                    onClick={() => setShowTransactions(!showTransactions)}
                    style={{
                        padding: '16px 20px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer', borderBottom: showTransactions ? '1px solid #f0f0f0' : 'none'
                    }}
                >
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#1a1a2e', fontWeight: '600' }}>
                        💰 Povijest transakcija
                    </h3>
                    <span style={{
                        transform: showTransactions ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s', fontSize: '12px', color: '#888'
                    }}>
                        ▼
                    </span>
                </div>

                {showTransactions && (
                    <>
                        {/* Table header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '160px 1fr 100px 120px',
                            padding: '10px 20px',
                            background: '#fafbfc',
                            borderBottom: '1px solid #f0f0f0',
                            fontSize: '12px', fontWeight: '600', color: '#888',
                            textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>
                            <span>Datum</span>
                            <span>Opis</span>
                            <span style={{ textAlign: 'right' }}>Iznos</span>
                            <span style={{ textAlign: 'right' }}>Stanje nakon</span>
                        </div>

                        {MOCK_TRANSACTIONS.map(tx => {
                            const color = tx.type === 'purchase' ? '#198754'
                                        : tx.type === 'refund' ? '#0d6efd'
                                        : '#dc3545';
                            return (
                                <div key={tx.id} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '160px 1fr 100px 120px',
                                    padding: '12px 20px',
                                    borderBottom: '1px solid #f7f7f7',
                                    fontSize: '14px', alignItems: 'center'
                                }}>
                                    <span style={{ color: '#555', fontSize: '13px' }}>{tx.date}</span>
                                    <span style={{ color: '#1a1a2e' }}>{tx.description}</span>
                                    <span style={{ textAlign: 'right', fontWeight: '700', color }}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                                    </span>
                                    <span style={{ textAlign: 'right', color: '#888', fontWeight: '500' }}>
                                        {tx.balance} kr.
                                    </span>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Shared Styles ──────────────────────────────────────────

const filterSelectStyle = {
    padding: '7px 12px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '13px',
    background: 'white',
    color: '#333',
    outline: 'none',
    cursor: 'pointer'
};

export default LogsAndBilling;
