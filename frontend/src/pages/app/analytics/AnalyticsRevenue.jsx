import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { api } from '../../../api/client';
import { toast } from 'sonner';

const fmtCurrency = (n) =>
  `${(n || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const PERIODS = [
  { key: '30d',  label: '30 dana' },
  { key: 'week', label: 'Ovaj tjedan' },
  { key: 'month', label: 'Ovaj mjesec' },
];

const GROUP_BY = [
  { key: 'day',   label: 'Dan' },
  { key: 'week',  label: 'Tjedan' },
  { key: 'month', label: 'Mjesec' },
];

const DOW_SORTED = ['', 'Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1px solid #eaecf0', borderRadius:8,
      padding:'10px 14px', boxShadow:'0 4px 12px rgba(0,0,0,.08)' }}>
      <div style={{ fontSize:12, color:'#667085', marginBottom:6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:'flex', gap:8, fontSize:14, alignItems:'center' }}>
          <span style={{ width:8,height:8,borderRadius:'50%',background:p.color,display:'inline-block' }} />
          <span style={{ color:'#667085' }}>{p.name}:</span>
          <span style={{ fontWeight:600, color:'#1d2939' }}>{fmtCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PctBadge({ pct }) {
  if (pct === null || pct === undefined) return <span className="an-kpi-change flat">—</span>;
  const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return (
    <span className={`an-kpi-change ${cls}`}>
      {pct > 0 ? '↑' : pct < 0 ? '↓' : '→'} {Math.abs(pct)}%
    </span>
  );
}

function EmptyState() {
  return (
    <div className="an-empty">
      <div className="an-empty-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      </div>
      <div className="an-empty-title">Nema dovoljno podataka</div>
      <div className="an-empty-body">
        Prihodi će se prikazati nakon prvih završenih termina s postavljenim cijenama usluga.
      </div>
    </div>
  );
}

export default function AnalyticsRevenue({ businessId }) {
  const [period, setPeriod]   = useState('30d');
  const [groupBy, setGroupBy] = useState('day');
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId]     = useState('');
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = { period, groupBy };
      if (serviceId) params.service_id = serviceId;
      if (staffId)   params.staff_id   = staffId;
      const res = await api.getAnalyticsRevenue(businessId, params);
      if (res.success) setData(res.data);
    } catch {
      toast.error('Greška pri učitavanju prihoda');
    } finally {
      setLoading(false);
    }
  }, [businessId, period, groupBy, serviceId, staffId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="an-spinner-wrap">
        <div className="an-spinner" />
        <div className="an-spin-label">Učitavanje prihoda…</div>
      </div>
    );
  }

  if (!data || !data.hasEnoughData) return <EmptyState />;

  const { summary, trend, byService, byDow, filters } = data;

  // Sort byDow in Mon–Sun order
  const dowSorted = [...(byDow || [])].sort((a, b) => {
    const order = [2,3,4,5,6,7,1];
    return order.indexOf(a.dow) - order.indexOf(b.dow);
  }).map(r => ({ ...r, label: DOW_SORTED[r.dow] }));

  return (
    <>
      {/* Period & groupBy controls */}
      <div className="an-period-row">
        {PERIODS.map(p => (
          <button key={p.key} className={`an-period-btn ${period === p.key ? 'active' : ''}`}
            onClick={() => setPeriod(p.key)}>{p.label}</button>
        ))}
        <span style={{ marginLeft: 8, fontSize: 13, color: '#667085' }}>Grupiraj:</span>
        {GROUP_BY.map(g => (
          <button key={g.key} className={`an-period-btn ${groupBy === g.key ? 'active' : ''}`}
            onClick={() => setGroupBy(g.key)}>{g.label}</button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="an-filter-bar">
        <span className="an-filter-label">Filtriraj:</span>
        <select value={serviceId} onChange={e => setServiceId(e.target.value)}>
          <option value="">Sve usluge</option>
          {filters?.services?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={staffId} onChange={e => setStaffId(e.target.value)}>
          <option value="">Svi djelatnici</option>
          {filters?.staff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="an-kpi-grid">
        <div className="an-kpi-card">
          <div className="an-kpi-label">Ukupni prihod</div>
          <div className="an-kpi-value">{fmtCurrency(summary.revenue)}</div>
          <PctBadge pct={summary.pctChange} />
        </div>
        <div className="an-kpi-card">
          <div className="an-kpi-label">Rezervacije</div>
          <div className="an-kpi-value">{summary.bookings}</div>
        </div>
        <div className="an-kpi-card">
          <div className="an-kpi-label">Prosj. račun</div>
          <div className="an-kpi-value">{fmtCurrency(summary.avgTicket)}</div>
        </div>
      </div>

      {/* Revenue trend */}
      <div className="an-card">
        <div className="an-card-header">
          <div>
            <div className="an-card-title">Trend prihoda</div>
            <div className="an-card-subtitle">Prihod po {groupBy === 'day' ? 'danima' : groupBy === 'week' ? 'tjednima' : 'mjesecima'}</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={trend} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#667085' }} tickLine={false} axisLine={false}
              tickFormatter={v => v?.slice?.(5) || v} />
            <YAxis tick={{ fontSize: 11, fill: '#667085' }} tickLine={false} axisLine={false}
              tickFormatter={v => `${v} €`} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="revenue" name="Prihod" fill="#0d6efd" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2-col: by service + by day-of-week */}
      <div className="an-2col">
        {/* By DoW */}
        <div className="an-card">
          <div className="an-card-header">
            <div>
              <div className="an-card-title">Prihod po danu</div>
              <div className="an-card-subtitle">Koji dani donose najviše</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dowSorted} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#667085' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#667085' }} tickLine={false} axisLine={false}
                tickFormatter={v => `${v} €`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="revenue" name="Prihod" fill="#0d6efd" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By service table */}
        <div className="an-card">
          <div className="an-card-header">
            <div>
              <div className="an-card-title">Prihod po usluzi</div>
              <div className="an-card-subtitle">Sortirano po prihodu</div>
            </div>
          </div>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>Usluga</th>
                  <th style={{ textAlign: 'right' }}>Prihod</th>
                  <th style={{ textAlign: 'right' }}>Br.</th>
                  <th style={{ textAlign: 'right' }}>Prosj.</th>
                </tr>
              </thead>
              <tbody>
                {byService.slice(0, 8).map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#039855' }}>
                      {fmtCurrency(s.revenue)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#667085' }}>{s.bookings}</td>
                    <td style={{ textAlign: 'right', color: '#667085' }}>{fmtCurrency(s.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
