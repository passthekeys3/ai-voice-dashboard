'use client';

import {
    Phone,
    Clock,
    TrendingUp,
    TrendingDown,
    DollarSign,
    BarChart3,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

/* ─── Mock Data ─── */

const ANALYTICS_KPI = [
    {
        title: 'Total Calls',
        value: '1,247',
        icon: Phone,
        theme: 'blue' as const,
        trend: '+12.5%',
        trendUp: true,
    },
    {
        title: 'Avg Duration',
        value: '3:42',
        icon: Clock,
        theme: 'green' as const,
        trend: '+8.3%',
        trendUp: true,
    },
    {
        title: 'Success Rate',
        value: '94.2%',
        icon: TrendingUp,
        theme: 'purple' as const,
        trend: '+2.1%',
        trendUp: true,
    },
    {
        title: 'Total Cost',
        value: '$186.40',
        icon: DollarSign,
        theme: 'amber' as const,
        trend: '-5.7%',
        trendUp: false,
    },
];

const ANALYTICS_CHART_DATA = [
    { date: 'Mon', count: 45 },
    { date: 'Tue', count: 78 },
    { date: 'Wed', count: 62 },
    { date: 'Thu', count: 91 },
    { date: 'Fri', count: 105 },
    { date: 'Sat', count: 48 },
    { date: 'Sun', count: 35 },
];

const CALLS_BY_AGENT = [
    { name: 'Sarah', percentage: 45, color: 'from-green-500 to-emerald-500' },
    { name: 'Marcus', percentage: 28, color: 'from-green-400 to-emerald-400' },
    { name: 'Emma', percentage: 18, color: 'from-green-300 to-emerald-300' },
];

const cardThemes = {
    blue: {
        border: 'border-l-blue-500',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        iconColor: 'text-blue-600 dark:text-blue-400',
    },
    green: {
        border: 'border-l-green-500',
        iconBg: 'bg-green-100 dark:bg-green-900/30',
        iconColor: 'text-green-600 dark:text-green-400',
    },
    amber: {
        border: 'border-l-amber-500',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        iconColor: 'text-amber-600 dark:text-amber-400',
    },
    purple: {
        border: 'border-l-purple-500',
        iconBg: 'bg-purple-100 dark:bg-purple-900/30',
        iconColor: 'text-purple-600 dark:text-purple-400',
    },
} as const;

/* ─── Sub-components ─── */

function KPICard({ kpi, index, isInView }: { kpi: typeof ANALYTICS_KPI[number]; index: number; isInView: boolean }) {
    const theme = cardThemes[kpi.theme];

    return (
        <div
            className={cn(
                'rounded-lg border border-border bg-card overflow-hidden border-l-[3px]',
                theme.border,
                'animate-fade-up'
            )}
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: `${200 + index * 80}ms`,
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            <div className="px-2 py-1.5">
                <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-medium text-muted-foreground">{kpi.title}</span>
                    <div className={cn('p-0.5 rounded', theme.iconBg)}>
                        <kpi.icon className={cn('h-2 w-2', theme.iconColor)} />
                    </div>
                </div>
                <div className="text-sm sm:text-base font-bold tracking-tight">{kpi.value}</div>
                <div
                    className={cn(
                        'flex items-center gap-0.5 text-[8px] font-semibold mt-0.5',
                        kpi.trendUp
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-green-600 dark:text-green-400' // cost going down = good
                    )}
                >
                    {kpi.trendUp ? (
                        <TrendingUp className="h-2 w-2" />
                    ) : (
                        <TrendingDown className="h-2 w-2" />
                    )}
                    <span>{kpi.trend}</span>
                </div>
            </div>
        </div>
    );
}

function AnalyticsChart({ isInView }: { isInView: boolean }) {
    if (!isInView) {
        return (
            <div className="rounded-lg border border-border bg-card p-2.5">
                <div className="text-[10px] font-semibold mb-1.5">Call Volume</div>
                <div className="h-[100px] sm:h-[140px]" />
            </div>
        );
    }

    return (
        <div
            className="rounded-lg border border-border bg-card p-2.5 animate-fade-up"
            style={{ animationDelay: '550ms', animationFillMode: 'both' }}
        >
            <div className="text-[10px] font-semibold mb-1.5">Call Volume</div>
            <div className="h-[100px] sm:h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ANALYTICS_CHART_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="mockupAnalyticsFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.4} />
                                <stop offset="50%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="mockupAnalyticsStroke" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="hsl(142, 71%, 45%)" />
                                <stop offset="100%" stopColor="hsl(160, 84%, 39%)" />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={8} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={8} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} width={25} />
                        <Area type="monotone" dataKey="count" stroke="url(#mockupAnalyticsStroke)" strokeWidth={2} fillOpacity={1} fill="url(#mockupAnalyticsFill)" animationDuration={1200} animationEasing="ease-out" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function CallsByAgentBars({ isInView }: { isInView: boolean }) {
    return (
        <div
            className="rounded-lg border border-border bg-card p-2.5 animate-fade-up"
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: '700ms',
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            <div className="flex items-center gap-1.5 mb-2.5">
                <BarChart3 className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold">Calls by Agent</span>
            </div>
            <div className="space-y-2">
                {CALLS_BY_AGENT.map((agent) => (
                    <div key={agent.name} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[9px]">
                            <span className="font-medium">{agent.name}</span>
                            <span className="text-muted-foreground">{agent.percentage}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                            <div
                                className={cn('h-1.5 rounded-full bg-gradient-to-r', agent.color, 'transition-all duration-700')}
                                style={{ width: isInView ? `${agent.percentage}%` : '0%' }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Main Component ─── */

interface AnalyticsMockupProps {
    isInView: boolean;
}

export function AnalyticsMockup({ isInView }: AnalyticsMockupProps) {
    return (
        <div className="p-3 space-y-2.5">
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {ANALYTICS_KPI.map((kpi, index) => (
                    <KPICard key={kpi.title} kpi={kpi} index={index} isInView={isInView} />
                ))}
            </div>

            {/* Chart */}
            <AnalyticsChart isInView={isInView} />

            {/* Calls by agent */}
            <CallsByAgentBars isInView={isInView} />
        </div>
    );
}
