'use client';

import { Sparkles, Send, Play, Bot, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Mock Data ─── */

const STARTER_TEMPLATES = [
    { emoji: '🦷', label: 'Dental' },
    { emoji: '🏠', label: 'Real Estate' },
    { emoji: '💼', label: 'Sales' },
    { emoji: '🎧', label: 'Support' },
];

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
                'flex animate-fade-up',
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
                <div className="flex-shrink-0 mr-1.5 mt-1">
                    <div className="p-1 rounded-md bg-violet-100 dark:bg-violet-900/30">
                        <Sparkles className="h-2.5 w-2.5 text-violet-600 dark:text-violet-400" />
                    </div>
                </div>
            )}
            <div
                className={cn(
                    'rounded-lg px-2.5 py-1.5 max-w-[85%]',
                    isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted'
                )}
            >
                <p className="text-[9px] leading-relaxed">{message.text}</p>
            </div>
        </div>
    );
}

function StarterTemplateGrid({ isInView }: { isInView: boolean }) {
    return (
        <div
            className="grid grid-cols-2 gap-1.5 animate-fade-up"
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: '300ms',
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            {STARTER_TEMPLATES.map((tmpl) => (
                <div
                    key={tmpl.label}
                    className="flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1.5 bg-card hover:bg-muted/50 transition-colors cursor-default"
                >
                    <span className="text-[11px]">{tmpl.emoji}</span>
                    <span className="text-[9px] font-medium truncate">{tmpl.label}</span>
                </div>
            ))}
        </div>
    );
}

function PreviewPanel({ isInView }: { isInView: boolean }) {
    return (
        <div
            className="hidden sm:flex flex-col border-l border-border/50 bg-muted/20 p-3 animate-fade-up"
            style={{
                opacity: isInView ? undefined : 0,
                animationDelay: '500ms',
                animationFillMode: 'both',
                animationPlayState: isInView ? 'running' : 'paused',
            }}
        >
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Preview
            </div>

            {/* Agent name */}
            <div className="space-y-1 mb-3">
                <label className="text-[9px] font-medium text-muted-foreground">Agent Name</label>
                <div className="rounded-md border border-border bg-card px-2 py-1.5">
                    <span className="text-[10px] font-medium">Sarah &mdash; Dental Receptionist</span>
                </div>
            </div>

            {/* Voice */}
            <div className="space-y-1 mb-3">
                <label className="text-[9px] font-medium text-muted-foreground">Voice</label>
                <div className="rounded-md border border-border bg-card px-2 py-1.5 flex items-center justify-between">
                    <span className="text-[10px]">Chloe &mdash; Warm, Professional</span>
                    <Play className="h-2.5 w-2.5 text-muted-foreground" />
                </div>
            </div>

            {/* First message */}
            <div className="space-y-1 mb-4">
                <label className="text-[9px] font-medium text-muted-foreground">First Message</label>
                <div className="rounded-md border border-border bg-card px-2 py-2">
                    <p className="text-[9px] leading-relaxed text-muted-foreground italic">
                        &ldquo;Hi! I&apos;m Sarah from Bright Smiles Dental. How can I help you today?&rdquo;
                    </p>
                </div>
            </div>

            {/* Create button */}
            <div className="mt-auto">
                <div className="w-full rounded-md bg-gradient-to-r from-blue-500 to-blue-600 text-white text-center py-1.5">
                    <span className="text-[10px] font-medium flex items-center justify-center gap-1.5">
                        <Bot className="h-3 w-3" />
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
        <div className="flex aspect-[16/10]">
            {/* Chat panel */}
            <div className="flex-1 flex flex-col p-3 min-w-0">
                {/* Header */}
                <div
                    className="flex items-center gap-2 mb-3 animate-fade-up"
                    style={{
                        opacity: isInView ? undefined : 0,
                        animationDelay: '100ms',
                        animationFillMode: 'both',
                        animationPlayState: isInView ? 'running' : 'paused',
                    }}
                >
                    <div className="p-1.5 rounded-md bg-gradient-to-br from-violet-500 to-purple-600">
                        <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <div>
                        <div className="text-[11px] font-semibold">Agent Builder</div>
                        <div className="text-[9px] text-muted-foreground">Describe your agent to get started</div>
                    </div>
                </div>

                {/* Starter templates */}
                <StarterTemplateGrid isInView={isInView} />

                {/* Chat messages */}
                <div className="flex-1 space-y-2 mt-3 overflow-hidden">
                    {CHAT_MESSAGES.map((msg, i) => (
                        <ChatBubble key={i} message={msg} index={i} isInView={isInView} />
                    ))}
                </div>

                {/* Input bar */}
                <div
                    className="flex items-center gap-1.5 mt-2 rounded-lg border border-border bg-card px-2 py-1.5 animate-fade-up"
                    style={{
                        opacity: isInView ? undefined : 0,
                        animationDelay: '200ms',
                        animationFillMode: 'both',
                        animationPlayState: isInView ? 'running' : 'paused',
                    }}
                >
                    <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 text-[9px] text-muted-foreground">Describe your agent...</span>
                    <div className="p-1 rounded-md bg-blue-600">
                        <Send className="h-2.5 w-2.5 text-white" />
                    </div>
                </div>
            </div>

            {/* Preview panel (desktop only) */}
            <PreviewPanel isInView={isInView} />
        </div>
    );
}
