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
import { Modal } from '@/components/ui/modal';

// --- Formatter Helpers ---
const fmtCurrency = (n) =>
  `${(n || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const GROUP_BY = [
  { key: 'day',   label: 'Dan' },
  { key: 'week',  label: 'Tjedan' },
  { key: 'month', label: 'Mjesec' },
];

const DOW_SORTED = ['', 'Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

// --- Sub-components ---
const FullReportModalTable = ({ services }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'revenue', direction: 'desc' });
  
  const totalRevenue = useMemo(() => services.reduce((sum, s) => sum + s.revenue, 0), [services]);
  const totalBookings = useMemo(() => services.reduce((sum, s) => sum + s.bookings, 0), [services]);

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    const dataWithCalculations = services.map(s => {
      const share = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0;
      return { ...s, share };
    });
    
    return dataWithCalculations.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      }
      return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    });
  }, [services, sortConfig, totalRevenue]);

  const renderSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return null;
    return <span className="ml-1 text-primary">{sortConfig.direction === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b bg-muted/20">
            <th 
               className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/30 select-none transition-colors"
               onClick={() => handleSort('name')}
            >
              Usluga {renderSortIcon('name')}
            </th>
            <th 
               className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider text-right cursor-pointer hover:bg-muted/30 select-none transition-colors"
               onClick={() => handleSort('revenue')}
            >
              Prihod {renderSortIcon('revenue')}
            </th>
            <th 
               className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider text-right cursor-pointer hover:bg-muted/30 select-none transition-colors"
               onClick={() => handleSort('bookings')}
            >
              Br. termina {renderSortIcon('bookings')}
            </th>
            <th 
               className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider text-right cursor-pointer hover:bg-muted/30 select-none transition-colors"
               onClick={() => handleSort('share')}
            >
              Udio {renderSortIcon('share')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y relative">
          {sortedData.map((item, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              <td className="px-6 py-3 text-sm font-bold">{item.name}</td>
              <td className="px-6 py-3 text-sm font-black text-emerald-600 text-right">{fmtCurrency(item.revenue)}</td>
              <td className="px-6 py-3 text-xs font-semibold text-muted-foreground text-right">{item.bookings}</td>
              <td className="px-6 py-3 text-xs font-semibold text-muted-foreground text-right">
                 {item.share.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 bg-muted/5">
          <tr>
            <td className="px-6 py-3 text-sm font-bold text-foreground">Ukupno</td>
            <td className="px-6 py-3 text-sm font-black text-emerald-600 text-right">{fmtCurrency(totalRevenue)}</td>
            <td className="px-6 py-3 text-xs font-semibold text-foreground text-right">{totalBookings}</td>
            <td className="px-6 py-3 text-xs font-semibold text-muted-foreground text-right">100.0%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default function AnalyticsRevenueTab({ businessId, period }) {
  const [groupBy, setGroupBy] = useState('day');
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId]     = useState('');
  const [data, setData]           = useState(null);
  const [businessHours, setBusinessHours] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = { period, groupBy };
      if (serviceId) params.service_id = serviceId;
      if (staffId)   params.staff_id   = staffId;
      
      const [res, bizRes] = await Promise.all([
        api.getAnalyticsRevenue(businessId, params),
        api.getBusinessById(businessId)
      ]);
      
      if (res.success) setData(res.data);
      if (bizRes.success && bizRes.data?.business_hours) {
        setBusinessHours(bizRes.data.business_hours);
      }
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

  // --- Custom Revenue by Day Component ---
  const RevenueByDayChart = ({ byDow, businessHoursConfig }) => {
    if (!byDow?.length) return null;

    // 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
    // DESIRED: Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const MON_TO_SUN = [2, 3, 4, 5, 6, 7, 1];
    
    // Create a map for quick lookup that includes bookings
    const dataMap = byDow.reduce((acc, r) => {
      acc[r.dow] = { revenue: r.revenue, bookings: r.bookings || 0 };
      return acc;
    }, {});

    // Determine active days based on business config
    const isDayClosed = (mysqlDow) => {
      const hasConfig = businessHoursConfig && businessHoursConfig.length > 0;
      
      if (hasConfig) {
        // Map MySQL DOW (1=Sun, 7=Sat) to ISO DOW (1=Mon, 7=Sun)
        const mysqlToIso = { 1: 7, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };
        const isoDay = mysqlToIso[mysqlDow];
        const config = businessHoursConfig.find(h => h.day_of_week === isoDay);
        return !config || config.is_closed === 1;
      }
      
      // Fallback: if no config available, filter out days with 0 revenue & 0 bookings
      const dayData = dataMap[mysqlDow];
      const rev = dayData ? dayData.revenue : 0;
      const count = dayData ? dayData.bookings : 0;
      return rev === 0 && count === 0;
    };
    
    // Filter out non-working days completely BEFORE rendering
    const displayDays = MON_TO_SUN.filter(dow => !isDayClosed(dow));

    const chartData = displayDays.map(dow => ({
      dow,
      label: DOW_SORTED[dow], // Title Case mapping (e.g. 'Pon')
      revenue: dataMap[dow]?.revenue || 0
    }));

    const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);
    const totalRevenueAllDays = MON_TO_SUN.reduce((sum, dow) => sum + (dataMap[dow]?.revenue || 0), 0);
    const avgRevenue = totalRevenueAllDays / 7;

    return (
      <div className="py-2">
        {chartData.map((day, idx) => {
          const isZero = day.revenue === 0;
          const isMax = day.revenue === maxRevenue && maxRevenue > 0;
          const pctOfMax = (day.revenue / maxRevenue) * 100;

          return (
            <div key={idx} className={cn("flex items-center gap-4 group py-3.5", isZero && "opacity-50 grayscale")}>
              {/* Label */}
              <div className="w-10 text-xs font-bold text-muted-foreground tracking-tight">
                {day.label}
              </div>

              {/* Bar Container */}
              <div className="flex-1 h-2.5 bg-muted/20 rounded-full overflow-hidden relative">
                {!isZero && (
                  <div 
                    className={cn(
                      "h-full bg-emerald-500 rounded-full transition-all duration-700 ease-out",
                      isMax ? "opacity-100" : "opacity-75"
                    )}
                    style={{ width: `${Math.max(pctOfMax, 1)}%` }}
                  />
                )}
              </div>

              {/* Right Side: Value */}
              <div className="flex items-center gap-3 min-w-[80px] justify-end">
                <span className={cn("text-sm font-black", isZero ? "text-muted-foreground" : "text-foreground")}>
                  {isZero ? "—" : fmtCurrency(day.revenue)}
                </span>
              </div>
            </div>
          );
        })}
        
        {/* Average Line Legend */}
        <div className="mt-6 pt-4 border-t border-dashed flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Prosjek perioda</span>
          <span className="text-xs font-black text-muted-foreground">{fmtCurrency(avgRevenue)}</span>
        </div>
      </div>
    );
  };

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
            <RevenueByDayChart byDow={data.byDow} businessHoursConfig={businessHours} />
          </CardContent>
        </Card>

        {/* Top Services Table */}
        <Card className="shadow-sm border-none bg-card flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-6">
            <CardTitle className="text-lg font-bold">Učinak po uslugama</CardTitle>
            <PieChartIcon className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0 flex flex-col flex-1">
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
             {data.byService.length > 6 && (
               <div className="p-4 border-t bg-muted/5 text-center mt-auto">
                 <button 
                   onClick={() => setIsModalOpen(true)}
                   className="text-[10px] font-bold uppercase text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                 >
                   Prikaži cjeloviti izvještaj
                 </button>
               </div>
             )}
          </CardContent>
        </Card>
      </div>

      {/* Services Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Učinak po uslugama — Cjeloviti izvještaj"
      >
        <FullReportModalTable services={data.byService} />
      </Modal>
    </div>
  );
}
