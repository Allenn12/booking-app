import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Chart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { apexChartsTheme } from '@/lib/apexcharts-theme';
import { formatChartDate } from '@/lib/chart-utils';
import { 
  BarChart2, 
  TrendingUp, 
  TrendingDown, 
  Filter,
  Euro,
  Settings2,
  PieChart as PieChartIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Formatter Helpers ---
const fmtCurrency = (n) =>
  `${(n || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const GROUP_BY = [
  { key: 'day',   label: 'Dan' },
  { key: 'week',  label: 'Tjedan' },
  { key: 'month', label: 'Mjesec' },
];

const DOW_SORTED = ['', 'Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

export default function AnalyticsRevenueTab({ businessId, period }) {
  const [groupBy, setGroupBy] = useState('day');
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId]     = useState('');
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);

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

  // --- Chart Configs ---
  const revenueTrendConfig = useMemo(() => {
    if (!data || !data.trend?.length) return null;
    
    const trendData = data.trend;
    const maxValue = Math.max(...trendData.map(r => r.revenue));

    const getColumnWidth = (len) => {
      if (len <= 3)  return '25%';
      if (len <= 7)  return '45%';
      if (len <= 15) return '60%';
      return '70%';
    };

    return {
      series: [{
        name: 'Prihod',
        data: trendData.map(r => ({
          x: formatChartDate(r.period, groupBy),
          y: r.revenue,
          fillColor: (r.revenue === maxValue && maxValue > 0) ? '#3B82F6' : '#3B82F6BF'
        }))
      }],
      options: {
        ...apexChartsTheme.options,
        chart: {
          ...apexChartsTheme.options.chart,
          type: 'bar',
          toolbar: { show: false }
        },
        legend: { show: false },
        dataLabels: { enabled: false },
        plotOptions: {
          bar: {
            borderRadius: 6,
            borderRadiusApplication: 'end',
            borderRadiusWhenStacked: 'last',
            columnWidth: getColumnWidth(trendData.length),
            distributed: false
          }
        },
        xaxis: {
          ...apexChartsTheme.options.xaxis,
          tickAmount: trendData.length <= 7 ? undefined : 5,
          axisBorder: { show: false },
          labels: {
            rotate: 0,
            style: { 
              colors: '#64748b', 
              fontSize: '10px',
              fontFamily: 'inherit'
            }
          }
        },
        yaxis: {
          ...apexChartsTheme.options.yaxis,
          labels: {
            formatter: (val) => `${Math.round(val)}€`,
            style: { colors: '#64748b' }
          }
        },
        grid: {
          show: true,
          borderColor: 'rgba(148, 163, 184, 0.1)',
          xaxis: { lines: { show: false } },
          yaxis: { lines: { show: true } }
        },
        tooltip: {
          custom: ({ series, seriesIndex, dataPointIndex, w }) => {
            const value = series[seriesIndex][dataPointIndex];
            const label = w.globals.labels[dataPointIndex];
            return `
              <div style="
                background: #1e293b;
                color: white;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                border: none;
              ">
                <div style="color: #94a3b8; margin-bottom: 2px">${label}</div>
                <div>${value.toFixed(2).replace('.', ',')} €</div>
              </div>
            `;
          }
        },
        fill: {
          type: 'solid',
          opacity: 1 
        }
      }
    };
  }, [data, groupBy]);

  const dowConfig = useMemo(() => {
    if (!data || !data.byDow) return null;

    const sortedDoc = [...data.byDow].sort((a, b) => {
      const order = [2,3,4,5,6,7,1];
      return order.indexOf(a.dow) - order.indexOf(b.dow);
    });

    return {
      series: [{
        name: 'Prihod',
        data: sortedDoc.map(r => r.revenue.toFixed(2))
      }],
      options: {
        ...apexChartsTheme.options,
        chart: {
           ...apexChartsTheme.options.chart,
           type: 'bar',
           toolbar: { show: false }
        },
        plotOptions: {
          bar: {
            borderRadius: 8,
            horizontal: true,
            barHeight: '60%'
          }
        },
        xaxis: {
           ...apexChartsTheme.options.xaxis,
           categories: sortedDoc.map(r => DOW_SORTED[r.dow]),
           labels: {
             formatter: (val) => `${val}€`,
             style: { colors: '#64748b' }
           }
        },
        colors: [apexChartsTheme.colors.emerald],
        grid: { show: false }
      }
    };
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[400px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] w-full rounded-2xl" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data?.hasEnoughData) {
     return (
       <div className="py-20 text-center border-2 border-dashed rounded-3xl bg-muted/20">
         <Euro className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
         <h3 className="text-lg font-bold">Nema dovoljno podataka za detaljnu analizu prihoda</h3>
         <p className="text-muted-foreground text-sm mt-1">Dovršite više termina s cijenama usluga.</p>
       </div>
     );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Controls / Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/20 p-4 rounded-2xl border border-border/50">
        <div className="flex items-center gap-3">
          <div className="flex bg-card border rounded-lg p-1 shadow-sm">
            {GROUP_BY.map((g) => (
              <button
                key={g.key}
                onClick={() => setGroupBy(g.key)}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                  groupBy === g.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Settings2 className="h-3 w-3" /> Grupiranje
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
             <select 
               value={serviceId} 
               onChange={e => setServiceId(e.target.value)}
               className="bg-card border rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
             >
               <option value="">Sve Usluge</option>
               {data.filters?.services?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
          </div>
          <div className="flex items-center gap-2">
             <select 
               value={staffId} 
               onChange={e => setStaffId(e.target.value)}
               className="bg-card border rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
             >
               <option value="">Svi Djelatnici</option>
               {data.filters?.staff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
          </div>
        </div>
      </div>

      {/* Primary Trend Chart */}
      <Card className="shadow-sm border-none bg-card">
        <CardHeader>
           <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  Struktura Prihoda
                  <BarChart2 className="h-5 w-5 text-primary" />
                </CardTitle>
                <CardDescription>Prikaz rasta prihoda po odabranom grupiranju.</CardDescription>
              </div>
              <div className="flex items-center gap-6 border rounded-xl px-5 py-2.5 bg-muted/10">
                <div className="text-right">
                  <p className="text-2xl font-black text-foreground">{fmtCurrency(data.summary.avgTicket)}</p>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Prosječni račun</p>
                </div>
                <div className="w-px h-10 bg-border"></div>
                <div className="text-right">
                  <p className="text-2xl font-black text-emerald-600">{fmtCurrency(data.summary.revenue)}</p>
                  <p className="text-[10px] uppercase font-bold text-emerald-600/70 tracking-wider">Ukupno u periodu</p>
                </div>
              </div>
           </div>
        </CardHeader>
        <CardContent className="pt-2">
           {!data.trend?.length ? (
             <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/5 rounded-xl border border-dashed border-muted/20 m-6">
               <BarChart2 className="h-12 w-12 mb-4 opacity-30" />
               <p className="text-sm font-medium">Nema podataka o prihodima za ovaj period</p>
               <p className="text-xs opacity-70 mt-1">Pokušajte promijeniti filtere ili period pretraživanja</p>
             </div>
           ) : (
             <Chart 
               options={revenueTrendConfig.options}
               series={revenueTrendConfig.series}
               type="bar"
               height={320}
             />
           )}
        </CardContent>
      </Card>

      {/* Secondary breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* By Day of Week - Horizontal Bar */}
        <Card className="shadow-sm border-none bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Učinak po danima</CardTitle>
            <CardDescription>Koji dani su najprofitabilniji?</CardDescription>
          </CardHeader>
          <CardContent>
            {dowConfig && (
              <Chart 
                options={dowConfig.options}
                series={dowConfig.series}
                type="bar"
                height={260}
              />
            )}
          </CardContent>
        </Card>

        {/* Top Services Table */}
        <Card className="shadow-sm border-none bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-6">
            <CardTitle className="text-lg font-bold">Učinak po uslugama</CardTitle>
            <PieChartIcon className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0">
             <div className="w-full overflow-hidden">
               <table className="w-full text-left">
                 <thead>
                   <tr className="border-b bg-muted/10">
                     <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Usluga</th>
                     <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider text-right">Prihod</th>
                     <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider text-right">Br.</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {data.byService.slice(0, 6).map((item, i) => (
                     <tr key={i} className="hover:bg-muted/30 transition-colors">
                       <td className="px-6 py-3 text-sm font-bold truncate max-w-[150px]">{item.name}</td>
                       <td className="px-6 py-3 text-sm font-black text-emerald-600 text-right">{fmtCurrency(item.revenue)}</td>
                       <td className="px-6 py-3 text-xs font-semibold text-muted-foreground text-right">{item.bookings}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             <div className="p-4 border-t bg-muted/5 text-center">
                <span className="text-[10px] font-bold uppercase text-muted-foreground hover:text-primary cursor-pointer transition-colors">Prikaži cjeloviti izvještaj</span>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
