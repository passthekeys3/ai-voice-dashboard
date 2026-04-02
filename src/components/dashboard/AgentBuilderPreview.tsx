'use client';

import { useState, useCallback, useMemo } from 'react';
import {
    Bot, Mic, MessageSquare, Code2, ChevronDown, ChevronUp,
    Rocket, Loader2, Zap, CheckCircle2, Phone, ExternalLink, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AgentBuilderIntegrationCard } from './AgentBuilderIntegrationCard';
import { AgentBuilderVoicePicker } from './AgentBuilderVoicePicker';
import { TestCall } from './TestCall';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { AgentDraft, BuilderContext } from '@/lib/agent-builder/types';
import type { VoiceProvider } from '@/types';
import type { WorkflowTemplate } from '@/lib/agent-builder/templates';
import type { CreatedAgentData } from './AgentBuilder';
import { RETELL_VOICE_MODELS, RETELL_LLM_MODELS, VAPI_LLM_MODELS, ELEVENLABS_LLM_MODELS, ELEVENLABS_VOICE_MODELS, TELEPHONY_COST_PER_MIN, PROVIDER_LABELS } from '@/lib/constants/config';
import Link from 'next/link';

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
    availableProviders: VoiceProvider[];
    /** Set after successful agent creation — triggers the success/test state */
    createdAgent?: CreatedAgentData | null;
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
    createdAgent,
}: AgentBuilderPreviewProps) {
    const [isPromptExpanded, setIsPromptExpanded] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    // Only show phone numbers not already assigned to another agent
    const availablePhoneNumbers = useMemo(
        () => phoneNumbers.filter(p => !p.agent_id),
        [phoneNumbers]
    );
    const [selectedPhoneIdRaw, setSelectedPhoneId] = useState<string>('');
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Derive effective phone ID: auto-select if exactly one available,
    // clear if current selection is no longer available
    const selectedPhoneId = useMemo(() => {
        if (selectedPhoneIdRaw && availablePhoneNumbers.find(p => p.id === selectedPhoneIdRaw)) {
            return selectedPhoneIdRaw;
        }
        if (availablePhoneNumbers.length === 1) {
            return availablePhoneNumbers[0].id;
        }
        return '';
    }, [selectedPhoneIdRaw, availablePhoneNumbers]);
    const [createError, setCreateError] = useState<string | null>(null);

    const hasContent = !!(draft.name || draft.systemPrompt || draft.firstMessage || draft.voiceId);
    const showTestCall = draft.provider === 'retell' || draft.provider === 'vapi' || draft.provider === 'bland';

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

    // ── Post-creation success state ──
    if (createdAgent) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <h2 className="font-semibold text-sm">Agent Created</h2>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Success summary card */}
                    <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/40">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{draft.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {PROVIDER_LABELS[draft.provider] || draft.provider}
                                        {draft.voiceName && ` · ${draft.voiceName}`}
                                    </p>
                                </div>
                            </div>

                            {createdAgent.phone_number && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span>Assigned to <strong className="text-foreground">{createdAgent.phone_number}</strong></span>
                                    <Badge variant="success" className="text-[10px] px-1.5 py-0">Live</Badge>
                                </div>
                            )}

                            {createdAgent.workflows_created > 0 && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Zap className="h-3.5 w-3.5" />
                                    <span>{createdAgent.workflows_created} workflow{createdAgent.workflows_created > 1 ? 's' : ''} created</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Inline test call */}
                    {showTestCall && (
                        <TestCall
                            agentId={createdAgent.agent_id}
                            agentName={draft.name}
                            provider={draft.provider}
                        />
                    )}

                    {/* Navigation links */}
                    <div className="space-y-2">
                        <Button asChild className="w-full" variant="default">
                            <Link href={`/agents/${createdAgent.agent_id}`}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Agent Details
                            </Link>
                        </Button>
                        <Button asChild className="w-full" variant="outline">
                            <Link href="/agents">
                                View All Agents
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

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
                {/* Voice Provider — always visible so user knows which platform is active */}
                {availableProviders.length > 0 && (
                    <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Voice Provider</Label>
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
                                maxLength={100}
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

                        {/* Voice Model (Retell + ElevenLabs) */}
                        {(draft.provider === 'retell' || draft.provider === 'elevenlabs') && (
                            <Section icon={<Mic className="h-3.5 w-3.5" />} label="Voice Model">
                                <Select
                                    value={draft.voiceModel || (draft.provider === 'elevenlabs' ? 'eleven_flash_v2' : 'eleven_v3')}
                                    onValueChange={(value: string) => onDraftUpdate({ voiceModel: value })}
                                >
                                    <SelectTrigger className="text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(draft.provider === 'elevenlabs' ? ELEVENLABS_VOICE_MODELS : RETELL_VOICE_MODELS).map((m) => (
                                            <SelectItem key={m.value} value={m.value}>
                                                <span>{m.label}</span>
                                                <span className="text-muted-foreground ml-2 text-xs">${m.costPerMin.toFixed(3)}/min</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Section>
                        )}

                        {/* LLM Model (Retell + Vapi + ElevenLabs) */}
                        {draft.provider !== 'bland' && (
                            <Section icon={<Bot className="h-3.5 w-3.5" />} label="LLM Model">
                                <Select
                                    value={draft.llmModel || (draft.provider === 'retell' ? 'gpt-4.1' : draft.provider === 'elevenlabs' ? 'gemini-2.5-flash' : 'gpt-4o')}
                                    onValueChange={(value: string) => onDraftUpdate({ llmModel: value })}
                                >
                                    <SelectTrigger className="text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(draft.provider === 'retell' ? RETELL_LLM_MODELS : draft.provider === 'elevenlabs' ? ELEVENLABS_LLM_MODELS : VAPI_LLM_MODELS).map((m) => (
                                            <SelectItem key={m.value} value={m.value}>
                                                <span>{m.label}</span>
                                                <span className="text-muted-foreground ml-2 text-xs">${m.costPerMin.toFixed(3)}/min</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Section>
                        )}

                        {/* Cost Estimate */}
                        {(draft.provider === 'retell' || draft.provider === 'elevenlabs') && (() => {
                            const isEL = draft.provider === 'elevenlabs';
                            const voiceCost = isEL
                                ? (ELEVENLABS_VOICE_MODELS.find(m => m.value === draft.voiceModel)?.costPerMin ?? 0.04)
                                : (RETELL_VOICE_MODELS.find(m => m.value === draft.voiceModel)?.costPerMin ?? 0.08);
                            const llmCost = isEL
                                ? (ELEVENLABS_LLM_MODELS.find(m => m.value === draft.llmModel)?.costPerMin ?? 0.005)
                                : (RETELL_LLM_MODELS.find(m => m.value === draft.llmModel)?.costPerMin ?? 0.045);
                            const telCost = TELEPHONY_COST_PER_MIN;
                            const total = voiceCost + llmCost + telCost;
                            return (
                                <div className="flex items-center gap-2 px-1 py-1.5 text-xs text-muted-foreground">
                                    <Zap className="h-3 w-3 shrink-0" />
                                    <span>Est. ~${total.toFixed(3)}/min</span>
                                    <div className="relative group ml-auto" tabIndex={0} role="button" aria-label="Show cost breakdown">
                                        <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/70 group-hover:text-foreground group-focus-within:text-foreground transition-colors" />
                                        <div className="absolute bottom-full right-0 mb-2 w-52 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity z-50">
                                            <p className="font-medium text-xs mb-2">Cost breakdown</p>
                                            <div className="space-y-1 text-[11px]">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Voice model</span>
                                                    <span>${voiceCost.toFixed(3)}/min</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">LLM</span>
                                                    <span>${llmCost.toFixed(3)}/min</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Telephony</span>
                                                    <span>${telCost.toFixed(3)}/min</span>
                                                </div>
                                                <div className="flex justify-between border-t pt-1 mt-1 font-medium">
                                                    <span>Total</span>
                                                    <span>${total.toFixed(3)}/min</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

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
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setIsPromptExpanded(true)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsPromptExpanded(true); } }}
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
                    {/* Optional selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        {availablePhoneNumbers.length > 0 && (
                            <div>
                                <Label htmlFor="builder-phone-select" className="text-xs text-muted-foreground mb-1 block">
                                    Phone {availablePhoneNumbers.length === 1 ? '(auto-selected)' : '(optional)'}
                                </Label>
                                <select
                                    id="builder-phone-select"
                                    value={selectedPhoneId}
                                    onChange={(e) => setSelectedPhoneId(e.target.value)}
                                    className="w-full text-xs px-2 py-1.5 rounded-md border border-input bg-background"
                                >
                                    <option value="">None</option>
                                    {availablePhoneNumbers.map(p => (
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

                    {/* Confirmation summary */}
                    {showConfirmation && isReady ? (
                        <Card className="border-violet-500/30 bg-violet-50 dark:bg-violet-950/20">
                            <CardContent className="p-4 space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm Agent</p>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Name</span>
                                        <span className="font-medium">{draft.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Provider</span>
                                        <span className="font-medium">{PROVIDER_LABELS[draft.provider] || draft.provider}</span>
                                    </div>
                                    {draft.voiceName && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Voice</span>
                                            <span className="font-medium">{draft.voiceName}</span>
                                        </div>
                                    )}
                                    {selectedPhoneId && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Phone</span>
                                            <span className="font-medium">
                                                {phoneNumbers.find(p => p.id === selectedPhoneId)?.nickname
                                                    || phoneNumbers.find(p => p.id === selectedPhoneId)?.phone_number
                                                    || 'Selected'}
                                            </span>
                                        </div>
                                    )}
                                    {draft.integrations.filter(i => i.enabled).length > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Workflows</span>
                                            <span className="font-medium">{draft.integrations.filter(i => i.enabled).length}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => setShowConfirmation(false)}
                                        disabled={isCreating}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                                        onClick={handleCreate}
                                        disabled={isCreating}
                                    >
                                        {isCreating ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <Rocket className="h-4 w-4 mr-2" />
                                                Confirm
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-violet-500/20 bg-violet-50 dark:bg-violet-950/20">
                            <CardContent className="p-3">
                                <Button
                                    onClick={() => setShowConfirmation(true)}
                                    disabled={!isReady || isCreating}
                                    className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                                >
                                    <Rocket className="h-4 w-4 mr-2" />
                                    Create Agent
                                </Button>
                                {!isReady && missingFieldsText && (
                                    <p className="text-xs text-muted-foreground text-center mt-2">
                                        {missingFieldsText}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )}
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
