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
  MessageSquare, 
  TrendingUp, 
  AlertCircle,
  Clock,
  PlusCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Formatter Helpers ---
const fmtCurrency = (n) =>
  `${(n || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('hr-HR', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

function RiskLevelBadge({ daysSince, avgInterval }) {
  if (!avgInterval) return <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none">Nepoznat</Badge>;
  const ratio = daysSince / avgInterval;
  if (ratio >= 3)    return <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 border-none">Visok rizik</Badge>;
  if (ratio >= 2)    return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-none">Srednji rizik</Badge>;
  return               <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none">Blagi rizik</Badge>;
}

// --- Empty State ---
function EmptyState() {
  return (
     <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed rounded-3xl bg-muted/20">
       <div className="p-4 bg-primary/10 rounded-2xl text-primary mb-6">
         <Users className="h-10 w-10" />
       </div>
       <h3 className="text-xl font-bold">Nema dovoljno podataka o klijentima</h3>
       <p className="text-muted-foreground max-w-sm mt-2 text-sm">
         Analitika klijenata pojavit će se nakon završenih termina u salonu.
       </p>
     </div>
  );
}

export default function AnalyticsClientsTab({ businessId }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAnalyticsClients(businessId, '30d');
      if (res.success) setData(res.data);
    } catch {
      toast.error('Greška pri učitavanju podataka o klijentima');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const handleSendMessage = (client) => {
    sessionStorage.setItem('prefillClient', JSON.stringify({
      id: client.id, name: client.name, phone: client.phone
    }));
    navigate('/marketing/campaigns/new?source=analytics');
  };

  // --- Chart Configs ---
  const newVsReturningConfig = useMemo(() => {
    if (!data || !data.newVsReturning?.length) return null;

    return {
      series: [
        { name: 'Novi', data: data.newVsReturning.map(r => r.newClients) },
        { name: 'Povratni', data: data.newVsReturning.map(r => r.returningClients) }
      ],
      options: {
        ...apexChartsTheme.options,
        chart: {
           ...apexChartsTheme.options.chart,
           type: 'line',
           toolbar: { show: false }
        },
        stroke: { curve: 'smooth', width: 3 },
        markers: { size: 4, strokeWidth: 0, hover: { size: 6 } },
        xaxis: {
           ...apexChartsTheme.options.xaxis,
           categories: data.newVsReturning.map(r => r.month.slice(5)),
           labels: { style: { colors: '#64748b' } }
        },
        fill: {
          type: 'solid',
          opacity: [0.35, 1]
        },
        colors: [apexChartsTheme.colors.primary, apexChartsTheme.colors.emerald],
        legend: {
          position: 'top',
          horizontalAlign: 'right',
          markers: { radius: 12 },
          fontWeight: 600,
          labels: { colors: '#64748b' }
        }
      }
    };
  }, [data]);

  const retentionConfig = useMemo(() => {
    if (!data || data.retentionRate === null) return null;

    const rate = data.retentionRate;
    
    return {
      series: [rate],
      options: {
        ...apexChartsTheme.options,
        chart: {
           ...apexChartsTheme.options.chart,
           type: 'radialBar',
           sparkline: { enabled: true }
        },
        plotOptions: {
          radialBar: {
            startAngle: -90,
            endAngle: 90,
            hollow: { size: '65%' },
            dataLabels: {
              name: { show: false },
              value: {
                offsetY: -2,
                fontSize: '24px',
                fontWeight: '900',
                color: '#1e293b',
                formatter: (val) => `${val}%`
              }
            },
            track: {
               background: '#f1f5f9',
               strokeWidth: '97%'
            }
          }
        },
        fill: {
          type: 'gradient',
          gradient: {
            shade: 'light',
            shadeIntensity: 0.4,
            inverseColors: false,
            opacityFrom: 1,
            opacityTo: 1,
            stops: [0, 50, 65, 91]
          }
        },
        colors: [rate >= 60 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444'],
        labels: ['Zadržavanje']
      }
    };
  }, [data]);

  const topClientsConfig = useMemo(() => {
    if (!data || !data.topClients?.length) return null;

    const top5 = data.topClients.slice(0, 5);

    return {
      series: [{
        name: 'Prihod',
        data: top5.map(c => c.totalRevenue.toFixed(0))
      }],
      options: {
        ...apexChartsTheme.options,
        chart: { type: 'bar', toolbar: { show: false } },
        plotOptions: {
          bar: {
             borderRadius: 10,
             horizontal: true,
             barHeight: '50%',
             distributed: true,
             dataLabels: { position: 'bottom' }
          }
        },
        colors: ['#0d6efd', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
        xaxis: {
           categories: top5.map(c => c.name.split(' ')[0]),
           labels: { show: false }
        },
        grid: { show: false },
        legend: { show: false },
        dataLabels: {
          enabled: true,
          textAnchor: 'start',
          style: { colors: ['#fff'], fontWeight: '900' },
          formatter: (val, opt) => `${opt.w.globals.labels[opt.dataPointIndex]}: ${val}€`,
          offsetX: 10
        }
      }
    };
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!data?.hasEnoughData) return <EmptyState />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Client Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border-none bg-card relative overflow-hidden group">
          <CardHeader className="pb-0">
             <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Klijenti u riziku</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className={cn("text-3xl font-black transition-colors", data.atRiskClients.length > 0 ? "text-rose-600" : "text-emerald-600")}>
                {data.atRiskClients.length}
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Potreban kontakt</p>
            </div>
            <div className="p-3 bg-rose-500/10 text-rose-600 rounded-2xl">
              <AlertCircle className="h-6 w-6" />
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500" />
        </Card>

        <Card className="shadow-sm border-none bg-card">
           <CardHeader className="pb-0">
             <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Stopa Zadržavanja</CardTitle>
           </CardHeader>
           <CardContent className="pt-2 flex items-center justify-between">
              <div className="flex-1">
                {retentionConfig && (
                  <Chart 
                    options={retentionConfig.options}
                    series={retentionConfig.series}
                    type="radialBar"
                    height={160}
                  />
                )}
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Status</p>
                <Badge variant="secondary" className={cn(
                  "border-none font-black text-[10px] uppercase tracking-widest",
                   data.retentionRate >= 60 ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                )}>
                  {data.retentionRate >= 80 ? 'Premium' : data.retentionRate >= 50 ? 'Dobro' : 'Nisko'}
                </Badge>
              </div>
           </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-card relative overflow-hidden group">
          <CardHeader className="pb-0">
             <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">No-Show Stopa</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-3xl font-black text-rose-600">
                {data.noShowRate}%
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Prosjek u periodu</p>
            </div>
            <div className="p-3 bg-slate-500/10 text-slate-600 rounded-2xl">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500" />
        </Card>
      </div>

      {/* Main Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Retention Trend */}
        <Card className="shadow-sm border-none bg-card">
          <CardHeader>
             <CardTitle className="text-lg font-bold">Novi vs. Povratni Klijenti</CardTitle>
             <CardDescription>Mjesečni trend rasta baze klijenata.</CardDescription>
          </CardHeader>
          <CardContent>
             {newVsReturningConfig && (
               <Chart 
                 options={newVsReturningConfig.options}
                 series={newVsReturningConfig.series}
                 type="line"
                 height={280}
               />
             )}
          </CardContent>
        </Card>

        {/* Top Clients - Visual Ranking */}
        <Card className="shadow-sm border-none bg-card">
          <CardHeader>
             <CardTitle className="text-lg font-bold">Lojalnost (Prihod)</CardTitle>
             <CardDescription>Poredak top 5 lojalnih klijenata po doprinosu.</CardDescription>
          </CardHeader>
          <CardContent>
             {topClientsConfig && (
               <Chart 
                 options={topClientsConfig.options}
                 series={topClientsConfig.series}
                 type="bar"
                 height={280}
               />
             )}
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Clients Table */}
      <Card className="shadow-sm border-none bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
           <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Klijenti u riziku
                {data.atRiskClients.length > 0 && (
                  <Badge variant="destructive" className="bg-rose-600 hover:bg-rose-700 font-black text-[10px]">{data.atRiskClients.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>Ovi klijenti bi mogli odustati. Javljanjem im pokazujete brigu.</CardDescription>
           </div>
           <Button variant="outline" size="sm" className="h-8 text-xs gap-2 font-bold border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => navigate('/marketing/segments')}>
             Vidi segmente <PlusCircle className="h-3 w-3" />
           </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/30 border-y">
                   <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap">Klijent</th>
                   <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap">Status Rizika</th>
                   <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap text-right">Zadnja Posjeta</th>
                   <th className="px-6 py-3 text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap text-right">Akcija</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                 {data.atRiskClients.slice(0, 8).map((client) => (
                   <tr key={client.id} className="group hover:bg-muted/30 transition-colors">
                     <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                             {client.name.charAt(0)}
                           </div>
                           <div className="flex flex-col">
                              <span className="text-sm font-bold group-hover:text-primary transition-colors">{client.name}</span>
                              <span className="text-xs text-muted-foreground">{client.phone}</span>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-4 border-l">
                        <RiskLevelBadge daysSince={client.daysSinceLast} avgInterval={client.avgIntervalDays} />
                        <p className="text-[10px] font-medium text-muted-foreground mt-1">Ciklus: ~{client.avgIntervalDays} dana</p>
                     </td>
                     <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-rose-600">prije {client.daysSinceLast} dana</span>
                        <p className="text-[10px] font-medium text-muted-foreground mt-0.5">{fmtDate(client.lastVisit)}</p>
                     </td>
                     <td className="px-6 py-4 text-right">
                        <Button 
                          onClick={() => handleSendMessage(client)}
                          size="sm" 
                          className="h-8 gap-2 bg-primary hover:bg-primary/95 font-bold text-xs shadow-lg shadow-primary/20"
                        >
                          <MessageSquare className="h-3 w-3" />
                          Pošalji poruku
                        </Button>
                     </td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
          {data.atRiskClients.length === 0 && (
            <div className="py-12 text-center">
               <Users className="h-8 w-8 text-muted/30 mx-auto mb-3" />
               <p className="text-sm font-medium text-muted-foreground">Trenutno nemate klijenata s visokim rizikom odustajanja.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
