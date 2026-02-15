'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Send, Sparkles, Loader2, Bot, MessageSquare, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LLMBuilderResponse } from '@/lib/agent-builder/types';

const STARTER_PROMPTS = [
    {
        title: 'Dental Receptionist',
        prompt: 'Create a dental office receptionist that books appointments, answers insurance questions, and handles rescheduling.',
    },
    {
        title: 'Real Estate Assistant',
        prompt: 'Create a real estate assistant that qualifies buyers by budget, schedules property showings, and captures lead details.',
    },
    {
        title: 'Sales Follow-up',
        prompt: 'Create a sales follow-up agent that calls leads, qualifies interest, answers product questions, and books demos.',
    },
    {
        title: 'Customer Support',
        prompt: 'Create a customer support agent that handles inquiries, troubleshoots issues, and escalates to humans when needed.',
    },
];

interface AgentPreview {
    name?: string;
    firstMessage?: string;
    voiceCharacteristics?: {
        gender?: string;
        tone?: string;
        ageRange?: string;
        accent?: string;
    };
    systemPromptExcerpt?: string;
}

export function AgentPreviewDemo() {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [preview, setPreview] = useState<AgentPreview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [remaining, setRemaining] = useState<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const handleGenerate = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isGenerating) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setIsGenerating(true);
        setError(null);
        setStreamingText('');
        setPreview(null);

        try {
            const response = await fetch('/api/landing/generate-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: trimmed }),
                signal: controller.signal,
            });

            const remainingHeader = response.headers.get('X-RateLimit-Remaining');
            if (remainingHeader !== null) {
                setRemaining(parseInt(remainingHeader, 10));
            }

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                if (response.status === 429) {
                    setError('You\'ve reached the preview limit. Sign up for unlimited access.');
                } else {
                    setError(data.error || 'Something went wrong. Please try again.');
                }
                return;
            }

            if (!response.body) {
                throw new Error('No response stream');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullMessage = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const chunk = JSON.parse(line);

                        if (chunk.type === 'text_delta') {
                            fullMessage += chunk.text;
                            setStreamingText(fullMessage);
                        } else if (chunk.type === 'result') {
                            const result = chunk.data as LLMBuilderResponse;
                            setPreview({
                                name: result.updates?.name,
                                firstMessage: result.updates?.firstMessage,
                                voiceCharacteristics: result.updates?.voiceCharacteristics ? {
                                    gender: result.updates.voiceCharacteristics.gender ?? undefined,
                                    tone: result.updates.voiceCharacteristics.tone ?? undefined,
                                    ageRange: result.updates.voiceCharacteristics.ageRange ?? undefined,
                                    accent: result.updates.voiceCharacteristics.accent ?? undefined,
                                } : undefined,
                                systemPromptExcerpt: result.updates?.systemPrompt
                                    ? result.updates.systemPrompt.slice(0, 200) + (result.updates.systemPrompt.length > 200 ? '...' : '')
                                    : undefined,
                            });
                        } else if (chunk.type === 'error') {
                            throw new Error(chunk.error);
                        }
                    } catch (parseError) {
                        if (parseError instanceof SyntaxError) continue;
                        throw parseError;
                    }
                }
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setIsGenerating(false);
        }
    }, [isGenerating]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleGenerate(prompt);
    };

    const handleStarterClick = (starterPrompt: string) => {
        setPrompt(starterPrompt);
        handleGenerate(starterPrompt);
    };

    const showResults = isGenerating || streamingText || preview;

    return (
        <div className="space-y-3">
            {/* Prompt input */}
            <form onSubmit={handleSubmit}>
                <div className="relative rounded-xl border border-border bg-card shadow-sm">
                    <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="A dental receptionist that books appointments and answers FAQs..."
                        className="w-full resize-none rounded-lg bg-transparent px-4 py-3.5 pr-14 text-base placeholder:text-muted-foreground/50 focus:outline-none min-h-[56px] max-h-[120px]"
                        rows={2}
                        maxLength={500}
                        disabled={isGenerating}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleGenerate(prompt);
                            }
                        }}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={!prompt.trim() || isGenerating}
                        className="absolute right-2.5 bottom-2.5 h-8 w-8 rounded-md"
                    >
                        {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </form>

            {/* Starter chips */}
            {!showResults && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                    {STARTER_PROMPTS.map((starter) => (
                        <button
                            key={starter.title}
                            onClick={() => handleStarterClick(starter.prompt)}
                            className="px-3 py-1 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                            {starter.title}
                        </button>
                    ))}
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center space-y-3">
                    <p className="text-sm text-destructive">{error}</p>
                    {error.includes('limit') && (
                        <Button size="sm" asChild>
                            <Link href="/signup">
                                Sign up for free <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                        </Button>
                    )}
                </div>
            )}

            {/* Streaming / Preview result */}
            {showResults && !error && (
                <Card className="overflow-hidden">
                    <CardContent className="p-0">
                        {/* Agent header */}
                        <div className="px-4 py-3 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center">
                                    <Bot className="h-4 w-4 text-foreground/60" />
                                </div>
                                <div>
                                    {preview?.name ? (
                                        <h3 className="font-medium">{preview.name}</h3>
                                    ) : isGenerating ? (
                                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                                    ) : null}
                                    {preview?.voiceCharacteristics && (
                                        <div className="flex gap-1 mt-0.5">
                                            {preview.voiceCharacteristics.gender && (
                                                <Badge variant="secondary" className="text-xs font-normal">
                                                    {preview.voiceCharacteristics.gender}
                                                </Badge>
                                            )}
                                            {preview.voiceCharacteristics.tone && (
                                                <Badge variant="secondary" className="text-xs font-normal">
                                                    {preview.voiceCharacteristics.tone}
                                                </Badge>
                                            )}
                                            {preview.voiceCharacteristics.accent && (
                                                <Badge variant="secondary" className="text-xs font-normal">
                                                    {preview.voiceCharacteristics.accent}
                                                </Badge>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-4 py-3 space-y-3">
                            {isGenerating && !preview && (
                                <div className="flex items-start gap-2">
                                    <Sparkles className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-muted-foreground">
                                        {streamingText ? (
                                            <p className="whitespace-pre-wrap">{streamingText}</p>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Designing your agent...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {preview?.firstMessage && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                        <MessageSquare className="h-3 w-3" />
                                        Sample greeting
                                    </div>
                                    <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                                        {preview.firstMessage}
                                    </p>
                                </div>
                            )}

                            {preview?.systemPromptExcerpt && (
                                <div className="space-y-1.5">
                                    <div className="text-xs text-muted-foreground font-medium">
                                        Personality
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {preview.systemPromptExcerpt}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* CTA */}
                        {preview && !isGenerating && (
                            <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground">
                                    Ready to deploy this agent?
                                </p>
                                <Button size="sm" asChild>
                                    <Link href="/signup">
                                        Sign up to create it
                                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Remaining hint */}
            {remaining !== null && remaining > 0 && remaining < 3 && !error && (
                <p className="text-center text-xs text-muted-foreground">
                    {remaining} preview{remaining === 1 ? '' : 's'} remaining &middot;{' '}
                    <Link href="/signup" className="underline hover:text-foreground">
                        Sign up for unlimited
                    </Link>
                </p>
            )}
        </div>
    );
}
