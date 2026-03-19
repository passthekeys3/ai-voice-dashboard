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
        trend: '+12.5%',
        trendUp: true,
    },
    {
        title: 'Avg Duration',
        value: '3m 42s',
        icon: Clock,
        trend: '+8.3%',
        trendUp: true,
    },
    {
        title: 'Success Rate',
        value: '94.2%',
        icon: TrendingUp,
        trend: '+2.1%',
        trendUp: true,
    },
    {
        title: 'Total Cost',
        value: '$186.40',
        icon: DollarSign,
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
    { name: 'Sarah', percentage: 45 },
    { name: 'Marcus', percentage: 28 },
    { name: 'Emma', percentage: 18 },
];

/* ─── Sub-components ─── */

function KPICard({ kpi, index, isInView }: { kpi: typeof ANALYTICS_KPI[number]; index: number; isInView: boolean }) {
    return (
        <div
            className="rounded-lg border border-border bg-card animate-fade-up"
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: `${200 + index * 80}ms`,
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            <div className="px-2 py-1.5">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-medium text-muted-foreground">{kpi.title}</span>
                    <kpi.icon className="h-2.5 w-2.5 text-muted-foreground/40" />
                </div>
                <div className="text-sm sm:text-base font-semibold tracking-tight">{kpi.value}</div>
                <div
                    className={cn(
                        'flex items-center gap-0.5 text-[8px] font-medium mt-0.5',
                        kpi.trendUp
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
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
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#f1f5f9" strokeOpacity={1} vertical={false} />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                        <YAxis stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} width={25} />
                        <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#mockupAnalyticsFill)" animationDuration={1200} animationEasing="ease-out" />
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
                                className="h-1.5 rounded-full bg-blue-500 transition-all duration-700"
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
