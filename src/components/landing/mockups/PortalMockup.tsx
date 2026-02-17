'use client';

import {
    LayoutDashboard,
    Users,
    Phone,
    BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Mock Data ─── */

const PORTAL_NAV = [
    { icon: LayoutDashboard, active: true },
    { icon: Users, active: false },
    { icon: Phone, active: false },
    { icon: BarChart3, active: false },
];

const PORTAL_METRICS = [
    { label: 'Active Agents', value: '6', color: 'border-l-teal-500' },
    { label: 'Calls Today', value: '148', color: 'border-l-teal-400' },
    { label: 'Success Rate', value: '96.3%', color: 'border-l-teal-300' },
];

const PORTAL_CALLS = [
    { agent: 'Reception Bot', status: 'completed', duration: '2:45' },
    { agent: 'Sales Agent', status: 'completed', duration: '4:12' },
    { agent: 'Booking Agent', status: 'in_progress', duration: '1:08' },
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
                    <span className="text-[8px] text-muted-foreground font-mono">portal.acmevoice.ai</span>
                </div>
            </div>
        </div>
    );
}

function PortalSidebar({ isInView }: { isInView: boolean }) {
    return (
        <div
            className="hidden sm:flex flex-col w-[50px] flex-shrink-0 items-center py-2.5 gap-1 animate-fade-up"
            style={{
                backgroundColor: '#0d9488',
                opacity: isInView ? undefined : 0,
                animationDelay: '250ms',
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            {/* Logo monogram */}
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center mb-2">
                <span className="text-[10px] font-bold text-white">AV</span>
            </div>

            {/* Nav icons */}
            {PORTAL_NAV.map((item, index) => (
                <div
                    key={index}
                    className={cn(
                        'relative w-8 h-8 rounded-md flex items-center justify-center transition-colors',
                        item.active ? 'bg-white/20' : 'hover:bg-white/10'
                    )}
                >
                    {item.active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-white" />
                    )}
                    <item.icon className={cn('h-3.5 w-3.5', item.active ? 'text-white' : 'text-white/50')} />
                </div>
            ))}
        </div>
    );
}

function PortalContent({ isInView }: { isInView: boolean }) {
    return (
        <div className="flex-1 min-w-0 bg-background p-3 flex flex-col">
            {/* Header */}
            <div
                className="flex items-center gap-2 mb-3 animate-fade-up"
                style={{
                    opacity: isInView ? undefined : 0,
                    animationDelay: '350ms',
                    animationFillMode: 'both',
                    animationPlayState: isInView ? 'running' : 'paused',
                }}
            >
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] sm:text-xs font-bold truncate">Acme Voice AI</span>
                        <span className="px-1.5 py-0.5 rounded text-[7px] font-semibold bg-gradient-to-r from-teal-500 to-teal-600 text-white">
                            Enterprise
                        </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">Client Dashboard</div>
                </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-3 gap-1.5 mb-3">
                {PORTAL_METRICS.map((metric, index) => (
                    <div
                        key={metric.label}
                        className={cn(
                            'rounded-lg border border-border bg-card overflow-hidden border-l-[3px] px-2 py-1.5 animate-fade-up',
                            metric.color,
                        )}
                        style={{
                            opacity: isInView ? undefined : 0,
                            animationDelay: `${450 + index * 80}ms`,
                            animationFillMode: 'both',
                            animationPlayState: isInView ? 'running' : 'paused',
                        }}
                    >
                        <div className="text-[8px] text-muted-foreground font-medium">{metric.label}</div>
                        <div className="text-sm sm:text-base font-bold tracking-tight">{metric.value}</div>
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
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        )}
                                    >
                                        {call.status === 'completed' ? 'Completed' : 'In Progress'}
                                    </span>
                                </td>
                                <td className="py-1.5 text-right font-mono text-muted-foreground">{call.duration}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
