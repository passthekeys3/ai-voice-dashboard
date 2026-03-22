'use client';

import {
    Zap,
    Building2,
    Calendar,
    Send,
    ChevronDown,
    Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Flow Card Data ─── */

interface FlowCard {
    type: 'trigger' | 'action';
    icon: typeof Zap;
    title: string;
    subtitle: string;
    detail?: string;
}

const FLOW_CARDS: FlowCard[] = [
    {
        type: 'trigger',
        icon: Zap,
        title: 'When Call Ends',
        subtitle: 'Trigger on completed calls',
        detail: 'Status = Completed',
    },
    {
        type: 'action',
        icon: Building2,
        title: 'Update CRM Contact',
        subtitle: 'GoHighLevel',
        detail: 'Add tag: ai_qualified',
    },
    {
        type: 'action',
        icon: Calendar,
        title: 'Book Appointment',
        subtitle: 'Calendly',
        detail: 'Next available slot',
    },
    {
        type: 'action',
        icon: Send,
        title: 'Send Follow-up SMS',
        subtitle: 'Twilio',
        detail: 'Confirmation message',
    },
];

/* ─── Sub-components ─── */

function FlowCardItem({ card, index, isInView }: { card: FlowCard; index: number; isInView: boolean }) {
    return (
        <div
            className={cn(
                'rounded-lg border border-border bg-card overflow-hidden p-2.5',
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
                <div className="p-1.5 rounded-md bg-muted flex-shrink-0">
                    <card.icon className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold">{card.title}</span>
                        {card.type === 'trigger' && (
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
                                Trigger
                            </span>
                        )}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">{card.subtitle}</div>
                    {card.detail && (
                        <div className="inline-flex items-center mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-foreground">
                            {card.detail}
                        </div>
                    )}
                </div>
                <Settings2 className="h-3 w-3 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
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
                <div className="text-[11px] font-semibold">Post-Call Workflow</div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-muted text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
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
