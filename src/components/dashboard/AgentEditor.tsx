'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Sparkles, Loader2, ChevronDown, ChevronUp, RefreshCw, Shield, Zap } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { RETELL_VOICE_MODELS, RETELL_LLM_MODELS, VAPI_LLM_MODELS, TELEPHONY_COST_PER_MIN } from '@/lib/constants/config';

interface PromptSuggestion {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
}

interface AgentEditorProps {
    agentId: string;
    provider: 'retell' | 'vapi' | 'bland';
    isActive: boolean;
    clientId: string | null;
    clients: { id: string; name: string }[];
    config: Record<string, unknown>;
    webhookUrl?: string;
}

// Well-known Vapi voice providers and their voices
const VAPI_VOICE_PROVIDERS = [
    { id: 'openai', name: 'OpenAI' },
    { id: '11labs', name: 'ElevenLabs' },
    { id: 'playht', name: 'PlayHT' },
    { id: 'deepgram', name: 'Deepgram' },
    { id: 'azure', name: 'Azure' },
    { id: 'lmnt', name: 'LMNT' },
    { id: 'rime-ai', name: 'Rime AI' },
];

// Known voices for Vapi TTS providers that have a fixed set
const VAPI_KNOWN_VOICES: Record<string, { id: string; name: string }[]> = {
    openai: [
        { id: 'alloy', name: 'Alloy' },
        { id: 'ash', name: 'Ash' },
        { id: 'ballad', name: 'Ballad' },
        { id: 'coral', name: 'Coral' },
        { id: 'echo', name: 'Echo' },
        { id: 'fable', name: 'Fable' },
        { id: 'nova', name: 'Nova' },
        { id: 'onyx', name: 'Onyx' },
        { id: 'sage', name: 'Sage' },
        { id: 'shimmer', name: 'Shimmer' },
        { id: 'verse', name: 'Verse' },
    ],
    deepgram: [
        { id: 'asteria', name: 'Asteria (Female)' },
        { id: 'luna', name: 'Luna (Female)' },
        { id: 'stella', name: 'Stella (Female)' },
        { id: 'athena', name: 'Athena (Female)' },
        { id: 'hera', name: 'Hera (Female)' },
        { id: 'orion', name: 'Orion (Male)' },
        { id: 'arcas', name: 'Arcas (Male)' },
        { id: 'perseus', name: 'Perseus (Male)' },
        { id: 'angus', name: 'Angus (Male)' },
        { id: 'orpheus', name: 'Orpheus (Male)' },
        { id: 'helios', name: 'Helios (Male)' },
        { id: 'zeus', name: 'Zeus (Male)' },
    ],
};

function formatTimeAgo(isoDate: string): string {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const LANGUAGES = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish (Spain)' },
    { code: 'es-MX', name: 'Spanish (Mexico)' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'zh-CN', name: 'Chinese (Mandarin)' },
];

export function AgentEditor({
    agentId,
    provider,
    isActive,
    clientId,
    clients,
    config,
    webhookUrl: initialWebhookUrl
}: AgentEditorProps) {
    const [saving, setSaving] = useState(false);
    const [loadingPrompt, setLoadingPrompt] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Local state
    const [active, setActive] = useState(isActive);
    const [selectedClient, setSelectedClient] = useState(clientId || '');

    // Agent config state
    const [agentName, setAgentName] = useState((config as { agent_name?: string }).agent_name || '');
    const [voiceId, setVoiceId] = useState((config as { voice_id?: string }).voice_id || '');
    const [voiceProvider, setVoiceProvider] = useState((config as { voice_provider?: string }).voice_provider || '');
    const [language, setLanguage] = useState((config as { language?: string }).language || 'en-US');
    const [prompt, setPrompt] = useState(
        (config as { system_prompt?: string; prompt?: string; llm_prompt?: string }).system_prompt
        || (config as { prompt?: string }).prompt
        || (config as { llm_prompt?: string }).llm_prompt
        || ''
    );
    const [promptFetchFailed, setPromptFetchFailed] = useState(false);
    const [responsiveness, setResponsiveness] = useState(
        (config as { responsiveness?: number }).responsiveness ?? 0.8
    );

    // Voice model & LLM model state
    const [voiceModel, setVoiceModel] = useState(
        (config as { voice_model?: string }).voice_model || 'eleven_v3'
    );
    const [llmModel, setLlmModel] = useState(
        (config as { llm_model?: string }).llm_model || (provider === 'retell' ? 'gpt-4.1' : 'gpt-4o')
    );

    // Safety guardrails state (Retell only)
    const [guardrailsEnabled, setGuardrailsEnabled] = useState(
        (config as { enable_safety_guardrails?: boolean }).enable_safety_guardrails ?? false
    );
    const [guardrailCategories, setGuardrailCategories] = useState<string[]>(
        (config as { safety_guardrails_categories?: string[] }).safety_guardrails_categories ?? []
    );

    // Dynamic voice list (fetched from API for Retell, from known lists for Vapi)
    const [voices, setVoices] = useState<{ id: string; name: string; provider?: string }[]>([]);
    const [loadingVoices, setLoadingVoices] = useState(false);

    // Fetch voices dynamically
    useEffect(() => {
        if (provider === 'retell') {
            setLoadingVoices(true);
            fetch('/api/voices?provider=retell')
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data?.data) {
                        setVoices(data.data.map((v: { id: string; name: string; provider?: string }) => ({
                            id: v.id,
                            name: v.name,
                            provider: v.provider,
                        })));
                    }
                })
                .catch(err => console.error('Error fetching voices:', err))
                .finally(() => setLoadingVoices(false));
        } else if (provider === 'vapi') {
            // Use known voice lists based on the selected TTS provider
            const knownVoices = VAPI_KNOWN_VOICES[voiceProvider] || [];
            setVoices(knownVoices);
        }
    }, [provider, voiceProvider]);

    // AI Suggestions state
    const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [suggestionsReason, setSuggestionsReason] = useState<string | null>(null);
    const [suggestionsExpanded, setSuggestionsExpanded] = useState(true);
    const [suggestionsGeneratedAt, setSuggestionsGeneratedAt] = useState<string | null>(null);

    // Fetch suggestions (cached 6 hours, or force refresh)
    const fetchSuggestions = async (refresh = false) => {
        setSuggestionsLoading(true);
        try {
            const url = refresh
                ? `/api/agents/${agentId}/suggestions?refresh=true`
                : `/api/agents/${agentId}/suggestions`;
            const response = await fetch(url);
            if (response.ok) {
                const { data } = await response.json();
                if (data?.suggestions) {
                    setSuggestions(data.suggestions);
                }
                if (data?.generated_at) {
                    setSuggestionsGeneratedAt(data.generated_at);
                }
                if (data?.reason) {
                    setSuggestionsReason(data.reason);
                }
            }
        } catch (err) {
            console.error('Failed to fetch suggestions:', err);
        } finally {
            setSuggestionsLoading(false);
        }
    };

    // Fetch suggestions lazily on mount
    useEffect(() => {
        fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentId]);

    // Webhook settings
    const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl || '');
    useEffect(() => {
        const fetchProviderData = async () => {
            try {
                const response = await fetch(`/api/agents/${agentId}/provider`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.data) {
                        setPrompt(data.data.prompt || '');
                        if (data.data.agent_name !== undefined) setAgentName(data.data.agent_name);
                        if (data.data.voice_id !== undefined) setVoiceId(data.data.voice_id);
                        if (data.data.voice_provider !== undefined) setVoiceProvider(data.data.voice_provider);
                        if (data.data.language !== undefined) setLanguage(data.data.language);
                        if (data.data.responsiveness !== undefined) setResponsiveness(data.data.responsiveness);
                        if (data.data.voice_model) setVoiceModel(data.data.voice_model);
                        if (data.data.llm_model) setLlmModel(data.data.llm_model);
                        if (data.data.enable_safety_guardrails !== undefined) setGuardrailsEnabled(data.data.enable_safety_guardrails);
                        if (data.data.safety_guardrails_categories !== undefined) setGuardrailCategories(data.data.safety_guardrails_categories);
                        setPromptFetchFailed(false);
                    }
                } else {
                    console.error('Provider data fetch failed:', response.status);
                    setPromptFetchFailed(true);
                }
            } catch (err) {
                console.error('Error fetching provider data:', err);
                setPromptFetchFailed(true);
            } finally {
                setLoadingPrompt(false);
            }
        };
        fetchProviderData();
    }, [agentId, provider]);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            // Update local database (activation, client assignment, webhook)
            const dbResponse = await fetch(`/api/agents/${agentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    is_active: active,
                    client_id: selectedClient || null,
                    webhook_url: webhookUrl || null,
                }),
            });

            if (!dbResponse.ok) {
                const data = await dbResponse.json();
                setMessage({ type: 'error', text: data.error || 'Failed to update agent' });
                return;
            }

            // Update provider config
            const providerPayload: Record<string, unknown> = {
                agent_name: agentName,
                prompt,
            };

            // If client assignment changed, tell provider route to use the original
            // client's keys (the external_id belongs to the original workspace)
            if (selectedClient !== (clientId || '')) {
                providerPayload._original_client_id = clientId;
            }

            // Provider-specific fields
            if (provider === 'retell') {
                providerPayload.voice_id = voiceId;
                providerPayload.voice_model = voiceModel;
                providerPayload.llm_model = llmModel;
                providerPayload.language = language;
                providerPayload.responsiveness = responsiveness;
                providerPayload.enable_safety_guardrails = guardrailsEnabled;
                providerPayload.safety_guardrails_categories = guardrailCategories;
            } else if (provider === 'vapi') {
                providerPayload.voice_id = voiceId;
                providerPayload.voice_provider = voiceProvider;
                providerPayload.language = language;
                // Derive Vapi model provider from model name
                const vapiProvider = llmModel.startsWith('claude') ? 'anthropic'
                    : llmModel.startsWith('gemini') ? 'google' : 'openai';
                providerPayload.model = llmModel;
                providerPayload.model_provider = vapiProvider;
            }

            const providerResponse = await fetch(`/api/agents/${agentId}/provider`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(providerPayload),
            });

            if (!providerResponse.ok) {
                const data = await providerResponse.json();
                setMessage({ type: 'error', text: data.error || 'Failed to update provider' });
                return;
            }

            setMessage({ type: 'success', text: 'Agent updated successfully!' });
            // Hard navigate to ensure clean server render (router.refresh can cause
            // blank page if RSC stream encounters errors during layout re-render)
            window.location.replace(`/agents/${agentId}`);
        } catch (_err) {
            setMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* VAPI Feature Note */}
            {provider === 'vapi' && (
                <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800 dark:text-yellow-200">VAPI Feature Note</AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                        Some features are not yet available for VAPI agents:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Knowledge base management</li>
                            <li>Embeddable voice widget</li>
                        </ul>
                        <p className="mt-2">
                            Please manage these features directly in your{' '}
                            <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                                VAPI dashboard
                            </a>.
                        </p>
                    </AlertDescription>
                </Alert>
            )}

            {/* Bland Limitations Warning */}
            {provider === 'bland' && (
                <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 dark:text-amber-200">Limited Bland.ai Support</AlertTitle>
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                        Bland.ai uses visual Pathways for agent logic. Some features are limited:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Pathway editing must be done in the Bland.ai dashboard</li>
                            <li>Voice & language selection from this dashboard</li>
                            <li>Knowledge base management</li>
                        </ul>
                        <p className="mt-2">
                            You can edit the agent name and description here. For full pathway editing, use the{' '}
                            <a href="https://app.bland.ai" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                                Bland.ai dashboard
                            </a>.
                        </p>
                    </AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="w-full mb-4">
                    <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
                    {(provider === 'retell' || provider === 'vapi') && (
                        <TabsTrigger value="voice" className="flex-1">Voice & Language</TabsTrigger>
                    )}
                    <TabsTrigger value="prompt" className="flex-1">Prompt</TabsTrigger>
                    {provider === 'retell' && (
                        <TabsTrigger value="safety" className="flex-1">Safety</TabsTrigger>
                    )}
                    <TabsTrigger value="webhooks" className="flex-1">Webhooks</TabsTrigger>
                </TabsList>

                {/* General Settings */}
                <TabsContent value="general" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>General Settings</CardTitle>
                            <CardDescription>Basic agent configuration</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="agentName">Agent Name</Label>
                                <Input
                                    id="agentName"
                                    value={agentName}
                                    onChange={(e) => setAgentName(e.target.value)}
                                    placeholder="My Voice Agent"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="active" className="text-base">Active</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Enable or disable this agent
                                    </p>
                                </div>
                                <Switch
                                    id="active"
                                    checked={active}
                                    onCheckedChange={setActive}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Assign to Client</Label>
                                <Select
                                    value={selectedClient || 'unassigned'}
                                    onValueChange={(val: string) => setSelectedClient(val === 'unassigned' ? '' : val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a client" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {clients.map((client) => (
                                            <SelectItem key={client.id} value={client.id}>
                                                {client.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Voice & Language */}
                <TabsContent value="voice" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Voice & Language</CardTitle>
                            <CardDescription>Configure how your agent sounds</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Vapi: TTS provider selection */}
                            {provider === 'vapi' && (
                                <div className="space-y-2">
                                    <Label>Voice Provider</Label>
                                    <Select
                                        value={voiceProvider || 'select-provider'}
                                        onValueChange={(v: string) => {
                                            const newProvider = v === 'select-provider' ? '' : v;
                                            setVoiceProvider(newProvider);
                                            setVoiceId('');
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a voice provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="select-provider">Select a provider...</SelectItem>
                                            {VAPI_VOICE_PROVIDERS.map((vp) => (
                                                <SelectItem key={vp.id} value={vp.id}>
                                                    {vp.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Voice selection */}
                            <div className="space-y-2">
                                <Label>Voice</Label>
                                {loadingVoices ? (
                                    <div className="flex items-center gap-2 h-10 px-3 bg-slate-100 dark:bg-slate-800 rounded-md">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm text-muted-foreground">Loading voices...</span>
                                    </div>
                                ) : voices.length > 0 ? (
                                    <Select
                                        value={voiceId || 'select-voice'}
                                        onValueChange={(v: string) => setVoiceId(v === 'select-voice' ? '' : v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a voice" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="select-voice">Select a voice...</SelectItem>
                                            {voices.map((voice) => (
                                                <SelectItem key={voice.id} value={voice.id}>
                                                    {voice.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : provider === 'vapi' && voiceProvider ? (
                                    <div className="space-y-2">
                                        <Input
                                            value={voiceId}
                                            onChange={(e) => setVoiceId(e.target.value)}
                                            placeholder="Enter voice ID"
                                            aria-label="Voice ID"
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            Enter the voice ID from your {VAPI_VOICE_PROVIDERS.find(vp => vp.id === voiceProvider)?.name || voiceProvider} account.
                                        </p>
                                    </div>
                                ) : provider === 'vapi' ? (
                                    <p className="text-sm text-muted-foreground py-2">
                                        Select a voice provider above to configure the voice.
                                    </p>
                                ) : (
                                    <Select
                                        value={voiceId || 'select-voice'}
                                        onValueChange={(v: string) => setVoiceId(v === 'select-voice' ? '' : v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a voice" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="select-voice">Select a voice...</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* Voice Model (Retell only) */}
                            {provider === 'retell' && (
                                <div className="space-y-2">
                                    <Label>Voice Model</Label>
                                    <Select value={voiceModel} onValueChange={setVoiceModel}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select voice model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {RETELL_VOICE_MODELS.map((m) => (
                                                <SelectItem key={m.value} value={m.value}>
                                                    {m.label} — {m.description}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* LLM Model (Retell + Vapi) */}
                            <div className="space-y-2">
                                <Label>LLM Model</Label>
                                <Select value={llmModel} onValueChange={setLlmModel}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select LLM model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(provider === 'retell' ? RETELL_LLM_MODELS : VAPI_LLM_MODELS).map((m) => (
                                            <SelectItem key={m.value} value={m.value}>
                                                {m.label} — {m.description}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Cost Estimate (Retell) */}
                            {provider === 'retell' && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                                    <Zap className="h-3.5 w-3.5" />
                                    <span>
                                        Est. ~${(
                                            (RETELL_VOICE_MODELS.find(m => m.value === voiceModel)?.costPerMin ?? 0.08) +
                                            (RETELL_LLM_MODELS.find(m => m.value === llmModel)?.costPerMin ?? 0.01) +
                                            TELEPHONY_COST_PER_MIN
                                        ).toFixed(3)}/min
                                    </span>
                                </div>
                            )}

                            {/* Language */}
                            <div className="space-y-2">
                                <Label>Language</Label>
                                <Select value={language} onValueChange={setLanguage}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LANGUAGES.map((lang) => (
                                            <SelectItem key={lang.code} value={lang.code}>
                                                {lang.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {provider === 'vapi' && (
                                    <p className="text-sm text-muted-foreground">
                                        Sets the transcriber language for speech recognition.
                                    </p>
                                )}
                            </div>

                            {/* Retell-only: Responsiveness */}
                            {provider === 'retell' && (
                                <div className="space-y-2">
                                    <Label>Responsiveness: {responsiveness.toFixed(1)}</Label>
                                    <Slider
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        value={[responsiveness]}
                                        onValueChange={([val]: number[]) => setResponsiveness(val)}
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        How quickly the agent responds (0 = slow, 1 = fast)
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Prompt */}
                <TabsContent value="prompt" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Agent Prompt</CardTitle>
                            <CardDescription>
                                {loadingPrompt ? 'Loading from provider...' : "Define your agent's personality and behavior"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {promptFetchFailed && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Could not load prompt from provider</AlertTitle>
                                    <AlertDescription>
                                        {prompt
                                            ? 'Showing locally cached prompt. Changes will still be saved to the provider.'
                                            : 'The provider API returned an error. Enter your prompt below and save to update the provider.'}
                                    </AlertDescription>
                                </Alert>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="prompt">System Prompt</Label>
                                {loadingPrompt ? (
                                    <div className="flex items-center justify-center h-48 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        <span className="text-muted-foreground">Loading prompt from provider...</span>
                                    </div>
                                ) : (
                                    <Textarea
                                        id="prompt"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="You are a helpful voice assistant..."
                                        rows={12}
                                        className="font-mono text-sm"
                                    />
                                )}
                                <p className="text-sm text-muted-foreground">
                                    This prompt defines how your agent behaves and what knowledge it has.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Prompt Suggestions */}
                    <Card>
                        <CardHeader
                            className="cursor-pointer"
                            onClick={() => setSuggestionsExpanded(!suggestionsExpanded)}
                        >
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="p-1 rounded-md bg-violet-600">
                                        <Sparkles className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    AI Prompt Suggestions
                                    {suggestions.length > 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                            {suggestions.length}
                                        </Badge>
                                    )}
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    {suggestionsGeneratedAt && !suggestionsLoading && (
                                        <span className="text-xs text-muted-foreground">
                                            Updated {formatTimeAgo(suggestionsGeneratedAt)}
                                        </span>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={suggestionsLoading}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fetchSuggestions(true);
                                        }}
                                        aria-label="Refresh suggestions"
                                    >
                                        <RefreshCw className={`h-3.5 w-3.5 ${suggestionsLoading ? 'animate-spin' : ''}`} />
                                    </Button>
                                    {suggestionsExpanded ? (
                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </div>
                            </div>
                            <CardDescription>
                                Improvements based on recent call patterns and outcomes
                            </CardDescription>
                        </CardHeader>
                        {suggestionsExpanded && (
                            <CardContent>
                                {suggestionsLoading ? (
                                    <div className="flex items-center gap-2 text-muted-foreground py-4">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm">Analyzing recent calls...</span>
                                    </div>
                                ) : suggestions.length > 0 ? (
                                    <div className="space-y-3">
                                        {suggestions.map((suggestion) => (
                                            <div
                                                key={suggestion.title}
                                                className="p-3 rounded-lg border border-border bg-slate-50/50 dark:bg-slate-800/50"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge
                                                        variant={
                                                            suggestion.priority === 'high'
                                                                ? 'destructive'
                                                                : suggestion.priority === 'medium'
                                                                  ? 'default'
                                                                  : 'secondary'
                                                        }
                                                        className="text-xs"
                                                    >
                                                        {suggestion.priority}
                                                    </Badge>
                                                    <span className="font-medium text-sm">{suggestion.title}</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {suggestion.description}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : suggestionsReason ? (
                                    <p className="text-sm text-muted-foreground py-2">
                                        {suggestionsReason}
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground py-2">
                                        No suggestions available yet.
                                    </p>
                                )}
                            </CardContent>
                        )}
                    </Card>
                </TabsContent>

                {/* Safety Guardrails (Retell only) */}
                {provider === 'retell' && (
                    <TabsContent value="safety" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="h-5 w-5" />
                                    Safety Guardrails
                                </CardTitle>
                                <CardDescription>
                                    Block jailbreak attempts and filter harmful content categories
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label htmlFor="guardrails" className="text-base">Enable Guardrails</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Automatically block jailbreak attempts and filter unsafe output
                                        </p>
                                    </div>
                                    <Switch
                                        id="guardrails"
                                        checked={guardrailsEnabled}
                                        onCheckedChange={setGuardrailsEnabled}
                                    />
                                </div>

                                {guardrailsEnabled && (
                                    <div className="space-y-3">
                                        <Label>Content Categories to Block</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Select which categories of harmful content the agent should refuse to engage with.
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {[
                                                { id: 'harassment', label: 'Harassment & Bullying', desc: 'Threats, intimidation, targeted abuse' },
                                                { id: 'violence', label: 'Violence & Harm', desc: 'Graphic violence, self-harm instructions' },
                                                { id: 'gambling', label: 'Gambling', desc: 'Gambling promotion or facilitation' },
                                                { id: 'regulated_advice', label: 'Regulated Advice', desc: 'Unauthorized medical, legal, financial advice' },
                                                { id: 'sexual_exploitation', label: 'Sexual Exploitation', desc: 'Explicit sexual content or exploitation' },
                                                { id: 'child_safety', label: 'Child Safety', desc: 'Content endangering minors' },
                                            ].map((category) => (
                                                <div
                                                    key={category.id}
                                                    className="flex items-start gap-3 p-3 rounded-lg border border-border"
                                                >
                                                    <Switch
                                                        id={`guardrail-${category.id}`}
                                                        checked={guardrailCategories.includes(category.id)}
                                                        onCheckedChange={(checked: boolean) => {
                                                            setGuardrailCategories(prev =>
                                                                checked
                                                                    ? [...prev, category.id]
                                                                    : prev.filter(c => c !== category.id)
                                                            );
                                                        }}
                                                    />
                                                    <div>
                                                        <Label htmlFor={`guardrail-${category.id}`} className="text-sm font-medium">
                                                            {category.label}
                                                        </Label>
                                                        <p className="text-xs text-muted-foreground">{category.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Webhooks */}
                <TabsContent value="webhooks" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Webhook Settings</CardTitle>
                            <CardDescription>
                                Forward call data to external services after each call
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="webhookUrl">Post-Call Webhook URL</Label>
                                <Input
                                    id="webhookUrl"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    placeholder="https://hooks.zapier.com/... or https://your-api.com/webhook"
                                />
                                <p className="text-sm text-muted-foreground">
                                    After each call ends, we&apos;ll send a POST request with call data to this URL.
                                </p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-2">
                                <p className="text-sm font-medium">Webhook Payload Example:</p>
                                <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-x-auto">
                                    {`{
  "event": "call_ended",
  "call_id": "abc123",
  "agent_id": "${agentId}",
  "duration_seconds": 120,
  "status": "completed",
  "from_number": "+1234567890",
  "to_number": "+0987654321",
  "transcript": "...",
  "summary": "...",
  "cost_cents": 50
}`}
                                </pre>
                            </div>

                            <div className="text-sm text-muted-foreground">
                                <p className="font-medium mb-1">Compatible with:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Zapier webhooks</li>
                                    <li>Make (Integromat) webhooks</li>
                                    <li>n8n webhooks</li>
                                    <li>Any custom HTTP endpoint</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Save Button */}
            <div className="flex items-center gap-4">
                <Button onClick={handleSave} disabled={saving} size="lg">
                    {saving ? 'Saving...' : 'Save All Changes'}
                </Button>
                {message && (
                    <span className={`text-sm ${message.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                        {message.text}
                    </span>
                )}
            </div>
        </div>
    );
}
