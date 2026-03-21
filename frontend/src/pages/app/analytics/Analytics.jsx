import React, { useState } from 'react';
import { LayoutDashboard, Euro, Users, UserCheck, Filter } from 'lucide-react';
import AnalyticsOverviewTab from './AnalyticsOverviewTab';
import AnalyticsRevenueTab from './AnalyticsRevenueTab';
import AnalyticsClientsTab from './AnalyticsClientsTab';
import AnalyticsStaffTab from './AnalyticsStaffTab';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const PERIODS = [
  { key: '30d',   label: 'Zadnjih 30 dana' },
  { key: 'week',  label: 'Ovaj tjedan' },
  { key: 'month', label: 'Ovaj mjesec' },
];

// Debug check
if (window.location.host.includes('localhost')) {
  console.log('--- 📊 Analytics View Debug ---');
  console.log('- Tailwind CSS v3 initialized');
  console.log('- shadcn/ui base ready');
  console.log('- ApexCharts theme applied');
}

const TABS = [
  { id: 'overview', label: 'Pregled', icon: LayoutDashboard },
  { id: 'revenue', label: 'Prihodi', icon: Euro },
  { id: 'clients', label: 'Klijenti', icon: Users },
  { id: 'staff', label: 'Tim', icon: UserCheck },
];

export default function Analytics() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('30d');
  
  const businessId = user?.activeBusinessId;

  if (!businessId) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <Filter className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-black text-foreground">Odaberite salon</h2>
          <p className="text-muted-foreground">Morate odabrati salon kako biste vidjeli njegove analitičke podatke.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-background">
      <div className="flex flex-col">
        {/* Navigation Tabs - shadcn-like tabs */}
        <div className="flex border-b bg-muted/30 px-6 pt-2 overflow-x-auto scroller-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all relative border-b-2 -mb-[2px] whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="flex flex-col gap-6 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Analitika</h1>
                <p className="text-muted-foreground">Poslovni uvidi, trendovi i performanse vašeg tima.</p>
              </div>

              {/* Date Range Picker - Global for Overview & Revenue */}
              {(activeTab === 'overview' || activeTab === 'revenue') && (
                <div className="flex items-center bg-card border rounded-lg p-1 shadow-sm">
                  {PERIODS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setPeriod(p.key)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                        period === p.key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </header>

            {/* Tab Panels */}
            {activeTab === 'overview' && (
              <AnalyticsOverviewTab 
                businessId={businessId} 
                period={period} 
                onTabChange={setActiveTab}
              />
            )}
            {activeTab === 'revenue' && (
              <AnalyticsRevenueTab 
                businessId={businessId} 
                period={period} 
              />
            )}
            {activeTab === 'clients' && (
              <AnalyticsClientsTab 
                businessId={businessId} 
              />
            )}
            {activeTab === 'staff' && (
              <AnalyticsStaffTab 
                businessId={businessId} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
