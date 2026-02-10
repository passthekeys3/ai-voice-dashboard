'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AgentBuilderVoiceCard } from './AgentBuilderVoiceCard';
import type { BuilderMessage, VoiceRecommendation } from '@/lib/agent-builder/types';

interface AgentBuilderChatProps {
    messages: BuilderMessage[];
    isStreaming: boolean;
    onSendMessage: (content: string) => void;
    voiceRecommendations: VoiceRecommendation[];
    selectedVoiceId: string;
    onVoiceSelect: (voiceId: string, voiceName: string) => void;
    error: string | null;
}

const QUICK_ACTIONS = [
    { label: 'Make it more friendly', icon: '😊' },
    { label: 'Add appointment booking', icon: '📅' },
    { label: 'Make it more professional', icon: '👔' },
    { label: 'Add call transfer handling', icon: '📞' },
];

const STARTER_PROMPTS = [
    {
        title: 'Dental Receptionist',
        description: 'Books appointments, answers insurance questions, handles rescheduling',
        prompt: 'Create a dental office receptionist agent that books appointments, answers questions about services and insurance, and handles rescheduling.',
        icon: '🦷',
    },
    {
        title: 'Real Estate Agent',
        description: 'Qualifies property inquiries, schedules showings, captures lead details',
        prompt: 'Create a real estate assistant agent that answers property inquiries, qualifies buyers by budget and timeline, schedules property showings, and captures lead contact information for follow-up.',
        icon: '🏠',
    },
    {
        title: 'Sales Follow-up',
        description: 'Follows up with leads, qualifies interest, and books demos',
        prompt: 'Create a sales follow-up agent that calls leads, qualifies their interest, answers product questions, and books demos with the sales team.',
        icon: '📈',
    },
    {
        title: 'Insurance Qualifier',
        description: 'Handles policy inquiries, qualifies prospects, and schedules consultations',
        prompt: 'Create an insurance intake agent that handles policy inquiries, qualifies prospects by asking about coverage type, current provider, and budget, and schedules consultations with agents.',
        icon: '🛡️',
    },
    {
        title: 'Customer Support',
        description: 'Handles inquiries, troubleshoots issues, escalates to humans',
        prompt: 'Create a customer support agent that handles common inquiries, troubleshoots issues, and escalates complex problems to human agents.',
        icon: '💬',
    },
    {
        title: 'Home Services Dispatcher',
        description: 'Takes service requests, classifies urgency, schedules appointments',
        prompt: 'Create a home services dispatcher agent for an HVAC/plumbing company that takes service requests, classifies emergency vs routine calls, collects property details, and schedules technician appointments.',
        icon: '🔧',
    },
];

export function AgentBuilderChat({
    messages,
    isStreaming,
    onSendMessage,
    voiceRecommendations,
    selectedVoiceId,
    onVoiceSelect,
    error,
}: AgentBuilderChatProps) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Compute last assistant message ID once (not inside the .map loop)
    const lastAssistantId = useMemo(
        () => messages.findLast(m => m.role === 'assistant')?.id,
        [messages]
    );

    // Auto-scroll: use 'auto' during streaming to avoid animation queue
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: isStreaming ? 'auto' : 'smooth',
        });
    }, [messages.length, isStreaming]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        // Auto-resize textarea
        const ta = e.target;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }, []);

    const handleSend = useCallback(() => {
        if (!input.trim() || isStreaming) return;
        onSendMessage(input);
        setInput('');
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [input, isStreaming, onSendMessage]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleQuickAction = useCallback((text: string) => {
        if (isStreaming) return;
        onSendMessage(text);
    }, [isStreaming, onSendMessage]);

    const isEmpty = messages.length === 0;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                        <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-sm">AI Agent Builder</h2>
                        <p className="text-xs text-muted-foreground">
                            Describe your agent and I&apos;ll build it for you
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" role="log" aria-live="polite">
                {isEmpty ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-6 py-8">
                        <div className="text-center space-y-2">
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/10 inline-block">
                                <Sparkles className="h-8 w-8 text-violet-500" />
                            </div>
                            <h3 className="text-lg font-semibold mt-3">Build your AI voice agent</h3>
                            <p className="text-sm text-muted-foreground max-w-md">
                                Describe what your agent should do, and I&apos;ll generate the system prompt,
                                recommend a voice, and set up integrations.
                            </p>
                        </div>

                        {/* Starter templates */}
                        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {STARTER_PROMPTS.map((starter) => (
                                <button
                                    key={starter.title}
                                    onClick={() => handleQuickAction(starter.prompt)}
                                    className="w-full text-left p-3 rounded-xl border border-border hover:border-violet-500/50 hover:bg-violet-500/5 transition-all duration-200 group"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">{starter.icon}</span>
                                        <span className="font-medium text-sm group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                                            {starter.title}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 pl-7">
                                        {starter.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((message) => (
                            <div key={message.id}>
                                <MessageBubble message={message} />

                                {/* Show voice recommendations after the last assistant message */}
                                {message.role === 'assistant' &&
                                    voiceRecommendations.length > 0 &&
                                    message.id === lastAssistantId && (
                                        <div className="mt-3 ml-10">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                                Recommended voices
                                            </p>
                                            <div className="space-y-2" role="listbox" aria-label="Voice recommendations">
                                                {voiceRecommendations.map((voice) => (
                                                    <AgentBuilderVoiceCard
                                                        key={voice.voice_id}
                                                        voice={voice}
                                                        isSelected={selectedVoiceId === voice.voice_id}
                                                        onSelect={() => onVoiceSelect(voice.voice_id, voice.name)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                            </div>
                        ))}

                        {/* Streaming indicator */}
                        {isStreaming && messages[messages.length - 1]?.content === '' && (
                            <div className="flex items-center gap-2 text-muted-foreground pl-10">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span className="text-xs">Thinking...</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="flex-shrink-0 px-6 pb-2">
                    <div role="alert" className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">
                        {error}
                    </div>
                </div>
            )}

            {/* Quick actions (show after first exchange) */}
            {!isEmpty && !isStreaming && (
                <div className="flex-shrink-0 px-6 pb-2">
                    <div className="flex flex-wrap gap-1.5">
                        {QUICK_ACTIONS.map((action) => (
                            <button
                                key={action.label}
                                onClick={() => handleQuickAction(action.label)}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border hover:border-violet-500/50 hover:bg-violet-500/5 text-muted-foreground hover:text-foreground transition-all"
                            >
                                <span>{action.icon}</span>
                                <span>{action.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="flex-shrink-0 p-4 border-t border-border">
                <div className="flex gap-2 items-end">
                    <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={isEmpty
                            ? 'Describe your AI agent... (e.g., "A friendly dental receptionist that books appointments")'
                            : 'Ask for changes or refinements...'
                        }
                        className="min-h-[44px] max-h-[120px] resize-none"
                        disabled={isStreaming}
                        rows={1}
                    />
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={!input.trim() || isStreaming}
                        className="flex-shrink-0 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                        aria-label="Send message"
                    >
                        {isStreaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function MessageBubble({ message }: { message: BuilderMessage }) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
            )}
            <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                }`}
            >
                {message.content || (
                    <span className="text-muted-foreground italic">Generating...</span>
                )}
            </div>
        </div>
    );
}
