'use client';

import { Sparkles, Send, MessageSquare, Mic, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Mock Data ─── */

const CHAT_MESSAGES = [
    {
        role: 'user' as const,
        text: 'Build a dental receptionist that books appointments',
    },
    {
        role: 'assistant' as const,
        text: "I'll create an agent that handles appointment scheduling, insurance verification, and patient intake. Let me set up the voice and script...",
    },
];

/* ─── Sub-components ─── */

function ChatBubble({ message, index, isInView }: { message: typeof CHAT_MESSAGES[number]; index: number; isInView: boolean }) {
    const isUser = message.role === 'user';

    return (
        <div
            className={cn(
                'flex gap-2 animate-fade-up',
                isUser ? 'justify-end' : 'justify-start'
            )}
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: `${600 + index * 250}ms`,
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            {!isUser && (
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center mt-1">
                    <Sparkles className="h-2.5 w-2.5 text-white" />
                </div>
            )}
            <div
                className={cn(
                    'max-w-[85%] px-3 py-2',
                    isUser
                        ? 'rounded-2xl bg-primary text-primary-foreground'
                        : 'rounded-2xl bg-muted'
                )}
            >
                <p className="text-[9px] leading-relaxed">{message.text}</p>
            </div>
        </div>
    );
}

function PreviewPanel({ isInView }: { isInView: boolean }) {
    return (
        <div
            className="hidden sm:flex flex-col border-l border-border bg-slate-50 dark:bg-slate-950 p-3 animate-fade-up"
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: '500ms',
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Preview
                </div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    Draft
                </span>
            </div>

            {/* Agent name */}
            <div className="space-y-1 mb-3">
                <label className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Bot className="h-2.5 w-2.5" />
                    Agent Name
                </label>
                <div className="rounded-md border border-border bg-card px-2 py-1.5">
                    <span className="text-[10px] font-medium">Sarah &mdash; Dental Receptionist</span>
                </div>
            </div>

            {/* Voice */}
            <div className="space-y-1 mb-3">
                <label className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Mic className="h-2.5 w-2.5" />
                    Voice
                </label>
                <div className="rounded-md border border-border bg-card px-2 py-1.5 flex items-center justify-between">
                    <span className="text-[10px]">Chloe &mdash; Warm, Professional</span>
                </div>
            </div>

            {/* Provider */}
            <div className="space-y-1 mb-3">
                <label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Provider</label>
                <div className="flex gap-1">
                    <div className="flex-1 text-[9px] px-2 py-1 rounded-md border border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium text-center">
                        Retell
                    </div>
                    <div className="flex-1 text-[9px] px-2 py-1 rounded-md border border-input bg-background text-muted-foreground text-center">
                        Vapi
                    </div>
                    <div className="flex-1 text-[9px] px-2 py-1 rounded-md border border-input bg-background text-muted-foreground text-center">
                        Bland
                    </div>
                </div>
            </div>

            {/* First message */}
            <div className="space-y-1 mb-4">
                <label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">First Message</label>
                <div className="rounded-md border border-border bg-card px-2 py-2">
                    <p className="text-[9px] leading-relaxed text-muted-foreground italic">
                        &ldquo;Hi! I&apos;m Sarah from Bright Smiles Dental. How can I help you today?&rdquo;
                    </p>
                </div>
            </div>

            {/* Create button */}
            <div className="mt-auto">
                <div className="w-full rounded-md bg-violet-600 text-white text-center py-1.5">
                    <span className="text-[10px] font-medium flex items-center justify-center gap-1.5">
                        <Sparkles className="h-3 w-3" />
                        Create Agent
                    </span>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Component ─── */

interface BuilderMockupProps {
    isInView: boolean;
}

export function BuilderMockup({ isInView }: BuilderMockupProps) {
    return (
        <div className="flex aspect-[16/12]">
            {/* Chat panel */}
            <div className="flex-1 flex flex-col p-3 min-w-0 border-r border-border/50 sm:max-w-[55%]">
                {/* Header */}
                <div
                    className="flex items-center gap-2 mb-3 pb-3 border-b border-border animate-fade-up"
                    style={{
                        opacity: isInView ? undefined : 0,
                        animationDelay: '100ms',
                        animationFillMode: 'both',
                        animationPlayState: isInView ? 'running' : 'paused',
                    }}
                >
                    <div className="p-1.5 rounded-lg bg-violet-600">
                        <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <div>
                        <div className="text-[11px] font-semibold">Agent Builder</div>
                        <div className="text-[9px] text-muted-foreground">Describe your agent to get started</div>
                    </div>
                </div>

                {/* Chat messages */}
                <div className="flex-1 space-y-2.5 mt-1 overflow-hidden">
                    {CHAT_MESSAGES.map((msg, i) => (
                        <ChatBubble key={i} message={msg} index={i} isInView={isInView} />
                    ))}
                </div>

                {/* Input bar */}
                <div
                    className="flex items-center gap-1.5 mt-2 rounded-lg border border-border bg-card px-2.5 py-2 animate-fade-up"
                    style={{
                        opacity: isInView ? undefined : 0,
                        animationDelay: '200ms',
                        animationFillMode: 'both',
                        animationPlayState: isInView ? 'running' : 'paused',
                    }}
                >
                    <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 text-[9px] text-muted-foreground">Describe your agent...</span>
                    <div className="p-1 rounded-md bg-violet-600">
                        <Send className="h-2.5 w-2.5 text-white" />
                    </div>
                </div>
            </div>

            {/* Preview panel (desktop only) */}
            <PreviewPanel isInView={isInView} />
        </div>
    );
}
