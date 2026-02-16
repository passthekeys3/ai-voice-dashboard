'use client';

import {
    Zap,
    Building2,
    Calendar,
    Send,
    ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Flow Card Data ─── */

interface FlowCard {
    type: 'trigger' | 'action';
    icon: typeof Zap;
    title: string;
    subtitle: string;
    detail?: string;
    theme: 'amber' | 'blue' | 'green' | 'purple';
}

const FLOW_CARDS: FlowCard[] = [
    {
        type: 'trigger',
        icon: Zap,
        title: 'When Call Ends',
        subtitle: 'Trigger on completed calls',
        detail: 'Status = Completed',
        theme: 'amber',
    },
    {
        type: 'action',
        icon: Building2,
        title: 'Update CRM Contact',
        subtitle: 'GoHighLevel',
        detail: 'Add tag: ai_qualified',
        theme: 'blue',
    },
    {
        type: 'action',
        icon: Calendar,
        title: 'Book Appointment',
        subtitle: 'Calendly',
        detail: 'Next available slot',
        theme: 'green',
    },
    {
        type: 'action',
        icon: Send,
        title: 'Send Follow-up SMS',
        subtitle: 'Twilio',
        detail: 'Confirmation message',
        theme: 'purple',
    },
];

const themeColors = {
    amber: {
        border: 'border-l-amber-500',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        iconColor: 'text-amber-600 dark:text-amber-400',
        pillBg: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    },
    blue: {
        border: 'border-l-blue-500',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        iconColor: 'text-blue-600 dark:text-blue-400',
        pillBg: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    },
    green: {
        border: 'border-l-green-500',
        iconBg: 'bg-green-100 dark:bg-green-900/30',
        iconColor: 'text-green-600 dark:text-green-400',
        pillBg: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    },
    purple: {
        border: 'border-l-purple-500',
        iconBg: 'bg-purple-100 dark:bg-purple-900/30',
        iconColor: 'text-purple-600 dark:text-purple-400',
        pillBg: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    },
} as const;

/* ─── Sub-components ─── */

function FlowCardItem({ card, index, isInView }: { card: FlowCard; index: number; isInView: boolean }) {
    const colors = themeColors[card.theme];

    return (
        <div
            className={cn(
                'rounded-lg border border-border bg-card overflow-hidden border-l-[3px] p-2.5',
                colors.border,
                'animate-fade-up transition-transform duration-200 hover:-translate-y-0.5'
            )}
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: `${200 + index * 180}ms`,
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            <div className="flex items-start gap-2">
                <div className={cn('p-1.5 rounded-md flex-shrink-0', colors.iconBg)}>
                    <card.icon className={cn('h-3 w-3', colors.iconColor)} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold">{card.title}</span>
                        {card.type === 'trigger' && (
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                Trigger
                            </span>
                        )}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">{card.subtitle}</div>
                    {card.detail && (
                        <div className={cn('inline-flex items-center mt-1.5 px-1.5 py-0.5 rounded text-[8px] font-medium', colors.pillBg)}>
                            {card.detail}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Connector({ index, isInView }: { index: number; isInView: boolean }) {
    return (
        <div
            className="flex flex-col items-center py-0.5 animate-fade-up"
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: `${350 + index * 180}ms`,
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            <div className="w-px h-3 border-l border-dashed border-muted-foreground/30" />
            <ChevronDown className="h-3 w-3 text-muted-foreground/40 -my-0.5" />
        </div>
    );
}

/* ─── Main Component ─── */

interface WorkflowsMockupProps {
    isInView: boolean;
}

export function WorkflowsMockup({ isInView }: WorkflowsMockupProps) {
    return (
        <div className="p-3 sm:p-4">
            {/* Header */}
            <div
                className="flex items-center justify-between mb-3 animate-fade-up"
                style={{
                    opacity: isInView ? undefined : 0,
                    animationDelay: '100ms',
                    animationFillMode: 'both',
                    animationPlayState: isInView ? 'running' : 'paused',
                }}
            >
                <div>
                    <div className="text-[11px] font-semibold">Post-Call Workflow</div>
                    <div className="text-[9px] text-muted-foreground">Automate actions after every call</div>
                </div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Active
                </span>
            </div>

            {/* Flow cards with connectors */}
            <div className="max-w-sm mx-auto">
                {FLOW_CARDS.map((card, index) => (
                    <div key={card.title}>
                        {index > 0 && <Connector index={index} isInView={isInView} />}
                        <FlowCardItem card={card} index={index} isInView={isInView} />
                    </div>
                ))}
            </div>
        </div>
    );
}
