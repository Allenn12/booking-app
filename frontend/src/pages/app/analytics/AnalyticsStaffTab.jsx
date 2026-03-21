import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Chart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { apexChartsTheme } from '@/lib/apexcharts-theme';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  BarChart3, 
  UserCheck,
  ChevronRight,
  CalendarCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Formatter Helpers ---
const fmtCurrency = (n) =>
  `${(n || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const COLORS = ['#0d6efd','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];

// --- Sub-component for Utilization Progress ---
function UtilizationProgress({ pct }) {
  const isHigh = pct >= 75;
  const isMedium = pct >= 40 && pct < 75;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-muted-foreground">
        <span>Iskorištenost</span>
        <span className={cn(
          isHigh ? "text-emerald-600" : isMedium ? "text-amber-600" : "text-rose-600"
        )}>{pct}%</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            isHigh ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : 
            isMedium ? "bg-amber-500" : "bg-rose-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// --- Empty State ---
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed rounded-3xl bg-muted/20">
      <div className="p-4 bg-primary/10 rounded-2xl text-primary mb-6">
        <UserCheck className="h-10 w-10" />
      </div>
      <h3 className="text-xl font-bold">Tim još nema zabilježenih termina</h3>
      <p className="text-muted-foreground max-w-sm mt-2 text-sm">
        Ovdje će se prikazati detaljne performanse vašeg tima čim krenu prvi završeni termini.
      </p>
    </div>
  );
}

export default function AnalyticsStaffTab({ businessId }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
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

  // --- Chart Configs ---
  const trendByStaffConfig = useMemo(() => {
    if (!data || !data.trendByMonth?.length || !data.staffNames?.length) return null;

    return {
      series: data.staffNames.map(name => ({
        name: name,
        data: data.trendByMonth.map(m => m[name] || 0)
      })),
      options: {
        ...apexChartsTheme.options,
        chart: {
          ...apexChartsTheme.options.chart,
          type: 'bar',
          stacked: true,
          toolbar: { show: false }
        },
        plotOptions: {
          bar: {
            borderRadius: 6,
            columnWidth: '40%'
          }
        },
        dataLabels: { enabled: false },
        xaxis: {
          ...apexChartsTheme.options.xaxis,
          categories: data.trendByMonth.map(m => m.month.slice(5)),
          labels: { style: { colors: '#64748b' } }
        },
        yaxis: {
          ...apexChartsTheme.options.yaxis,
          labels: {
            formatter: (val) => `${val}€`,
            style: { colors: '#64748b' }
          }
        },
        colors: COLORS,
        legend: {
          position: 'top',
          horizontalAlign: 'right',
          markers: { radius: 12 },
          fontWeight: 700,
          labels: { colors: '#334155' }
        },
        fill: { opacity: 0.9 }
      }
    };
  }, [data]);

  const utilizationConfig = useMemo(() => {
    if (!data || !data.staff?.length) return null;

    return {
      series: [{
        name: 'Iskorištenost',
        data: data.staff.map(s => s.utilizationPct)
      }],
      options: {
        ...apexChartsTheme.options,
        chart: { type: 'bar', toolbar: { show: false } },
        plotOptions: {
          bar: {
            borderRadius: 8,
            horizontal: true,
            barHeight: '35%',
            distributed: true,
            colors: {
              ranges: [
                { from: 0, to: 40, color: '#ef4444' }, // low
                { from: 41, to: 75, color: '#f59e0b' }, // med
                { from: 76, to: 100, color: '#10b981' } // high
              ]
            }
          }
        },
        xaxis: {
           ...apexChartsTheme.options.xaxis,
           categories: data.staff.map(s => s.name.split(' ')[0]),
           labels: { formatter: (val) => `${val}%`, show: false }
        },
        grid: { show: false },
        legend: { show: false },
        dataLabels: {
          enabled: true,
          textAnchor: 'end',
          formatter: (val, opt) => `${opt.w.globals.labels[opt.dataPointIndex]}: ${val}%`,
          offsetY: -20,
          style: { fontSize: '11px', fontWeight: '900', colors: ['#1e293b'] }
        }
      }
    };
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-[400px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[1,2,3].map(i => <Skeleton key={i} className="h-[200px] w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!data?.hasEnoughData) return <EmptyState />;

  const totalRevenue = data.staff.reduce((s, x) => s + x.revenue, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Date Range Picker Local */}
      <div className="flex bg-muted/20 border border-slate-200/60 p-1.5 rounded-2xl w-fit self-end">
        {[
          { key: '30d', label: 'Zadnjih 30 dana' },
          { key: 'week', label: 'Tjedan' },
          { key: 'month', label: 'Mjesec' }
        ].map(p => (
          <button 
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
              period === p.key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Card className="shadow-sm border-none bg-card">
         <CardHeader>
           <CardTitle className="text-xl font-bold flex items-center gap-2">
             Trend doprinosa po djelatniku
             <BarChart3 className="h-5 w-5 text-primary" />
           </CardTitle>
           <CardDescription>Prikaz mjesečnog prihoda razvrstanog po članovima tima.</CardDescription>
         </CardHeader>
         <CardContent className="pt-2">
           {trendByStaffConfig && (
             <Chart 
               options={trendByStaffConfig.options}
               series={trendByStaffConfig.series}
               type="bar"
               height={320}
             />
           )}
         </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Utilization Ranking */}
        <Card className="shadow-sm border-none bg-card">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              Rang Iskorištenosti
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </CardTitle>
            <CardDescription>Usporedni prikaz popunjenosti kapaciteta tima.</CardDescription>
          </CardHeader>
          <CardContent>
            {utilizationConfig && (
              <Chart 
                options={utilizationConfig.options}
                series={utilizationConfig.series}
                type="bar"
                height={260}
              />
            )}
          </CardContent>
        </Card>

        {/* Small KPIS / Top Performer Highlight */}
        <div className="space-y-6">
           {data.staff.slice(0, 3).map((s, idx) => (
              <Card key={s.id} className="shadow-sm border-none bg-card group overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div 
                        className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-black text-lg relative group-hover:rotate-6 transition-transform duration-300"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      >
                         {s.name.charAt(0)}
                      </div>
                      <div className="space-y-0.5">
                         <h4 className="font-black text-sm text-foreground">{s.name}</h4>
                         <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{s.completed} termina odrađeno</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-lg font-black text-foreground">{fmtCurrency(s.revenue)}</p>
                      <p className="text-[10px] uppercase font-medium text-muted-foreground">{Math.round((s.revenue / totalRevenue) * 100)}% Udio u ukupnom</p>
                   </div>
                </CardContent>
                <div className="h-1 w-full bg-slate-50">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000" 
                    style={{ 
                      width: `${s.utilizationPct}%`,
                      backgroundColor: COLORS[idx % COLORS.length]
                    }} 
                  />
                </div>
              </Card>
           ))}
        </div>
      </div>

      {/* Detailed Team Table */}
      <Card className="shadow-sm border-none bg-card overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Detaljni učinak tima</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/30 border-y">
                   <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap">Djelatnik</th>
                   <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap text-right">Prihod</th>
                   <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap text-right">Prosj. Račun</th>
                   <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap text-right">No-Show</th>
                   <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap">Iskorištenost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.staff.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="flex flex-col">
                            <span className="text-sm font-bold">{s.name}</span>
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">{s.completed} termina</span>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <span className="text-sm font-black text-foreground">{fmtCurrency(s.revenue)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <span className="text-sm font-medium text-muted-foreground">{fmtCurrency(s.avgTicket)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <Badge variant="outline" className={cn(
                         "border-none font-bold text-xs px-2",
                         s.noShowRate > 15 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"
                       )}>
                         {s.noShowRate}%
                       </Badge>
                    </td>
                    <td className="px-6 py-4 min-w-[180px]">
                      <UtilizationProgress pct={s.utilizationPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Actionable Footer */}
      <div className="flex items-center justify-between bg-primary/5 p-6 rounded-3xl border border-primary/10">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-white rounded-2xl shadow-sm shadow-primary/10">
             <CalendarCheck className="h-6 w-6 text-primary" />
           </div>
           <div>
              <h4 className="font-black text-foreground">Želite povećati popunjenost tima?</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">Pokrenite kampanju za popunjavanje slobodnih rupa u kalendaru.</p>
           </div>
        </div>
        <Button onClick={() => navigate('/marketing/campaigns/new')} className="gap-2 font-black uppercase text-xs tracking-widest px-8">
           Kreiraj Kampanju <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
