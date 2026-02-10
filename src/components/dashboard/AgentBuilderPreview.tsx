'use client';

import { useState, useCallback, useMemo } from 'react';
import {
    Bot, Mic, MessageSquare, Code2, ChevronDown, ChevronUp,
    Rocket, Loader2, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AgentBuilderIntegrationCard } from './AgentBuilderIntegrationCard';
import { AgentBuilderVoicePicker } from './AgentBuilderVoicePicker';
import type { AgentDraft, BuilderContext, IntegrationSelection } from '@/lib/agent-builder/types';
import type { WorkflowTemplate } from '@/lib/agent-builder/templates';

const PROVIDER_LABELS: Record<string, string> = {
    retell: 'Retell AI',
    vapi: 'Vapi',
    bland: 'Bland.ai',
};

interface AgentBuilderPreviewProps {
    draft: AgentDraft;
    onDraftUpdate: (updates: Partial<AgentDraft>) => void;
    onCreateAgent: (clientId?: string, phoneNumberId?: string) => Promise<unknown>;
    isCreating: boolean;
    isReady: boolean;
    clients: { id: string; name: string }[];
    phoneNumbers: { id: string; phone_number: string; nickname?: string; agent_id?: string | null }[];
    context: BuilderContext;
    availableTemplates: WorkflowTemplate[];
    availableProviders: ('retell' | 'vapi' | 'bland')[];
}

export function AgentBuilderPreview({
    draft,
    onDraftUpdate,
    onCreateAgent,
    isCreating,
    isReady,
    clients,
    phoneNumbers,
    context,
    availableTemplates,
    availableProviders,
}: AgentBuilderPreviewProps) {
    const [isPromptExpanded, setIsPromptExpanded] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
    const [createError, setCreateError] = useState<string | null>(null);

    const hasContent = !!(draft.name || draft.systemPrompt || draft.firstMessage || draft.voiceId);

    const handleCreate = useCallback(async () => {
        setCreateError(null);
        try {
            await onCreateAgent(
                selectedClientId || undefined,
                selectedPhoneId || undefined
            );
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create agent');
        }
    }, [onCreateAgent, selectedClientId, selectedPhoneId]);

    const handleToggleIntegration = useCallback((templateId: string, enabled: boolean) => {
        const updated = draft.integrations.map(i =>
            i.templateId === templateId ? { ...i, enabled } : i
        );
        onDraftUpdate({ integrations: updated });
    }, [draft.integrations, onDraftUpdate]);

    const missingFieldsText = useMemo(() => {
        const missing: string[] = [];
        if (!draft.name) missing.push('Name');
        if (!draft.voiceId) missing.push('Voice');
        if (!draft.systemPrompt) missing.push('System prompt');
        return missing.length > 0 ? `${missing.join(', ')} still needed` : '';
    }, [draft.name, draft.voiceId, draft.systemPrompt]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        <h2 className="font-semibold text-sm">Agent Preview</h2>
                    </div>
                    {hasContent && (
                        <Badge variant={isReady ? 'success' : 'secondary'} className="text-xs">
                            {isReady ? 'Ready to create' : 'In progress'}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {!hasContent ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
                            <Bot className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium text-sm">No agent configured yet</h3>
                        <p className="text-xs text-muted-foreground max-w-xs mt-1">
                            Start chatting to describe your agent. The preview will update in real-time.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Name */}
                        <Section icon={<Bot className="h-3.5 w-3.5" />} label="Name">
                            <Input
                                value={draft.name}
                                onChange={(e) => onDraftUpdate({ name: e.target.value })}
                                placeholder="Agent name"
                                className="text-sm"
                            />
                        </Section>

                        {/* Voice */}
                        <Section icon={<Mic className="h-3.5 w-3.5" />} label="Voice">
                            <AgentBuilderVoicePicker
                                selectedVoiceId={draft.voiceId}
                                selectedVoiceName={draft.voiceName || ''}
                                provider={draft.provider}
                                onVoiceSelect={(voiceId, voiceName) =>
                                    onDraftUpdate({ voiceId, voiceName })
                                }
                            />
                        </Section>

                        {/* First Message */}
                        <Section icon={<MessageSquare className="h-3.5 w-3.5" />} label="First Message">
                            <Textarea
                                value={draft.firstMessage}
                                onChange={(e) => onDraftUpdate({ firstMessage: e.target.value })}
                                placeholder="The agent's opening greeting..."
                                className="text-sm min-h-[60px]"
                                rows={2}
                            />
                        </Section>

                        {/* System Prompt */}
                        <Section icon={<Code2 className="h-3.5 w-3.5" />} label="System Prompt">
                            <div>
                                <button
                                    onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                                >
                                    {isPromptExpanded ? (
                                        <ChevronUp className="h-3 w-3" />
                                    ) : (
                                        <ChevronDown className="h-3 w-3" />
                                    )}
                                    {isPromptExpanded ? 'Collapse' : 'Expand'} prompt
                                    {draft.systemPrompt && (
                                        <span className="text-muted-foreground">
                                            ({draft.systemPrompt.length} chars)
                                        </span>
                                    )}
                                </button>
                                {isPromptExpanded ? (
                                    <Textarea
                                        value={draft.systemPrompt}
                                        onChange={(e) => onDraftUpdate({ systemPrompt: e.target.value })}
                                        placeholder="The system prompt that defines the agent's behavior..."
                                        className="text-xs font-mono min-h-[200px] leading-relaxed"
                                        rows={10}
                                    />
                                ) : (
                                    <div
                                        onClick={() => setIsPromptExpanded(true)}
                                        className="text-xs font-mono text-muted-foreground bg-muted/50 rounded-lg p-3 cursor-pointer hover:bg-muted transition-colors line-clamp-3"
                                    >
                                        {draft.systemPrompt || 'No system prompt yet...'}
                                    </div>
                                )}
                            </div>
                        </Section>

                        {/* Integrations */}
                        {(draft.integrations.length > 0 || availableTemplates.length > 0) && (
                            <Section icon={<Zap className="h-3.5 w-3.5" />} label="Integrations">
                                {draft.integrations.length > 0 ? (
                                    <div className="space-y-2">
                                        {draft.integrations.map((integration) => (
                                            <AgentBuilderIntegrationCard
                                                key={integration.templateId}
                                                integration={integration}
                                                onToggle={(enabled) =>
                                                    handleToggleIntegration(integration.templateId, enabled)
                                                }
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">
                                        {context.hasGHL || context.hasHubSpot
                                            ? 'Describe your agent\'s purpose and I\'ll suggest relevant integrations'
                                            : 'Connect a CRM in Settings to enable auto-integrations'}
                                    </p>
                                )}
                            </Section>
                        )}
                    </>
                )}
            </div>

            {/* Create Section */}
            {hasContent && (
                <div className="flex-shrink-0 p-4 border-t border-border bg-white dark:bg-slate-900 space-y-3">
                    {/* Provider selector — only show when multiple providers available */}
                    {availableProviders.length > 1 && (
                        <div>
                            <Label htmlFor="builder-provider-select" className="text-xs text-muted-foreground mb-1 block">Voice Provider</Label>
                            <div className="flex gap-1.5">
                                {availableProviders.map(p => (
                                    <button
                                        key={p}
                                        onClick={() => onDraftUpdate({ provider: p })}
                                        className={`flex-1 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                                            draft.provider === p
                                                ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 font-medium'
                                                : 'border-input bg-background text-muted-foreground hover:bg-muted'
                                        }`}
                                    >
                                        {PROVIDER_LABELS[p] || p}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Optional selectors */}
                    <div className="grid grid-cols-2 gap-2">
                        {clients.length > 0 && (
                            <div>
                                <Label htmlFor="builder-client-select" className="text-xs text-muted-foreground mb-1 block">Client (optional)</Label>
                                <select
                                    id="builder-client-select"
                                    value={selectedClientId}
                                    onChange={(e) => setSelectedClientId(e.target.value)}
                                    className="w-full text-xs px-2 py-1.5 rounded-md border border-input bg-background"
                                >
                                    <option value="">None</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {phoneNumbers.length > 0 && (
                            <div>
                                <Label htmlFor="builder-phone-select" className="text-xs text-muted-foreground mb-1 block">Phone (optional)</Label>
                                <select
                                    id="builder-phone-select"
                                    value={selectedPhoneId}
                                    onChange={(e) => setSelectedPhoneId(e.target.value)}
                                    className="w-full text-xs px-2 py-1.5 rounded-md border border-input bg-background"
                                >
                                    <option value="">None</option>
                                    {phoneNumbers.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.nickname || p.phone_number}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {createError && (
                        <p role="alert" className="text-xs text-red-500">{createError}</p>
                    )}

                    <Card className="border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-purple-500/5">
                        <CardContent className="p-3">
                            <Button
                                onClick={handleCreate}
                                disabled={!isReady || isCreating}
                                className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating Agent...
                                    </>
                                ) : (
                                    <>
                                        <Rocket className="h-4 w-4 mr-2" />
                                        Create Agent
                                    </>
                                )}
                            </Button>
                            {!isReady && missingFieldsText && (
                                <p className="text-xs text-muted-foreground text-center mt-2">
                                    {missingFieldsText}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

function Section({
    icon,
    label,
    children,
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-2">
                <span className="text-muted-foreground">{icon}</span>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                </span>
            </div>
            {children}
        </div>
    );
}
