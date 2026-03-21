import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { api } from '../../../api/client';
import { toast } from 'sonner';
import React from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────
const PERIODS = [
  { key: '30d',   label: '30 dana' },
  { key: 'week',  label: 'Ovaj tjedan' },
  { key: 'month', label: 'Ovaj mjesec' },
  { key: 'today', label: 'Danas' },
];

// DOW labels — MySQL DAYOFWEEK: 1=Sun,2=Mon,...,7=Sat
const DOW_LABELS = ['', 'Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const CHART_COLORS = {
  primary:   '#0d6efd',
  success:   '#039855',
  danger:    '#d92d20',
  warning:   '#f79009',
  completed: '#039855',
  cancelled: '#667085',
  no_show:   '#d92d20',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtCurrency = (n) =>
  `${(n || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const fmtShortDate = (d) =>
  new Date(d).toLocaleDateString('hr-HR', { day: 'numeric', month: 'short' });

function PctBadge({ pct }) {
  if (pct === null || pct === undefined) return <span className="an-kpi-change flat">—</span>;
  const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return (
    <span className={`an-kpi-change ${cls}`}>
      {pct > 0 ? '↑' : pct < 0 ? '↓' : '→'} {Math.abs(pct)}%
    </span>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="an-empty">
      <div className="an-empty-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
        </svg>
      </div>
      <div className="an-empty-title">Još nema dovoljno podataka</div>
      <div className="an-empty-body">
        Prihodi i statistike prikazat će se nakon prvih završenih termina.
        Dovršite nekoliko termina i podaci će se automatski pojaviti ovdje.
      </div>
    </div>
  );
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
function Heatmap({ data }) {
  // Build lookup: "dow-hour" → count
  const lookup = useMemo(() => {
    const m = {};
    let max = 0;
    for (const r of data) {
      const k = `${r.dow}-${r.hour}`;
      m[k] = (m[k] || 0) + r.count;
      if (m[k] > max) max = m[k];
    }
    return { m, max };
  }, [data]);

  const heatLevel = (count) => {
    if (!count || count === 0) return 'heat-0';
    const { max } = lookup;
    if (max === 0) return 'heat-0';
    const pct = count / max;
    if (pct < 0.1) return 'heat-1';
    if (pct < 0.3) return 'heat-2';
    if (pct < 0.5) return 'heat-3';
    if (pct < 0.75) return 'heat-4';
    return 'heat-5';
  };

  // DOW rows: Mon(2) → Sun(1) in that order
  const dowOrder = [2, 3, 4, 5, 6, 7, 1];

  return (
    <div className="an-heatmap-wrap">
      {/* Hour labels */}
      <div className="an-heatmap-hour-labels">
        <div />
        {HOURS.map(h => (
          <div key={h} className="an-heatmap-hour-label">
            {h % 2 === 0 ? `${h}h` : ''}
          </div>
        ))}
      </div>
      {/* Rows */}
      <div className="an-heatmap" style={{ gridTemplateRows: `repeat(${dowOrder.length}, 28px)` }}>
        {dowOrder.map(dow => (
          <div key={dow} className="an-heatmap-row">
            <div className="an-heatmap-label">{DOW_LABELS[dow]}</div>
            {HOURS.map(h => {
              const count = lookup.m[`${dow}-${h}`] || 0;
              return (
                <div
                  key={h}
                  className={`an-heatmap-cell ${heatLevel(count)}`}
                  title={count > 0 ? `${DOW_LABELS[dow]} ${h}:00 — ${count} termina` : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Custom Tooltip (Area / Bar) ──────────────────────────────────────────────
function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #eaecf0', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,.08)'
    }}>
      <div style={{ fontSize: 12, color: '#667085', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#667085' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: '#1d2939' }}>
            {currency ? fmtCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
export default function AnalyticsOverview({ period, businessId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAnalyticsOverview(businessId, period);
      if (res.success) setData(res.data);
    } catch {
      toast.error('Greška pri učitavanju pregleda');
    } finally {
      setLoading(false);
    }
  }, [businessId, period]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="an-spinner-wrap">
        <div className="an-spinner" />
        <div className="an-spin-label">Učitavanje podataka…</div>
      </div>
    );
  }

  if (!data || !data.hasEnoughData) {
    return <EmptyState />;
  }

  const { revenue, pctChange, bookings, avgTicket, completionStats, trend, heatmap, topServices } = data;
  const { total, completed, cancelled, no_show } = completionStats;

  const donutData = [
    { name: 'Završeni',    value: completed, color: CHART_COLORS.completed },
    { name: 'Otkazani',    value: cancelled, color: CHART_COLORS.cancelled },
    { name: 'Nisu došli',  value: no_show,   color: CHART_COLORS.danger    },
  ].filter(d => d.value > 0);

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      {/* KPI cards */}
      <div className="an-kpi-grid">
        <div className="an-kpi-card">
          <div className="an-kpi-label">Ukupni prihod</div>
          <div className="an-kpi-value">{fmtCurrency(revenue)}</div>
          <PctBadge pct={pctChange} />
          <div className="an-kpi-footer">vs. prethodni period</div>
        </div>
        <div className="an-kpi-card">
          <div className="an-kpi-label">Rezervacije</div>
          <div className="an-kpi-value">{bookings}</div>
          <div className="an-kpi-footer">završenih termina</div>
        </div>
        <div className="an-kpi-card">
          <div className="an-kpi-label">Prosj. vrijednost</div>
          <div className="an-kpi-value">{fmtCurrency(avgTicket)}</div>
          <div className="an-kpi-footer">po terminu</div>
        </div>
        <div className="an-kpi-card">
          <div className="an-kpi-label">Stopa završenosti</div>
          <div className="an-kpi-value">{completionRate}%</div>
          <div className="an-kpi-footer">{completed} od {total} termina</div>
        </div>
      </div>

      {/* Revenue trend */}
      <div className="an-card">
        <div className="an-card-header">
          <div>
            <div className="an-card-title">Trend prihoda</div>
            <div className="an-card-subtitle">Dnevni prihod za odabrani period</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trend.map(r => ({ ...r, day: fmtShortDate(r.day) }))}
            margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={CHART_COLORS.primary} stopOpacity={0.18} />
                <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#667085' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#667085' }} tickLine={false} axisLine={false}
              tickFormatter={v => `${v} €`} />
            <Tooltip content={<ChartTooltip currency />} />
            <Area type="monotone" dataKey="revenue" name="Prihod"
              stroke={CHART_COLORS.primary} strokeWidth={2.5}
              fill="url(#revGrad)" dot={false} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 2-col: Completion donut + Top services */}
      <div className="an-2col">
        {/* Donut */}
        <div className="an-card">
          <div className="an-card-header">
            <div>
              <div className="an-card-title">Status termina</div>
              <div className="an-card-subtitle">{total} ukupno</div>
            </div>
          </div>
          <div className="an-donut-wrap">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={52} outerRadius={72}
                  paddingAngle={3} dataKey="value" stroke="none">
                  {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="an-donut-legend">
              {donutData.map((d, i) => (
                <div key={i} className="an-legend-item">
                  <div className="an-legend-dot" style={{ background: d.color }} />
                  <span className="an-legend-label">{d.name}</span>
                  <span className="an-legend-value">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top services */}
        <div className="an-card">
          <div className="an-card-header">
            <div>
              <div className="an-card-title">Top usluge</div>
              <div className="an-card-subtitle">Po prihodu</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topServices} layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v} €`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#1d2939' }} width={100}
                axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip currency />} />
              <Bar dataKey="revenue" name="Prihod" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Heatmap — Wow moment */}
      <div className="an-card">
        <div className="an-card-header">
          <div>
            <div className="an-card-title">Najzaposleniji sati</div>
            <div className="an-card-subtitle">Kada je vaš tim najzaposleniji — temelj za raspoređivanje i promocije</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {['Prazno','Malo','','','','Puno'].map((l, i) => (
              <React.Fragment key={i}>
                <div style={{ width: 18, height: 18, borderRadius: 3, background:
                  ['#f2f4f7','#dbeafe','#93c5fd','#60a5fa','#3b82f6','#1d4ed8'][i] }} />
                {l && <span style={{ fontSize: 10, color: '#667085' }}>{l}</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
        {heatmap.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#667085', padding: '20px 0' }}>
            Nema dovoljno podataka za prikaz
          </div>
        ) : (
          <Heatmap data={heatmap} />
        )}
      </div>
    </>
  );
}
