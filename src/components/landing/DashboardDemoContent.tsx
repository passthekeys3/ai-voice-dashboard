'use client';

import {
    Phone,
    Clock,
    DollarSign,
    TrendingUp,
    TrendingDown,
    LayoutDashboard,
    Bot,
    BarChart3,
    Settings,
    PhoneIncoming,
    PhoneOutgoing,
    Menu,
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
import { useDemoCountUp } from './useDemoCountUp';

/* ─── Mock Data ─── */

const MOCK_KPI = [
    {
        title: 'Total Calls',
        value: 2847,
        format: (n: number) => Math.round(n).toLocaleString(),
        icon: Phone,
        theme: 'blue' as const,
        trend: '+12.5%',
        trendUp: true,
    },
    {
        title: 'Total Minutes',
        value: 1283.5,
        format: (n: number) => n.toFixed(1),
        icon: Clock,
        theme: 'green' as const,
        trend: '+8.3%',
        trendUp: true,
    },
    {
        title: 'Total Cost',
        value: 342.18,
        format: (n: number) => `$${n.toFixed(2)}`,
        icon: DollarSign,
        theme: 'amber' as const,
        trend: '-3.1%',
        trendUp: false,
    },
    {
        title: 'Success Rate',
        value: 94.2,
        format: (n: number) => `${n.toFixed(1)}%`,
        icon: TrendingUp,
        theme: 'purple' as const,
        trend: '+2.1%',
        trendUp: true,
    },
];

const MOCK_CHART_DATA = [
    { date: 'Jan 16', count: 45 },
    { date: 'Jan 18', count: 62 },
    { date: 'Jan 20', count: 58 },
    { date: 'Jan 22', count: 91 },
    { date: 'Jan 24', count: 78 },
    { date: 'Jan 26', count: 105 },
    { date: 'Jan 28', count: 98 },
    { date: 'Jan 30', count: 120 },
    { date: 'Feb 1', count: 115 },
    { date: 'Feb 3', count: 132 },
    { date: 'Feb 5', count: 128 },
    { date: 'Feb 7', count: 145 },
    { date: 'Feb 9', count: 138 },
    { date: 'Feb 11', count: 155 },
    { date: 'Feb 13', count: 162 },
];

const MOCK_CALLS = [
    { agent: 'Sarah - Dental', status: 'completed', direction: 'inbound' as const, duration: '3:42', time: '2 min ago' },
    { agent: 'Marcus - Sales', status: 'completed', direction: 'outbound' as const, duration: '5:18', time: '8 min ago' },
    { agent: 'Emma - Support', status: 'in_progress', direction: 'inbound' as const, duration: '1:23', time: 'Just now' },
    { agent: 'Sarah - Dental', status: 'completed', direction: 'inbound' as const, duration: '2:55', time: '15 min ago' },
];

const MOCK_AGENTS = [
    { name: 'Sarah - Dental Receptionist', active: true },
    { name: 'Marcus - Sales Qualifier', active: true },
    { name: 'Emma - Support Tier 1', active: true },
];

const NAV_ITEMS = [
    { name: 'Dashboard', icon: LayoutDashboard, active: true },
    { name: 'Agents', icon: Bot, active: false },
    { name: 'Calls', icon: Phone, active: false },
    { name: 'Analytics', icon: BarChart3, active: false },
    { name: 'Settings', icon: Settings, active: false },
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

function MiniSidebar({ isInView }: { isInView: boolean }) {
    return (
        <div
            className={cn(
                'hidden sm:flex flex-col sm:w-[60px] md:w-[160px] flex-shrink-0 text-white relative overflow-hidden',
                'demo-sidebar-animate',
                isInView && 'is-visible'
            )}
            style={{
                backgroundColor: '#0f172a',
                animationDelay: '300ms',
                animationFillMode: 'both',
            }}
        >
            {/* Gradient overlays matching real sidebar */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/10 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

            {/* Logo area */}
            <div className="relative z-10 flex h-10 items-center px-3 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
                <span className="hidden md:block text-xs font-bold truncate bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                    BuildVoiceAI
                </span>
                <span className="md:hidden text-xs font-bold text-white/80">BV</span>
            </div>

            {/* Nav items */}
            <nav className="relative z-10 flex-1 space-y-0.5 px-1.5 md:px-2 py-2">
                {NAV_ITEMS.map((item) => (
                    <div
                        key={item.name}
                        className={cn(
                            'relative flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                            item.active
                                ? 'bg-white/15 text-white'
                                : 'text-white/50'
                        )}
                    >
                        {/* Active indicator */}
                        {item.active && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
                        )}
                        <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="hidden md:block truncate">{item.name}</span>
                    </div>
                ))}
            </nav>
        </div>
    );
}

function MobileHeader() {
    return (
        <div
            className="sm:hidden flex items-center gap-2 px-3 py-2 border-b border-border"
            style={{ backgroundColor: '#0f172a' }}
        >
            <Menu className="h-3.5 w-3.5 text-white/70" />
            <span className="text-xs font-bold text-white">BuildVoiceAI</span>
        </div>
    );
}

function DemoKPICard({
    kpi,
    index,
    isInView,
}: {
    kpi: typeof MOCK_KPI[number];
    index: number;
    isInView: boolean;
}) {
    const animatedValue = useDemoCountUp(kpi.value, isInView, {
        duration: 1500,
        delay: 500 + index * 100,
    });
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
                animationDelay: `${500 + index * 100}ms`,
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            <div className="px-2.5 py-2">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-muted-foreground">
                        {kpi.title}
                    </span>
                    <div className={cn('p-1 rounded', theme.iconBg)}>
                        <kpi.icon className={cn('h-2.5 w-2.5', theme.iconColor)} />
                    </div>
                </div>
                <div className="text-base sm:text-lg font-bold tracking-tight">
                    {kpi.format(animatedValue)}
                </div>
                <div
                    className={cn(
                        'flex items-center gap-0.5 text-[9px] font-semibold mt-0.5',
                        kpi.trendUp
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                    )}
                >
                    {kpi.trendUp ? (
                        <TrendingUp className="h-2.5 w-2.5" />
                    ) : (
                        <TrendingDown className="h-2.5 w-2.5" />
                    )}
                    <span>{kpi.trend}</span>
                </div>
            </div>
        </div>
    );
}

function DemoChart({ isInView }: { isInView: boolean }) {
    // Only mount recharts when in view so its built-in animation plays
    if (!isInView) {
        return (
            <div className="rounded-lg border border-border bg-card p-3 md:col-span-4 min-w-0">
                <div className="text-[11px] font-semibold mb-2">Call Volume</div>
                <div className="h-[130px] sm:h-[160px]" />
            </div>
        );
    }

    return (
        <div
            className="rounded-lg border border-border bg-card p-3 md:col-span-4 min-w-0 animate-fade-up"
            style={{ animationDelay: '900ms', animationFillMode: 'both' }}
        >
            <div className="text-[11px] font-semibold mb-2">Call Volume</div>
            <div className="h-[130px] sm:h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_CHART_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="demoCallsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.4} />
                                <stop offset="50%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="demoStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="hsl(262, 83%, 58%)" />
                                <stop offset="100%" stopColor="hsl(221, 83%, 53%)" />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                            strokeOpacity={0.3}
                            vertical={false}
                        />
                        <XAxis
                            dataKey="date"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={9}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={9}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            width={30}
                        />
                        <Area
                            type="monotone"
                            dataKey="count"
                            stroke="url(#demoStrokeGradient)"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#demoCallsGradient)"
                            animationDuration={1500}
                            animationEasing="ease-out"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function DemoAgentsList({ isInView }: { isInView: boolean }) {
    return (
        <div
            className="rounded-lg border border-border bg-card p-3 md:col-span-3 min-w-0 animate-fade-up"
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: '900ms',
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            <div className="text-[11px] font-semibold mb-2">Your Agents</div>
            <div className="space-y-2">
                {MOCK_AGENTS.map((agent) => (
                    <div key={agent.name} className="flex items-center justify-between">
                        <span className="text-[10px] font-medium truncate">{agent.name}</span>
                        <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-green-500" />
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const isCompleted = status === 'completed';
    return (
        <span
            className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-medium',
                isCompleted
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            )}
        >
            {isCompleted ? 'Completed' : 'In Progress'}
        </span>
    );
}

function DemoCallsTable({ isInView }: { isInView: boolean }) {
    return (
        <div
            className="rounded-lg border border-border bg-card p-3 min-w-0 animate-fade-up"
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: '1050ms',
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            <div className="text-[11px] font-semibold mb-2">Recent Calls</div>
            <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left font-medium text-muted-foreground pb-1.5 pr-2">Agent</th>
                            <th className="text-left font-medium text-muted-foreground pb-1.5 pr-2">Status</th>
                            <th className="text-left font-medium text-muted-foreground pb-1.5 pr-2 hidden sm:table-cell">Direction</th>
                            <th className="text-left font-medium text-muted-foreground pb-1.5 pr-2">Duration</th>
                            <th className="text-right font-medium text-muted-foreground pb-1.5 hidden sm:table-cell">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {MOCK_CALLS.map((call, index) => (
                            <tr
                                key={index}
                                className={cn(
                                    'border-b border-border/50 last:border-0 animate-fade-up',
                                    // Hide last 2 rows on mobile
                                    index >= 2 && 'hidden sm:table-row'
                                )}
                                style={{
                                    opacity: isInView ? undefined : 0,
                                    animationDelay: `${1100 + index * 100}ms`,
                                    animationFillMode: 'both',
                                    animationPlayState: isInView ? 'running' : 'paused',
                                }}
                            >
                                <td className="py-1.5 pr-2 font-medium truncate max-w-[100px]">{call.agent}</td>
                                <td className="py-1.5 pr-2">
                                    <StatusBadge status={call.status} />
                                </td>
                                <td className="py-1.5 pr-2 hidden sm:table-cell">
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                        {call.direction === 'inbound' ? (
                                            <PhoneIncoming className="h-2.5 w-2.5" />
                                        ) : (
                                            <PhoneOutgoing className="h-2.5 w-2.5" />
                                        )}
                                        <span className="capitalize">{call.direction}</span>
                                    </span>
                                </td>
                                <td className="py-1.5 pr-2 text-muted-foreground">{call.duration}</td>
                                <td className="py-1.5 text-right text-muted-foreground hidden sm:table-cell">{call.time}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ─── Main Component ─── */

interface DashboardDemoContentProps {
    isInView: boolean;
}

export function DashboardDemoContent({ isInView }: DashboardDemoContentProps) {
    return (
        <div className="flex min-h-[380px] sm:min-h-[420px]">
            {/* Sidebar */}
            <MiniSidebar isInView={isInView} />

            {/* Main content area */}
            <div className="flex-1 min-w-0 bg-background">
                {/* Mobile header (shown when sidebar is hidden) */}
                <MobileHeader />

                <div className="p-3 sm:p-4 space-y-3">
                    {/* Welcome header */}
                    <div
                        className="animate-fade-up"
                        style={{
                            opacity: isInView ? undefined : 0,
                            animationDelay: '400ms',
                            animationFillMode: 'both',
                            animationPlayState: isInView ? 'running' : 'paused',
                        }}
                    >
                        <h3 className="text-sm sm:text-base font-bold tracking-tight">
                            Welcome back, Kevin
                        </h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            Here&apos;s an overview of your voice AI performance
                        </p>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {MOCK_KPI.map((kpi, index) => (
                            <DemoKPICard
                                key={kpi.title}
                                kpi={kpi}
                                index={index}
                                isInView={isInView}
                            />
                        ))}
                    </div>

                    {/* Chart + Agents row */}
                    <div className="grid gap-2 md:grid-cols-7">
                        <DemoChart isInView={isInView} />
                        <DemoAgentsList isInView={isInView} />
                    </div>

                    {/* Recent Calls */}
                    <DemoCallsTable isInView={isInView} />
                </div>
            </div>
        </div>
    );
}
