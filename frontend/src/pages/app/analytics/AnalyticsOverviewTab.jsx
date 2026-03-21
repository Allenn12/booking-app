import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Chart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { apexChartsTheme } from '@/lib/apexcharts-theme';
import { formatChartDate } from '@/lib/chart-utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Euro, 
  CalendarCheck, 
  Clock,
  ChevronRight,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Formatter Helpers ---
const fmtCurrency = (n) =>
  `${(n || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// DOW labels — MySQL DAYOFWEEK: 1=Sun,2=Mon,...,7=Sat
const DOW_LABELS = ['', 'Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

// --- KPI Card Sub-component ---
function KPICard({ title, value, subValue, change, icon, loading }) {
  if (loading) return <Skeleton className="h-32 w-full rounded-xl" />;
  
  const isUp = change > 0;
  const isDown = change < 0;
  const IconComponent = icon;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
            <h3 className="text-3xl font-extrabold tracking-tight">{value}</h3>
          </div>
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            {IconComponent && <IconComponent className="h-5 w-5" />}
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-2">
          {change !== null && change !== undefined && (
            <Badge variant="outline" className={cn(
              "px-1.5 py-0.5 border-none font-bold text-xs flex items-center gap-0.5",
              isUp ? "bg-emerald-500/10 text-emerald-600" : 
              isDown ? "bg-rose-500/10 text-rose-600" : 
              "bg-slate-500/10 text-slate-600"
            )}>
              {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : null}
              {Math.abs(change)}%
            </Badge>
          )}
          <span className="text-[11px] font-medium text-muted-foreground">{subValue}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Empty State ---
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed rounded-3xl bg-muted/20">
      <div className="p-4 bg-primary/10 rounded-2xl text-primary mb-6">
        <Clock className="h-10 w-10" />
      </div>
      <h3 className="text-xl font-bold">Još nema dovoljno podataka</h3>
      <p className="text-muted-foreground max-w-sm mt-2 text-sm">
        Analitika će biti dostupna čim završite prvih nekoliko termina u salonu. 
        Dopustite aplikaciji da prikupi dovoljno podataka za precizne uvide.
      </p>
    </div>
  );
}

// --- Main Tab Panel ---
export default function AnalyticsOverviewTab({ businessId, period, onTabChange }) {
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

  // --- Chart Configs ---
  const revenueTrendConfig = useMemo(() => {
    if (!data || !data.trend?.length) return null;
    
    return {
      series: [{
        name: 'Prihod',
        data: data.trend.map(r => r.revenue.toFixed(2))
      }],
      options: {
        ...apexChartsTheme.options,
        chart: {
          ...apexChartsTheme.options.chart,
          type: 'area',
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 4 },
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.7,
            opacityTo: 0.25,
            stops: [0, 95, 100]
          }
        },
        xaxis: {
          ...apexChartsTheme.options.xaxis,
          categories: data.trend.map(r => formatChartDate(r.day, 'day')),
          tickAmount: data.trend.length <= 7 ? undefined : 5,
          labels: {
            show: true,
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
            formatter: (val) => `${val}€`,
            style: { colors: '#64748b' }
          }
        },
        colors: [apexChartsTheme.colors.primary],
        tooltip: {
          y: { formatter: (val) => `${val}€` }
        }
      }
    };
  }, [data]);

  const heatmapConfig = useMemo(() => {
    if (!data || !data.heatmap) return null;

    // DOW rows: Mon(2) → Sun(1)
    const dowOrder = [2, 3, 4, 5, 6, 7, 1];
    
    // Transform data for ApexHeatmap
    const series = dowOrder.map(dow => {
      const rowData = Array.from({ length: 24 }, (_, hour) => {
        const item = data.heatmap.find(h => h.dow === dow && h.hour === hour);
        return {
          x: `${hour}h`,
          y: item ? item.count : 0
        };
      });

      return {
        name: DOW_LABELS[dow],
        data: rowData
      };
    });

    return {
      series: series.reverse(), // Mon at top
      options: {
        ...apexChartsTheme.options,
        chart: {
          ...apexChartsTheme.options.chart,
          type: 'heatmap',
          toolbar: { show: false }
        },
        dataLabels: { enabled: false },
        plotOptions: {
          heatmap: {
            shadeIntensity: 0.5,
            radius: 4,
            useFillColorAsStroke: false,
            colorScale: {
              ranges: [
                { from: 0, to: 0, color: '#f8fafc', name: 'Nema termina' },
                { from: 1, to: 2, color: '#e0f2fe', name: 'Malo' },
                { from: 3, to: 5, color: '#7dd3fc', name: 'Srednje' },
                { from: 6, to: 100, color: '#0284c7', name: 'Puno' }
              ]
            }
          }
        },
        xaxis: {
          ...apexChartsTheme.options.xaxis,
          tickAmount: 12, // Show every 2nd hour to avoid crowding
          labels: {
            show: true,
            style: { colors: '#64748b', fontSize: '10px' }
          }
        },
        grid: { show: false }
      }
    };
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        <Skeleton className="h-[400px] w-full col-span-full rounded-3xl" />
      </div>
    );
  }

  if (!data?.hasEnoughData) return <EmptyState />;

  const completionRate = data.completionStats.total > 0 
    ? Math.round((data.completionStats.completed / data.completionStats.total) * 100) 
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Ukupni Prihod" 
          value={fmtCurrency(data.revenue)} 
          subValue="vs. prethodni period"
          change={data.pctChange}
          icon={Euro}
        />
        <KPICard 
          title="Završeni Termini" 
          value={data.bookings}
          subValue="u ovom periodu"
          icon={CalendarCheck}
        />
        <KPICard
          title="Stopa Završenosti"
          value={`${completionRate}%`}
          subValue={`${data.completionStats.completed} od ${data.completionStats.total} termina`}
          icon={TrendingUp}
        />
        <KPICard
          title="Novi Klijenti"
          value={data.newClients}
          subValue="vs. prethodni period"
          change={data.newClientsPctChange}
          icon={Users}
        />
      </div>

      {/* Main Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Trend - Area Chart */}
        <Card className="lg:col-span-2 shadow-sm border-none bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                Trend Prihoda
                <Badge variant="secondary" className="font-normal">Real-time</Badge>
              </CardTitle>
              <CardDescription>Vizualizacija dnevnih primitaka kroz odabrani period.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {revenueTrendConfig && (
              <Chart 
                options={revenueTrendConfig.options}
                series={revenueTrendConfig.series}
                type="area"
                height={300}
              />
            )}
          </CardContent>
        </Card>

        {/* Quick Insights / Top Services */}
        <Card className="shadow-sm border-none bg-card">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Top Usluge</CardTitle>
            <CardDescription>Najprodavanije usluge u salonu.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {data.topServices.slice(0, 5).map((service, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-foreground">{service.name}</span>
                    <span className="text-xs text-muted-foreground">{service.bookings} termina</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">{fmtCurrency(service.revenue)}</p>
                    <div className="w-24 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-1000" 
                        style={{ width: `${(service.revenue / (data.topServices[0].revenue || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full text-xs gap-2 mt-2 h-9" onClick={() => onTabChange('revenue')}>
                Vidi detaljnu analizu prihoda <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap Section - The Wow Moment */}
      <Card className="shadow-sm border-none bg-card">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              Popunjenost Termina (Topinska Mapa)
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </CardTitle>
            <CardDescription>Prikaz najfrekventnijih sati u salonu kroz tjedan.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/40 rounded-full border border-border/50">
               <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
               <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aktualno</span>
             </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 overflow-hidden scrollbar-hide">
          {heatmapConfig && (
            <div className="w-full">
              <Chart 
                options={heatmapConfig.options}
                series={heatmapConfig.series}
                type="heatmap"
                height={320}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
