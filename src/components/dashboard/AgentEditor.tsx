'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { AlertTriangle, Sparkles, Loader2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

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

// Common voice options for Retell (comprehensive list)
const RETELL_VOICES = [
    // ElevenLabs voices
    { id: '11labs-Adrian', name: 'Adrian (Male)' },
    { id: '11labs-Aria', name: 'Aria (Female)' },
    { id: '11labs-Brian', name: 'Brian (Male)' },
    { id: '11labs-Callum', name: 'Callum (Male)' },
    { id: '11labs-Charlotte', name: 'Charlotte (Female)' },
    { id: '11labs-Chris', name: 'Chris (Male)' },
    { id: '11labs-Cimo', name: 'Cimo (Male)' },
    { id: '11labs-Daniel', name: 'Daniel (Male)' },
    { id: '11labs-Drew', name: 'Drew (Male)' },
    { id: '11labs-Emily', name: 'Emily (Female)' },
    { id: '11labs-Eric', name: 'Eric (Male)' },
    { id: '11labs-George', name: 'George (Male)' },
    { id: '11labs-Jason', name: 'Jason (Male)' },
    { id: '11labs-Jessica', name: 'Jessica (Female)' },
    { id: '11labs-Josh', name: 'Josh (Male)' },
    { id: '11labs-Julia', name: 'Julia (Female)' },
    { id: '11labs-Laura', name: 'Laura (Female)' },
    { id: '11labs-Lily', name: 'Lily (Female)' },
    { id: '11labs-Marissa', name: 'Marissa (Female)' },
    { id: '11labs-Matilda', name: 'Matilda (Female)' },
    { id: '11labs-Myra', name: 'Myra (Female)' },
    { id: '11labs-Nyla', name: 'Nyla (Female)' },
    { id: '11labs-Paul', name: 'Paul (Male)' },
    { id: '11labs-Rachel', name: 'Rachel (Female)' },
    { id: '11labs-River', name: 'River (Non-binary)' },
    { id: '11labs-Roger', name: 'Roger (Male)' },
    { id: '11labs-Sarah', name: 'Sarah (Female)' },
    { id: '11labs-Susan', name: 'Susan (Female)' },
    { id: '11labs-Will', name: 'Will (Male)' },
    // OpenAI voices
    { id: 'openai-Alloy', name: 'OpenAI Alloy' },
    { id: 'openai-Coral', name: 'OpenAI Coral' },
    { id: 'openai-Echo', name: 'OpenAI Echo' },
    { id: 'openai-Fable', name: 'OpenAI Fable' },
    { id: 'openai-Nova', name: 'OpenAI Nova' },
    { id: 'openai-Onyx', name: 'OpenAI Onyx' },
    { id: 'openai-Shimmer', name: 'OpenAI Shimmer' },
];

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
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [loadingPrompt, setLoadingPrompt] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Local state
    const [active, setActive] = useState(isActive);
    const [selectedClient, setSelectedClient] = useState(clientId || '');

    // Agent config state (for Retell)
    const [agentName, setAgentName] = useState((config as { agent_name?: string }).agent_name || '');
    const [voiceId, setVoiceId] = useState((config as { voice_id?: string }).voice_id || '');
    const [language, setLanguage] = useState((config as { language?: string }).language || 'en-US');
    const [prompt, setPrompt] = useState('');
    const [responsiveness, setResponsiveness] = useState(
        (config as { responsiveness?: number }).responsiveness || 0.8
    );

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
                        if (data.data.agent_name) setAgentName(data.data.agent_name);
                        if (data.data.voice_id) setVoiceId(data.data.voice_id);
                        if (data.data.language) setLanguage(data.data.language);
                        if (data.data.responsiveness) setResponsiveness(data.data.responsiveness);
                    }
                }
            } catch (err) {
                console.error('Error fetching provider data:', err);
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

            // Retell-specific fields
            if (provider === 'retell') {
                providerPayload.voice_id = voiceId;
                providerPayload.language = language;
                providerPayload.responsiveness = responsiveness;
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
            router.refresh();
        } catch (_err) {
            setMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* VAPI Limitations Warning */}
            {provider === 'vapi' && (
                <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800 dark:text-yellow-200">Limited VAPI Support</AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                        Some features are not yet available for VAPI agents:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Voice & language selection from this dashboard</li>
                            <li>Knowledge base management</li>
                        </ul>
                        <p className="mt-2">
                            Please manage these features directly in your VAPI dashboard.
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
                    {provider === 'retell' && (
                        <TabsTrigger value="voice" className="flex-1">Voice & Language</TabsTrigger>
                    )}
                    <TabsTrigger value="prompt" className="flex-1">Prompt</TabsTrigger>
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
                            <div className="space-y-2">
                                <Label>Voice</Label>
                                <Select value={voiceId || 'select-voice'} onValueChange={(v: string) => setVoiceId(v === 'select-voice' ? '' : v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a voice" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="select-voice">Select a voice...</SelectItem>
                                        {RETELL_VOICES.map((voice) => (
                                            <SelectItem key={voice.id} value={voice.id}>
                                                {voice.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

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
                            </div>

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
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Prompt */}
                <TabsContent value="prompt" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Agent Prompt</CardTitle>
                            <CardDescription>
                                {loadingPrompt ? 'Loading from provider...' : 'Define your agent&apos;s personality and behavior'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                                    <div className="p-1 rounded-md bg-gradient-to-br from-violet-500 to-purple-600">
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
                                        {suggestions.map((suggestion, i) => (
                                            <div
                                                key={i}
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
