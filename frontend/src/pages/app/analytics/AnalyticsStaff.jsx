import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { api } from '../../../api/client';
import { toast } from 'sonner';

const PERIODS = [
  { key: '30d',   label: '30 dana' },
  { key: 'week',  label: 'Ovaj tjedan' },
  { key: 'month', label: 'Ovaj mjesec' },
];

const fmtCurrency = (n) =>
  `${(n || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const COLORS = ['#0d6efd','#039855','#f79009','#7c3aed','#d92d20','#0ea5e9'];

function EmptyState() {
  return (
    <div className="an-empty">
      <div className="an-empty-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div className="an-empty-title">Nema podataka o timu</div>
      <div className="an-empty-body">
        Statistike tima prikazat će se kada djelatnici imaju završene termine.
      </div>
    </div>
  );
}

function UtilBar({ pct }) {
  const cls = pct >= 70 ? 'high' : pct < 25 ? 'low' : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className="an-util-bar" style={{ flex: 1 }}>
        <div className={`an-util-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1d2939', width: 36, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
}

export default function AnalyticsStaff({ businessId }) {
  const [period, setPeriod] = useState('30d');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAnalyticsStaff(businessId, period);
      if (res.success) setData(res.data);
    } catch {
      toast.error('Greška pri učitavanju podataka o timu');
    } finally {
      setLoading(false);
    }
  }, [businessId, period]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="an-spinner-wrap">
        <div className="an-spinner" />
        <div className="an-spin-label">Učitavanje podataka o timu…</div>
      </div>
    );
  }

  if (!data || !data.hasEnoughData) return <EmptyState />;

  const { staff, staffNames, trendByMonth } = data;
  const totalRevenue = staff.reduce((s, x) => s + x.revenue, 0);

  return (
    <>
      {/* Period picker */}
      <div className="an-period-row">
        {PERIODS.map(p => (
          <button key={p.key} className={`an-period-btn ${period === p.key ? 'active' : ''}`}
            onClick={() => setPeriod(p.key)}>{p.label}</button>
        ))}
      </div>

      {/* Staff Performance Table */}
      <div className="an-card">
        <div className="an-card-header">
          <div>
            <div className="an-card-title">Performanse tima</div>
            <div className="an-card-subtitle">Sortirano po prihodu</div>
          </div>
        </div>
        <div className="an-table-wrap">
          <table className="an-table">
            <thead>
              <tr>
                <th>Djelatnik</th>
                <th style={{ textAlign: 'right' }}>Prihod</th>
                <th style={{ textAlign: 'right' }}>Termin.</th>
                <th style={{ textAlign: 'right' }}>Prosj.</th>
                <th style={{ textAlign: 'right' }}>No-show</th>
                <th style={{ minWidth: 180 }}>Iskorištenost</th>
                <th style={{ textAlign: 'right' }}>Udio</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s, i) => {
                const share = totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 100) : 0;
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: `${COLORS[i % COLORS.length]}20`,
                          color: COLORS[i % COLORS.length],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, flexShrink: 0
                        }}>
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{s.name}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#039855' }}>
                      {fmtCurrency(s.revenue)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{s.completed}</td>
                    <td style={{ textAlign: 'right', color: '#667085' }}>
                      {fmtCurrency(s.avgTicket)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {s.noShowRate > 0 ? (
                        <span style={{ color: '#d92d20', fontWeight: 600 }}>{s.noShowRate}%</span>
                      ) : (
                        <span style={{ color: '#039855' }}>0%</span>
                      )}
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <UtilBar pct={s.utilizationPct} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`an-badge ${share >= 30 ? 'an-badge-primary' : 'an-badge-success'}`}>
                        {share}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue trend per staff */}
      {trendByMonth.length > 0 && staffNames.length > 0 && (
        <div className="an-card">
          <div className="an-card-header">
            <div>
              <div className="an-card-title">Trend prihoda po djelatniku</div>
              <div className="an-card-subtitle">Zadnjih 6 mjeseci</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendByMonth} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#667085' }} tickLine={false} axisLine={false}
                tickFormatter={v => v?.slice?.(5) || v} />
              <YAxis tick={{ fontSize: 11, fill: '#667085' }} tickLine={false} axisLine={false}
                tickFormatter={v => `${v} €`} />
              <Tooltip
                formatter={(v, n) => [fmtCurrency(v), n]}
                contentStyle={{ border: '1px solid #eaecf0', borderRadius: 8 }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />
              {staffNames.map((name, i) => (
                <Bar key={name} dataKey={name} name={name}
                  fill={COLORS[i % COLORS.length]} radius={[3,3,0,0]} stackId="a" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Utilization summary */}
      <div className="an-card">
        <div className="an-card-header">
          <div>
            <div className="an-card-title">Iskorištenost kapaciteta</div>
            <div className="an-card-subtitle">Postotak radnog vremena koji je rezerviran</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {staff.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 140, fontWeight: 500, fontSize: 14 }}>{s.name}</div>
              <div style={{ flex: 1 }}>
                <UtilBar pct={s.utilizationPct} />
              </div>
              <div style={{ fontSize: 13, color: '#667085', width: 80, textAlign: 'right' }}>
                {Math.round(s.bookedMinutes / 60)}h rezervirano
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
