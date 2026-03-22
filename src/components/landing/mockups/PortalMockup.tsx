'use client';

import {
    LayoutDashboard,
    Phone,
    BarChart3,
    Settings,
    Search,
    PhoneIncoming,
    PhoneOutgoing,
    Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Mock Data ─── */

const PORTAL_NAV = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: Phone, label: 'Calls', active: false },
    { icon: BarChart3, label: 'Analytics', active: false },
    { icon: Settings, label: 'Settings', active: false },
];

const PORTAL_METRICS = [
    { label: 'Total Calls', value: '148', icon: Phone },
    { label: 'Avg Duration', value: '3m 42s', icon: Phone },
    { label: 'Success Rate', value: '96.3%', icon: BarChart3 },
];

const PORTAL_CALLS = [
    { agent: 'Reception Bot', status: 'completed' as const, direction: 'inbound' as const, duration: '2m 45s', time: '2 min ago' },
    { agent: 'Sales Agent', status: 'completed' as const, direction: 'outbound' as const, duration: '4m 12s', time: '15 min ago' },
    { agent: 'Booking Agent', status: 'in_progress' as const, direction: 'inbound' as const, duration: '1m 08s', time: 'Now' },
];

/* ─── Sub-components ─── */

function BrowserBar({ isInView }: { isInView: boolean }) {
    return (
        <div
            className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 border-b border-border/50 animate-fade-up"
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: '100ms',
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            {/* Traffic lights */}
            <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-rose-400/80" />
                <div className="w-2 h-2 rounded-full bg-amber-400/80" />
                <div className="w-2 h-2 rounded-full bg-emerald-400/80" />
            </div>
            {/* URL bar */}
            <div className="flex-1 flex items-center justify-center">
                <div className="px-3 py-0.5 rounded-md bg-background/80 border border-border/30">
                    <span className="text-[9px] text-muted-foreground font-mono">portal.acmevoice.ai</span>
                </div>
            </div>
        </div>
    );
}

function PortalSidebar({ isInView }: { isInView: boolean }) {
    return (
        <div
            className="hidden sm:flex flex-col w-[50px] flex-shrink-0 items-center py-2.5 gap-1 bg-slate-900 dark:bg-slate-950 animate-fade-up"
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: '250ms',
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            {/* Logo monogram */}
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center mb-2">
                <span className="text-[10px] font-bold text-white">AV</span>
            </div>

            {/* Nav icons */}
            {PORTAL_NAV.map((item, index) => (
                <div
                    key={index}
                    className={cn(
                        'relative w-8 h-8 rounded-md flex items-center justify-center transition-colors',
                        item.active ? 'bg-white/10' : 'hover:bg-white/5'
                    )}
                >
                    {item.active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-white" />
                    )}
                    <item.icon className={cn('h-3.5 w-3.5', item.active ? 'text-white' : 'text-white/40')} />
                </div>
            ))}
        </div>
    );
}

function PortalContent({ isInView }: { isInView: boolean }) {
    return (
        <div className="flex-1 min-w-0 bg-background flex flex-col">
            {/* Header bar */}
            <div
                className="flex items-center justify-between px-3 py-2 border-b border-border animate-fade-up"
                style={{
                    opacity: isInView ? undefined : 0,
                    animationDelay: '350ms',
                    animationFillMode: 'both',
                    animationPlayState: isInView ? 'running' : 'paused',
                }}
            >
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 flex-1 max-w-[140px]">
                    <Search className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground">Search...</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <span className="text-[7px] font-semibold">AC</span>
                    </div>
                </div>
            </div>

            {/* Content area */}
            <div className="flex-1 p-3">
                {/* Title row */}
                <div
                    className="flex items-center justify-between mb-2.5 animate-fade-up"
                    style={{
                        opacity: isInView ? undefined : 0,
                        animationDelay: '400ms',
                        animationFillMode: 'both',
                        animationPlayState: isInView ? 'running' : 'paused',
                    }}
                >
                    <span className="text-[11px] sm:text-xs font-bold">Dashboard</span>
                </div>

                {/* Metric cards */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {PORTAL_METRICS.map((metric, index) => (
                        <div
                            key={metric.label}
                            className="rounded-lg border border-border bg-card p-2 animate-fade-up"
                            style={{
                                opacity: isInView ? undefined : 0,
                                animationDelay: `${450 + index * 80}ms`,
                                animationFillMode: 'both',
                                animationPlayState: isInView ? 'running' : 'paused',
                            }}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="text-[9px] text-muted-foreground font-medium">{metric.label}</div>
                                <metric.icon className="h-2.5 w-2.5 text-muted-foreground/40" />
                            </div>
                            <div className="text-sm sm:text-base font-semibold tracking-tight">{metric.value}</div>
                        </div>
                    ))}
                </div>

                {/* Recent calls table */}
                <div
                    className="rounded-lg border border-border bg-card p-2.5 flex-1 animate-fade-up"
                    style={{
                        opacity: isInView ? undefined : 0,
                        animationDelay: '700ms',
                        animationFillMode: 'both',
                        animationPlayState: isInView ? 'running' : 'paused',
                    }}
                >
                    <div className="text-[10px] font-semibold mb-2">Recent Calls</div>
                    <table className="w-full text-[9px]">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left font-medium text-muted-foreground pb-1 pr-2">Agent</th>
                                <th className="text-left font-medium text-muted-foreground pb-1 pr-2">Status</th>
                                <th className="text-left font-medium text-muted-foreground pb-1 pr-2 hidden sm:table-cell">Dir</th>
                                <th className="text-right font-medium text-muted-foreground pb-1">Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {PORTAL_CALLS.map((call, index) => (
                                <tr key={index} className="border-b border-border/50 last:border-0">
                                    <td className="py-1.5 pr-2 font-medium">{call.agent}</td>
                                    <td className="py-1.5 pr-2">
                                        <span
                                            className={cn(
                                                'inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-medium',
                                                call.status === 'completed'
                                                    ? 'bg-muted text-muted-foreground'
                                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            )}
                                        >
                                            {call.status === 'completed' ? 'Completed' : 'In Progress'}
                                        </span>
                                    </td>
                                    <td className="py-1.5 pr-2 hidden sm:table-cell">
                                        {call.direction === 'inbound' ? (
                                            <PhoneIncoming className="h-2.5 w-2.5 text-muted-foreground" />
                                        ) : (
                                            <PhoneOutgoing className="h-2.5 w-2.5 text-muted-foreground" />
                                        )}
                                    </td>
                                    <td className="py-1.5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <span className="font-mono text-muted-foreground">{call.duration}</span>
                                            <Play className="h-2 w-2 text-muted-foreground/40" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Component ─── */

interface PortalMockupProps {
    isInView: boolean;
}

export function PortalMockup({ isInView }: PortalMockupProps) {
    return (
        <div>
            {/* Browser chrome */}
            <BrowserBar isInView={isInView} />

            {/* Portal body */}
            <div className="flex min-h-[260px] sm:min-h-[300px]">
                <PortalSidebar isInView={isInView} />
                <PortalContent isInView={isInView} />
            </div>
        </div>
    );
}
