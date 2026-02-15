'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
        icon: '\uD83E\uDDB7',
    },
    {
        title: 'Real Estate Assistant',
        prompt: 'Create a real estate assistant that qualifies buyers by budget, schedules property showings, and captures lead details.',
        icon: '\uD83C\uDFE0',
    },
    {
        title: 'Sales Follow-up',
        prompt: 'Create a sales follow-up agent that calls leads, qualifies interest, answers product questions, and books demos.',
        icon: '\uD83D\uDCC8',
    },
    {
        title: 'Customer Support',
        prompt: 'Create a customer support agent that handles inquiries, troubleshoots issues, and escalates to humans when needed.',
        icon: '\uD83D\uDCAC',
    },
];

const PLACEHOLDER_EXAMPLES = [
    'A dental receptionist that books appointments and answers FAQs...',
    'A real estate assistant that qualifies leads and schedules showings...',
    'A sales follow-up agent that books demos with warm leads...',
    'A customer support agent for a SaaS product...',
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
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Cycle placeholder text
    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleGenerate = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isGenerating) return;

        // Cancel previous request
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

            // Check rate limit remaining
            const remainingHeader = response.headers.get('X-RateLimit-Remaining');
            if (remainingHeader !== null) {
                setRemaining(parseInt(remainingHeader, 10));
            }

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                if (response.status === 429) {
                    setError('You\'ve reached the preview limit. Sign up for unlimited access!');
                } else {
                    setError(data.error || 'Something went wrong. Please try again.');
                }
                return;
            }

            if (!response.body) {
                throw new Error('No response stream');
            }

            // Read NDJSON stream
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
        <div className="space-y-4">
            {/* Prompt input */}
            <form onSubmit={handleSubmit} className="relative">
                <div className="relative rounded-xl border border-border bg-card shadow-lg animate-glow-pulse">
                    <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={PLACEHOLDER_EXAMPLES[placeholderIndex]}
                        className="w-full resize-none rounded-xl bg-transparent px-4 py-4 pr-14 text-base placeholder:text-muted-foreground/60 focus:outline-none min-h-[60px] max-h-[120px]"
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
                        className="absolute right-3 bottom-3 h-9 w-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-white shadow-md"
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
                <div className="flex flex-wrap gap-2 justify-center animate-fade-in">
                    {STARTER_PROMPTS.map((starter) => (
                        <button
                            key={starter.title}
                            onClick={() => handleStarterClick(starter.prompt)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <span>{starter.icon}</span>
                            {starter.title}
                        </button>
                    ))}
                </div>
            )}

            {/* Error state */}
            {error && (
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4 text-center space-y-3">
                        <p className="text-sm text-destructive">{error}</p>
                        {error.includes('limit') && (
                            <Button
                                size="sm"
                                className="bg-violet-600 hover:bg-violet-700 text-white"
                                asChild
                            >
                                <Link href="/signup">
                                    Sign up for free <ArrowRight className="ml-1 h-3 w-3" />
                                </Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Streaming / Preview result */}
            {showResults && !error && (
                <Card className="overflow-hidden animate-slide-up">
                    <CardContent className="p-0">
                        {/* Agent header */}
                        <div className="p-4 border-b border-border bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                    <Bot className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    {preview?.name ? (
                                        <h3 className="font-semibold text-lg">{preview.name}</h3>
                                    ) : isGenerating ? (
                                        <div className="h-5 w-40 bg-muted animate-pulse rounded" />
                                    ) : null}
                                    {preview?.voiceCharacteristics && (
                                        <div className="flex gap-1.5 mt-1">
                                            {preview.voiceCharacteristics.gender && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {preview.voiceCharacteristics.gender}
                                                </Badge>
                                            )}
                                            {preview.voiceCharacteristics.tone && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {preview.voiceCharacteristics.tone}
                                                </Badge>
                                            )}
                                            {preview.voiceCharacteristics.accent && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {preview.voiceCharacteristics.accent}
                                                </Badge>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Streaming text / conversation message */}
                        <div className="p-4 space-y-3">
                            {isGenerating && !preview && (
                                <div className="flex items-start gap-2">
                                    <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-muted-foreground">
                                        {streamingText ? (
                                            <p className="whitespace-pre-wrap">{streamingText}</p>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Designing your agent...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {preview?.firstMessage && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                        <MessageSquare className="h-3 w-3" />
                                        Sample greeting
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3 text-sm italic">
                                        &ldquo;{preview.firstMessage}&rdquo;
                                    </div>
                                </div>
                            )}

                            {preview?.systemPromptExcerpt && (
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
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
                            <div className="p-4 border-t border-border bg-muted/20">
                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                    <p className="text-sm text-muted-foreground">
                                        Ready to bring this agent to life?
                                    </p>
                                    <Button
                                        className="bg-violet-600 hover:bg-violet-700 text-white w-full sm:w-auto"
                                        asChild
                                    >
                                        <Link href="/signup">
                                            Sign up to create this agent
                                            <ArrowRight className="ml-1.5 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Remaining generations hint */}
            {remaining !== null && remaining > 0 && remaining < 3 && !error && (
                <p className="text-center text-xs text-muted-foreground">
                    {remaining} preview{remaining === 1 ? '' : 's'} remaining &middot;{' '}
                    <Link href="/signup" className="text-violet-600 dark:text-violet-400 hover:underline">
                        Sign up for unlimited
                    </Link>
                </p>
            )}
        </div>
    );
}
