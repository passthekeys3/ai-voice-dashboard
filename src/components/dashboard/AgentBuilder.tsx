'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AgentBuilderChat } from './AgentBuilderChat';
import { AgentBuilderPreview } from './AgentBuilderPreview';
import type {
    AgentDraft,
    BuilderMessage,
    BuilderContext,
    LLMBuilderResponse,
    VoiceRecommendation,
    VoiceCharacteristics,
    IntegrationSelection,
} from '@/lib/agent-builder/types';
import { getAvailableTemplates } from '@/lib/agent-builder/templates';
import { matchVoicesToDescription } from '@/lib/agent-builder/llm';

interface AgentBuilderProps {
    clients: { id: string; name: string; hasRetellKey?: boolean; hasVapiKey?: boolean; hasBlandKey?: boolean }[];
    phoneNumbers: { id: string; phone_number: string; nickname?: string; agent_id?: string | null }[];
    context: BuilderContext;
    availableProviders: ('retell' | 'vapi' | 'bland')[];
}

let messageIdCounter = 0;
function generateMessageId(role: string) {
    return `msg-${Date.now()}-${++messageIdCounter}-${role}`;
}

export function AgentBuilder({ clients, phoneNumbers, context, availableProviders }: AgentBuilderProps) {
    const router = useRouter();
    const defaultProvider = availableProviders[0] || 'retell';
    const [messages, setMessages] = useState<BuilderMessage[]>([]);
    const [draft, setDraft] = useState<AgentDraft>({
        name: '',
        provider: defaultProvider,
        systemPrompt: '',
        firstMessage: '',
        voiceId: '',
        voiceName: '',
        language: 'en',
        integrations: [],
    });
    const [isStreaming, setIsStreaming] = useState(false);
    const [voiceRecommendations, setVoiceRecommendations] = useState<VoiceRecommendation[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs for latest state (avoids stale closures in async callbacks)
    const messagesRef = useRef<BuilderMessage[]>([]);
    messagesRef.current = messages;
    const draftRef = useRef<AgentDraft>(draft);
    draftRef.current = draft;

    // AbortController for cancelling in-flight stream requests
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    // Memoize available templates (stable reference)
    const availableTemplates = useMemo(
        () => getAvailableTemplates(context.hasGHL, context.hasHubSpot, context.hasGCal, context.hasCalendly, context.hasSlack),
        [context.hasGHL, context.hasHubSpot, context.hasGCal, context.hasCalendly, context.hasSlack]
    );

    const fetchAndMatchVoices = useCallback(async (characteristics: VoiceCharacteristics, provider?: string) => {
        try {
            const providerParam = provider || draftRef.current.provider;
            const url = providerParam ? `/api/voices?provider=${providerParam}` : '/api/voices';
            const response = await fetch(url);
            if (!response.ok) return;

            const { data: voices } = await response.json();
            if (!voices || voices.length === 0) return;

            // Reuse shared scoring logic (includes gender, accent, age-range, and preview bonus)
            const topVoices = matchVoicesToDescription(characteristics, voices);

            setVoiceRecommendations(topVoices);

            // Auto-select the top voice only if none currently selected (via functional setter)
            if (topVoices.length > 0) {
                setDraft(prev => {
                    if (!prev.voiceId) {
                        return {
                            ...prev,
                            voiceId: topVoices[0].voice_id,
                            voiceName: topVoices[0].name,
                        };
                    }
                    return prev;
                });
            }
        } catch (err) {
            console.error('Failed to fetch voices:', err);
        }
    }, []);

    const handleLLMResult = useCallback((result: LLMBuilderResponse, messageId: string) => {
        if (!result.updates) return;

        const updates = result.updates;

        // Apply only known fields to draft (defense against unexpected LLM output)
        setDraft(prev => {
            const newDraft = { ...prev };
            if (typeof updates.name === 'string' && updates.name) newDraft.name = updates.name;
            if (typeof updates.systemPrompt === 'string' && updates.systemPrompt) newDraft.systemPrompt = updates.systemPrompt;
            if (typeof updates.firstMessage === 'string' && updates.firstMessage) newDraft.firstMessage = updates.firstMessage;
            if (typeof updates.language === 'string' && updates.language) newDraft.language = updates.language;
            return newDraft;
        });

        // Handle voice recommendations
        if (updates.voiceCharacteristics) {
            lastVoiceCharacteristicsRef.current = updates.voiceCharacteristics;
            fetchAndMatchVoices(updates.voiceCharacteristics);
        }

        // Handle integration suggestions
        if (Array.isArray(updates.integrationSuggestions) && updates.integrationSuggestions.length > 0) {
            // Determine primary CRM for integration suggestions
            const primaryCrm: IntegrationSelection['crm'] | null = context.hasGHL ? 'ghl' : context.hasHubSpot ? 'hubspot' : context.hasGCal ? 'gcal' : context.hasCalendly ? 'calendly' : context.hasSlack ? 'slack' : null;
            if (!primaryCrm) return; // Skip integration suggestions if no integrations configured
            const suggestions: IntegrationSelection[] = updates.integrationSuggestions
                .filter((id): id is string => typeof id === 'string')
                .map(templateId => {
                    const template = availableTemplates.find(t => t.id === templateId);
                    if (!template) return null;
                    // Pick the best CRM for this specific template based on which has actions
                    let crm = primaryCrm;
                    if (template.actions[primaryCrm].length === 0) {
                        // Fallback: find first integration that has actions for this template
                        const fallbacks: IntegrationSelection['crm'][] = ['ghl', 'hubspot', 'gcal', 'calendly', 'slack'];
                        const contextMap: Record<string, boolean> = { ghl: context.hasGHL, hubspot: context.hasHubSpot, gcal: context.hasGCal, calendly: context.hasCalendly, slack: context.hasSlack };
                        for (const fb of fallbacks) {
                            if (contextMap[fb] && template.actions[fb].length > 0) {
                                crm = fb;
                                break;
                            }
                        }
                    }
                    return {
                        templateId: template.id,
                        name: template.name,
                        description: template.description,
                        enabled: true,
                        crm,
                    };
                })
                .filter((s): s is IntegrationSelection => s !== null);

            if (suggestions.length > 0) {
                setDraft(prev => ({
                    ...prev,
                    integrations: suggestions,
                }));
            }
        }

        // Update the message with structured data (only store message text, not raw updates)
        setMessages(prev =>
            prev.map(m => m.id === messageId
                ? { ...m, content: result.message }
                : m
            )
        );
    }, [context.hasGHL, context.hasHubSpot, context.hasGCal, context.hasCalendly, context.hasSlack, availableTemplates, fetchAndMatchVoices]);

    const handleSendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isStreaming) return;

        // Cancel any in-flight request
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const userMessage: BuilderMessage = {
            id: generateMessageId('user'),
            role: 'user',
            content: content.trim(),
            timestamp: Date.now(),
        };

        const assistantMessageId = generateMessageId('assistant');
        const assistantMessage: BuilderMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setIsStreaming(true);
        setError(null);

        try {
            // Use ref for latest messages to avoid stale closure
            const history = messagesRef.current
                .filter(m => m.content)
                .map(m => ({ role: m.role, content: m.content }));

            const currentDraft = draftRef.current;

            const response = await fetch('/api/agent-builder/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content.trim(),
                    history,
                    draft: currentDraft.name ? currentDraft : null,
                    context: {
                        hasGHL: context.hasGHL,
                        hasHubSpot: context.hasHubSpot,
                        hasGCal: context.hasGCal,
                        hasCalendly: context.hasCalendly,
                        hasSlack: context.hasSlack,
                    },
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to generate response');
            }

            if (!response.body) {
                throw new Error('No response stream');
            }

            // Read the stream
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
                            // Update assistant message with streaming text
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last?.role === 'assistant') {
                                    updated[updated.length - 1] = {
                                        ...last,
                                        content: fullMessage,
                                    };
                                }
                                return updated;
                            });
                        } else if (chunk.type === 'result') {
                            const result = chunk.data as LLMBuilderResponse;
                            handleLLMResult(result, assistantMessageId);
                        } else if (chunk.type === 'error') {
                            throw new Error(chunk.error);
                        }
                    } catch (parseError) {
                        // Skip malformed chunks
                        if (parseError instanceof SyntaxError) continue;
                        throw parseError;
                    }
                }
            }
        } catch (err) {
            // Ignore abort errors (user navigated away or sent new message)
            if (err instanceof DOMException && err.name === 'AbortError') return;

            const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
            setError(errorMsg);
            // Update assistant message with error
            setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant' && !last.content) {
                    updated[updated.length - 1] = {
                        ...last,
                        content: 'Sorry, something went wrong. Please try again.',
                    };
                }
                return updated;
            });
        } finally {
            setIsStreaming(false);
        }
    }, [isStreaming, context.hasGHL, context.hasHubSpot, context.hasGCal, context.hasCalendly, context.hasSlack, handleLLMResult]);

    // Track last voice characteristics so we can re-match when provider changes
    const lastVoiceCharacteristicsRef = useRef<VoiceCharacteristics | null>(null);

    const handleDraftUpdate = useCallback((updates: Partial<AgentDraft>) => {
        setDraft(prev => {
            const newDraft = { ...prev, ...updates };

            // When provider changes, clear voice selection so user picks from new provider's voices
            if (updates.provider && updates.provider !== prev.provider) {
                newDraft.voiceId = '';
                newDraft.voiceName = '';
            }

            return newDraft;
        });

        // When provider changes, re-fetch voices for the new provider
        if (updates.provider) {
            setVoiceRecommendations([]);
            const lastChars = lastVoiceCharacteristicsRef.current;
            if (lastChars) {
                fetchAndMatchVoices(lastChars, updates.provider);
            }
        }
    }, [fetchAndMatchVoices]);

    const handleVoiceSelect = useCallback((voiceId: string, voiceName: string) => {
        setDraft(prev => ({ ...prev, voiceId, voiceName }));
    }, []);

    const handleCreateAgent = useCallback(async (clientId?: string, phoneNumberId?: string) => {
        if (isCreating) return;

        const currentDraft = draftRef.current;
        if (!currentDraft.name || !currentDraft.voiceId || !currentDraft.systemPrompt) {
            setError('Please complete the agent name, voice, and system prompt before creating.');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            const response = await fetch('/api/agent-builder/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    draft: currentDraft,
                    client_id: clientId || null,
                    phone_number_id: phoneNumberId || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to create agent');
            }

            const { data } = await response.json();
            router.push(`/agents`);
            router.refresh();

            return data;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to create agent';
            setError(errorMsg);
            throw err;
        } finally {
            setIsCreating(false);
        }
    }, [isCreating, router]);

    const isReadyToCreate = !!(draft.name && draft.voiceId && draft.systemPrompt);

    return (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Chat Panel */}
            <div className="flex-1 flex flex-col min-w-0 lg:max-w-[55%] border-b lg:border-b-0 lg:border-r border-border">
                <AgentBuilderChat
                    messages={messages}
                    isStreaming={isStreaming}
                    onSendMessage={handleSendMessage}
                    voiceRecommendations={voiceRecommendations}
                    selectedVoiceId={draft.voiceId}
                    onVoiceSelect={handleVoiceSelect}
                    error={error}
                />
            </div>

            {/* Preview Panel */}
            <div className="lg:flex-1 flex flex-col min-w-0 min-h-[400px] lg:min-h-0 bg-slate-50 dark:bg-slate-950">
                <AgentBuilderPreview
                    draft={draft}
                    onDraftUpdate={handleDraftUpdate}
                    onCreateAgent={handleCreateAgent}
                    isCreating={isCreating}
                    isReady={isReadyToCreate}
                    clients={clients}
                    phoneNumbers={phoneNumbers}
                    context={context}
                    availableTemplates={availableTemplates}
                    availableProviders={availableProviders}
                />
            </div>
        </div>
    );
}
