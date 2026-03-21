import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import { toast } from 'sonner';

const PERIODS = [
  { key: '30d',   label: '30 dana' },
  { key: 'week',  label: 'Ovaj tjedan' },
  { key: 'month', label: 'Ovaj mjesec' },
];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('hr-HR', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
const fmtCurrency = (n) =>
  `${(n || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function EmptyState() {
  return (
    <div className="an-empty">
      <div className="an-empty-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div className="an-empty-title">Nema dovoljno podataka o klijentima</div>
      <div className="an-empty-body">
        Statistike klijenata prikazat će se nakon prvih završenih termina.
      </div>
    </div>
  );
}

function RiskLevelBadge({ daysSince, avgInterval }) {
  if (!avgInterval) return null;
  const ratio = daysSince / avgInterval;
  if (ratio >= 3)    return <span className="an-badge an-badge-danger">Visok rizik</span>;
  if (ratio >= 2)    return <span className="an-badge an-badge-warning">Srednji rizik</span>;
  return               <span className="an-badge an-badge-primary">Blag rizik</span>;
}

export default function AnalyticsClients({ businessId }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30d');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAnalyticsClients(businessId, period);
      if (res.success) setData(res.data);
    } catch {
      toast.error('Greška pri učitavanju podataka o klijentima');
    } finally {
      setLoading(false);
    }
  }, [businessId, period]);

  useEffect(() => { load(); }, [load]);

  // Navigate to pre-filled campaign creation for a specific client
  const handleSendMessage = (client) => {
    // Store client in sessionStorage, Campaign wizard will pick it up
    sessionStorage.setItem('prefillClient', JSON.stringify({
      id: client.id, name: client.name, phone: client.phone
    }));
    navigate('/marketing/campaigns/new?source=analytics');
  };

  if (loading) {
    return (
      <div className="an-spinner-wrap">
        <div className="an-spinner" />
        <div className="an-spin-label">Učitavanje podataka o klijentima…</div>
      </div>
    );
  }

  if (!data || !data.hasEnoughData) return <EmptyState />;

  const { retentionRate, noShowRate, newVsReturning, topClients, atRiskClients } = data;

  return (
    <>
      {/* Period picker */}
      <div className="an-period-row">
        {PERIODS.map(p => (
          <button key={p.key} className={`an-period-btn ${period === p.key ? 'active' : ''}`}
            onClick={() => setPeriod(p.key)}>{p.label}</button>
        ))}
      </div>

      {/* KPI row */}
      <div className="an-kpi-grid">
        <div className="an-kpi-card">
          <div className="an-kpi-label">Stopa zadržavanja</div>
          <div className="an-kpi-value" style={{ color: retentionRate >= 60 ? '#039855' : retentionRate >= 40 ? '#b45309' : '#d92d20' }}>
            {retentionRate !== null ? `${retentionRate}%` : '—'}
          </div>
          <div className="an-kpi-footer">klijenata se vraća</div>
        </div>
        <div className="an-kpi-card">
          <div className="an-kpi-label">Klijenti u riziku</div>
          <div className="an-kpi-value" style={{ color: atRiskClients.length > 0 ? '#d92d20' : '#039855' }}>
            {atRiskClients.length}
          </div>
          <div className="an-kpi-footer">dugo nisu bili</div>
        </div>
        <div className="an-kpi-card">
          <div className="an-kpi-label">Stopa no-show</div>
          <div className="an-kpi-value">{noShowRate}%</div>
          <div className="an-kpi-footer">nisu se pojavili</div>
        </div>
      </div>

      {/* New vs Returning chart */}
      <div className="an-card">
        <div className="an-card-header">
          <div>
            <div className="an-card-title">Novi vs. povratni klijenti</div>
            <div className="an-card-subtitle">Trend zadnjih 6 mjeseci</div>
          </div>
        </div>
        {newVsReturning.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#667085', padding: '20px 0' }}>Nema podataka</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={newVsReturning} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="newGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d6efd" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#0d6efd" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#039855" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#039855" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#667085' }} tickLine={false} axisLine={false}
                tickFormatter={v => v?.slice?.(5) || v} />
              <YAxis tick={{ fontSize: 11, fill: '#667085' }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />
              <Area type="monotone" dataKey="newClients" name="Novi" stroke="#0d6efd" strokeWidth={2}
                fill="url(#newGrad)" dot={false} />
              <Area type="monotone" dataKey="returningClients" name="Povratni" stroke="#039855" strokeWidth={2}
                fill="url(#retGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 2-col: Top clients + At-risk */}
      <div className="an-2col">
        {/* Top clients */}
        <div className="an-card">
          <div className="an-card-header">
            <div>
              <div className="an-card-title">Top klijenti</div>
              <div className="an-card-subtitle">Po ukupnom prihodu</div>
            </div>
          </div>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>Klijent</th>
                  <th style={{ textAlign: 'right' }}>Prihod</th>
                  <th style={{ textAlign: 'right' }}>Posjeta</th>
                  <th style={{ textAlign: 'right' }}>Zadnji</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: '#eff6ff', color: '#0d6efd',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, flexShrink: 0
                        }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: '#667085' }}>{c.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#039855' }}>
                      {fmtCurrency(c.totalRevenue)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#667085' }}>{c.totalVisits}</td>
                    <td style={{ textAlign: 'right', color: '#667085', fontSize: 13 }}>
                      {fmtDate(c.lastVisit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* At-risk clients */}
        <div className="an-card">
          <div className="an-card-header">
            <div>
              <div className="an-card-title">Klijenti u riziku</div>
              <div className="an-card-subtitle">Dugo nisu bili — pošaljite im poruku</div>
            </div>
            {atRiskClients.length > 0 && (
              <span className="an-badge an-badge-danger">{atRiskClients.length}</span>
            )}
          </div>
          {atRiskClients.length === 0 ? (
            <div className="an-empty" style={{ padding: '24px 0' }}>
              <div className="an-empty-title" style={{ fontSize: 15 }}>Odlično! Nema klijenata u riziku</div>
              <div className="an-empty-body">Svi redoviti klijenti su se nedavno javili.</div>
            </div>
          ) : (
            <div className="an-table-wrap">
              <table className="an-table">
                <thead>
                  <tr>
                    <th>Klijent</th>
                    <th>Rizik</th>
                    <th style={{ textAlign: 'right' }}>Dana</th>
                    <th style={{ textAlign: 'right' }}>Ciklus</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {atRiskClients.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: '#667085' }}>{c.phone}</div>
                      </td>
                      <td>
                        <RiskLevelBadge daysSince={c.daysSinceLast} avgInterval={c.avgIntervalDays} />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#d92d20' }}>
                        {c.daysSinceLast}d
                      </td>
                      <td style={{ textAlign: 'right', color: '#667085' }}>
                        {c.avgIntervalDays ? `~${c.avgIntervalDays}d` : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="an-btn-sm primary"
                          onClick={() => handleSendMessage(c)}
                          title="Pošalji poruku ovom klijentu"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                          Pošalji poruku
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
