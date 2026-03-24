'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Key,
    Copy,
    Check,
    RefreshCw,
    Loader2,
    AlertTriangle,
    ExternalLink,
    Eye,
    EyeOff,
    Code2,
    Settings2,
    BookOpen,
} from 'lucide-react';

interface Agent {
    id: string;
    name: string;
    provider: string;
}

interface ApiConfig {
    api_key?: string;
    enabled?: boolean;
    default_agent_id?: string;
    webhook_url?: string;
    webhook_signing_secret?: string;
}

interface WebhookDelivery {
    id: string;
    call_id?: string;
    event: string;
    webhook_url: string;
    status_code?: number;
    success: boolean;
    error_message?: string;
    attempt: number;
    created_at: string;
}

interface ApiWebhooksConfigProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    apiConfig?: ApiConfig;
    agents: Agent[];
    appUrl: string;
}

// ── Constants ────────────────────────────────────────────

/** Prefix for all generated API keys — makes them identifiable in logs */
const API_KEY_PREFIX = 'pdy_sk_';

/** How long success/copy feedback stays visible (ms) */
const FEEDBACK_DURATION_MS = 3000;
const COPY_FEEDBACK_DURATION_MS = 2000;

/** API endpoints used by this component */
const ENDPOINTS = {
    settings: '/api/settings',
    deliveries: '/api/webhook-deliveries',
    testWebhook: '/api/webhooks/test',
    triggerCall: '/api/trigger-call',
} as const;

// ── Helpers ──────────────────────────────────────────────

/** Generate a pdy_sk_ prefixed API key (64 hex chars from 32 random bytes) */
function generateApiKey(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    return `${API_KEY_PREFIX}${hex}`;
}

/** Mask a string for display — shows only last N chars */
function maskSecret(value: string, visibleChars = 0): string {
    return visibleChars > 0
        ? '\u2022'.repeat(16) + value.slice(-visibleChars)
        : '\u2022'.repeat(16);
}

/**
 * API / Webhooks configuration dialog.
 *
 * Two tabs:
 *   Settings — API key management, enable/disable, default agent, webhook URL, delivery log
 *   Docs     — Endpoint reference, auth, request body schema, cURL example, Zapier config
 *
 * State is optimistically updated — UI changes immediately, then reverts on save failure.
 * The API key is shown only once after generation (server stores a hash, not the raw key).
 */
export function ApiWebhooksConfig({
    open,
    onOpenChange,
    apiConfig,
    agents,
    appUrl,
}: ApiWebhooksConfigProps) {
    const [activeTab, setActiveTab] = useState<'settings' | 'docs'>('settings');
    const [enabled, setEnabled] = useState(apiConfig?.enabled ?? false);
    const [defaultAgentId, setDefaultAgentId] = useState(apiConfig?.default_agent_id ?? '');
    const [webhookUrl, setWebhookUrl] = useState(apiConfig?.webhook_url ?? '');
    const [maskedKey, setMaskedKey] = useState(apiConfig?.api_key);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [copiedItem, setCopiedItem] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showRegenConfirm, setShowRegenConfirm] = useState(false);
    const [signingSecret] = useState(apiConfig?.webhook_signing_secret ?? '');
    const [showSigningSecret, setShowSigningSecret] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; status_code?: number; error?: string } | null>(null);
    const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
    const [loadingDeliveries, setLoadingDeliveries] = useState(false);
    const successTimerRef = useRef<NodeJS.Timeout | null>(null);
    const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (successTimerRef.current) clearTimeout(successTimerRef.current);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        };
    }, []);

    // Fetch delivery log when dialog opens
    useEffect(() => {
        if (open && webhookUrl) {
            fetchDeliveries();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const fetchDeliveries = async () => {
        setLoadingDeliveries(true);
        try {
            const res = await fetch(ENDPOINTS.deliveries);
            if (res.ok) {
                const data = await res.json();
                setDeliveries(data.deliveries || []);
            }
        } catch {
            // Silent fail — delivery log is informational
        } finally {
            setLoadingDeliveries(false);
        }
    };

    const handleTestWebhook = async () => {
        setTesting(true);
        setTestResult(null);
        setError(null);
        try {
            const res = await fetch(ENDPOINTS.testWebhook, { method: 'POST' });
            const data = await res.json();
            setTestResult(data);
            // Refresh deliveries after test
            fetchDeliveries();
        } catch {
            setTestResult({ success: false, error: 'Request failed' });
        } finally {
            setTesting(false);
        }
    };

    const hasKey = !!maskedKey || !!newKey;

    /** Save API settings. Returns true on success, false on failure. */
    const saveSettings = useCallback(async (updates: Record<string, unknown>): Promise<boolean> => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch(ENDPOINTS.settings, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ integrations: { api: updates } }),
            });
            if (!res.ok) {
                let errorMsg = `Failed to save (${res.status})`;
                try {
                    const data = await res.json();
                    if (data.error) errorMsg = data.error;
                } catch {
                    // Response was not JSON (e.g. 502 gateway error)
                }
                throw new Error(errorMsg);
            }
            setSuccess('Settings saved');
            if (successTimerRef.current) clearTimeout(successTimerRef.current);
            successTimerRef.current = setTimeout(() => setSuccess(null), FEEDBACK_DURATION_MS);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
            return false;
        } finally {
            setSaving(false);
        }
    }, []);

    const handleGenerateKey = async () => {
        setGenerating(true);
        setError(null);
        const key = generateApiKey();
        const saved = await saveSettings({ api_key: key, enabled: true });
        if (saved) {
            setNewKey(key);
            setShowKey(true);
            setMaskedKey('...' + key.slice(-4));
            setEnabled(true);
        }
        setGenerating(false);
    };

    const handleRegenerateKey = () => {
        // If a key already exists, confirm before regenerating
        if (hasKey) {
            setShowRegenConfirm(true);
        } else {
            handleGenerateKey();
        }
    };

    const handleToggleEnabled = async (value: boolean) => {
        const prev = enabled;
        setEnabled(value);
        const saved = await saveSettings({ enabled: value });
        if (!saved) setEnabled(prev);
    };

    const handleSetDefaultAgent = async (agentId: string) => {
        const prev = defaultAgentId;
        const actualValue = agentId === 'none' ? null : agentId;
        setDefaultAgentId(actualValue ?? '');
        const saved = await saveSettings({ default_agent_id: actualValue });
        if (!saved) setDefaultAgentId(prev);
    };

    const handleSaveWebhookUrl = async () => {
        const trimmed = webhookUrl.trim();
        if (trimmed && !trimmed.startsWith('https://')) {
            setError('Webhook URL must start with https://');
            return;
        }
        const saved = await saveSettings({ webhook_url: trimmed || null });
        if (!saved) return;
    };

    const handleCopy = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedItem(id);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            copyTimerRef.current = setTimeout(() => setCopiedItem(null), COPY_FEEDBACK_DURATION_MS);
        } catch {
            setError('Failed to copy to clipboard');
        }
    };

    const curlExample = `curl -X POST ${appUrl}${ENDPOINTS.triggerCall} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone_number": "+14155551234",
    "agent_id": "${agents[0]?.id || 'AGENT_ID'}",
    "contact_name": "John Doe",
    "metadata": {
      "source": "zapier",
      "lead_id": "12345"
    }
  }'`;

    const zapierNote = `Endpoint: ${appUrl}${ENDPOINTS.triggerCall}
Method: POST
Auth: Bearer Token (your API key)`;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5" />
                            API / Webhooks Configuration
                        </DialogTitle>
                        <DialogDescription>
                            Trigger outbound calls from Zapier, Make.com, n8n, or any HTTP client
                        </DialogDescription>
                    </DialogHeader>

                    {/* Tab Switcher */}
                    <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="API configuration tabs">
                        <button
                            role="tab"
                            aria-selected={activeTab === 'settings'}
                            aria-controls="panel-settings"
                            id="tab-settings"
                            onClick={() => setActiveTab('settings')}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                activeTab === 'settings'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Settings2 className="h-4 w-4" />
                            Settings
                        </button>
                        <button
                            role="tab"
                            aria-selected={activeTab === 'docs'}
                            aria-controls="panel-docs"
                            id="tab-docs"
                            onClick={() => setActiveTab('docs')}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                activeTab === 'docs'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <BookOpen className="h-4 w-4" />
                            API Docs
                        </button>
                    </div>

                    {/* Error / Success Messages */}
                    {error && (
                        <div role="alert" className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div role="status" className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-700 dark:text-green-400">
                            <Check className="h-4 w-4 flex-shrink-0" />
                            {success}
                        </div>
                    )}

                    {activeTab === 'settings' ? (
                        <div id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" className="space-y-6">
                            {/* API Key Section */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">API Key</Label>
                                {!hasKey ? (
                                    <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
                                        <Key className="h-8 w-8 mx-auto text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">
                                            No API key generated yet. Generate one to start using the API.
                                        </p>
                                        <Button
                                            onClick={handleGenerateKey}
                                            disabled={generating}
                                        >
                                            {generating ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Key className="h-4 w-4 mr-2" />
                                            )}
                                            Generate API Key
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Show the key */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                                                {newKey ? (
                                                    <>
                                                        <span className="flex-1 break-all">
                                                            {showKey ? newKey : maskSecret(newKey, 4)}
                                                        </span>
                                                        <button
                                                            onClick={() => setShowKey(!showKey)}
                                                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                                                            title={showKey ? 'Hide key' : 'Show key'}
                                                            aria-label={showKey ? 'Hide API key' : 'Show API key'}
                                                        >
                                                            {showKey ? (
                                                                <EyeOff className="h-4 w-4" />
                                                            ) : (
                                                                <Eye className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground">{maskedKey}</span>
                                                )}
                                            </div>
                                            {newKey && (
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleCopy(newKey, 'api-key')}
                                                    title="Copy API key"
                                                    aria-label="Copy API key"
                                                >
                                                    {copiedItem === 'api-key' ? (
                                                        <Check className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            )}
                                        </div>

                                        {newKey && (
                                            <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-400">
                                                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                                <span>
                                                    Copy this key now — it won&apos;t be shown again.
                                                    If you lose it, you&apos;ll need to regenerate a new one.
                                                </span>
                                            </div>
                                        )}

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleRegenerateKey}
                                            disabled={generating}
                                        >
                                            {generating ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-4 w-4 mr-2" />
                                            )}
                                            Regenerate Key
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Enable/Disable */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">Enable API</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Allow triggering calls via the API endpoint
                                    </p>
                                </div>
                                <Switch
                                    checked={enabled}
                                    onCheckedChange={handleToggleEnabled}
                                    disabled={saving || !hasKey}
                                />
                            </div>

                            <Separator />

                            {/* Default Agent */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Default Agent</Label>
                                <p className="text-xs text-muted-foreground">
                                    Used when no <code className="px-1 py-0.5 rounded bg-muted text-xs">agent_id</code> is
                                    specified in the API request
                                </p>
                                <Select
                                    value={defaultAgentId || 'none'}
                                    onValueChange={handleSetDefaultAgent}
                                    disabled={saving}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a default agent" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No default agent</SelectItem>
                                        {agents.map((agent) => (
                                            <SelectItem key={agent.id} value={agent.id}>
                                                <div className="flex items-center gap-2">
                                                    {agent.name}
                                                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                        {agent.provider}
                                                    </Badge>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Separator />

                            {/* Webhook URL */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Webhook URL</Label>
                                <p className="text-xs text-muted-foreground">
                                    Receive call data (call_started + call_ended events) at this URL. Works with
                                    Make, Zapier, n8n, or any HTTPS endpoint.
                                </p>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={webhookUrl}
                                        onChange={(e) => setWebhookUrl(e.target.value)}
                                        placeholder="https://hook.make.com/..."
                                        className="text-sm font-mono"
                                        disabled={saving}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSaveWebhookUrl}
                                        disabled={saving}
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                                    </Button>
                                    {webhookUrl && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleTestWebhook}
                                            disabled={testing || saving}
                                        >
                                            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                                        </Button>
                                    )}
                                </div>
                                {testResult && (
                                    <div className={`text-xs px-2 py-1 rounded ${testResult.success ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                                        {testResult.success
                                            ? `✓ Test webhook delivered (HTTP ${testResult.status_code})`
                                            : `✗ Test failed: ${testResult.error || `HTTP ${testResult.status_code}`}`
                                        }
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Clients can override this with their own webhook URL in their integration settings.
                                    Leave blank to disable.
                                </p>
                            </div>

                            {/* Webhook Signing Secret */}
                            {signingSecret && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">Webhook Signing Secret</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Verify webhook authenticity by checking the <code className="text-[11px] bg-muted px-1 rounded">X-Prosody-Signature</code> header.
                                            Signature = HMAC-SHA256(secret, &quot;{'{timestamp}.{body}'}&quot;).
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono truncate">
                                                {showSigningSecret ? signingSecret : maskSecret(signingSecret)}
                                            </code>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setShowSigningSecret(!showSigningSecret)}
                                                title={showSigningSecret ? 'Hide secret' : 'Show secret'}
                                            >
                                                {showSigningSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleCopy(signingSecret, 'signing-secret')}
                                                title="Copy signing secret"
                                            >
                                                {copiedItem === 'signing-secret' ? (
                                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                                ) : (
                                                    <Copy className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Recent Webhook Deliveries */}
                            {webhookUrl && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-medium">Recent Deliveries</Label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={fetchDeliveries}
                                                disabled={loadingDeliveries}
                                            >
                                                {loadingDeliveries ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                            </Button>
                                        </div>
                                        {deliveries.length === 0 ? (
                                            <p className="text-xs text-muted-foreground py-2">
                                                No webhook deliveries yet. Send a test or wait for a call to complete.
                                            </p>
                                        ) : (
                                            <div className="rounded-md border overflow-hidden">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="bg-muted/50 border-b">
                                                            <th className="text-left px-2 py-1.5 font-medium">Event</th>
                                                            <th className="text-left px-2 py-1.5 font-medium">Status</th>
                                                            <th className="text-left px-2 py-1.5 font-medium">Time</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {deliveries.slice(0, 10).map((d) => (
                                                            <tr key={d.id}>
                                                                <td className="px-2 py-1.5 font-mono">{d.event}</td>
                                                                <td className="px-2 py-1.5">
                                                                    {d.success ? (
                                                                        <Badge variant="secondary" className="text-green-700 dark:text-green-400 text-[10px] px-1 py-0">
                                                                            {d.status_code || 'OK'}
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                                                            {d.status_code || 'Error'}
                                                                        </Badge>
                                                                    )}
                                                                    {d.error_message && !d.success && (
                                                                        <span className="ml-1 text-muted-foreground">{d.error_message}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-2 py-1.5 text-muted-foreground">
                                                                    {new Date(d.created_at).toLocaleString(undefined, {
                                                                        month: 'short', day: 'numeric',
                                                                        hour: '2-digit', minute: '2-digit',
                                                                    })}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        /* API Documentation Tab */
                        <div id="panel-docs" role="tabpanel" aria-labelledby="tab-docs" className="space-y-6">
                            {/* Endpoint */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Endpoint</Label>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-green-700 dark:text-green-400 text-xs">POST</Badge>
                                    <code className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono">
                                        {appUrl}{ENDPOINTS.triggerCall}
                                    </code>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleCopy(`${appUrl}${ENDPOINTS.triggerCall}`, 'endpoint')}
                                        title="Copy endpoint URL"
                                        aria-label="Copy endpoint URL"
                                    >
                                        {copiedItem === 'endpoint' ? (
                                            <Check className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Authentication */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Authentication</Label>
                                <p className="text-sm text-muted-foreground">
                                    Include your API key as a Bearer token in the Authorization header:
                                </p>
                                <code className="block rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono">
                                    Authorization: Bearer pdy_sk_...
                                </code>
                            </div>

                            <Separator />

                            {/* Request Body */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Request Body (JSON)</Label>
                                <div className="rounded-md border overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/50 border-b">
                                                <th className="text-left px-3 py-2 font-medium">Field</th>
                                                <th className="text-left px-3 py-2 font-medium">Type</th>
                                                <th className="text-left px-3 py-2 font-medium">Required</th>
                                                <th className="text-left px-3 py-2 font-medium">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            <tr>
                                                <td className="px-3 py-2 font-mono text-xs">phone_number</td>
                                                <td className="px-3 py-2 text-muted-foreground">string</td>
                                                <td className="px-3 py-2"><Badge variant="destructive" className="text-[10px]">Required</Badge></td>
                                                <td className="px-3 py-2 text-muted-foreground">E.164 format (e.g., +14155551234)</td>
                                            </tr>
                                            <tr>
                                                <td className="px-3 py-2 font-mono text-xs">agent_id</td>
                                                <td className="px-3 py-2 text-muted-foreground">string</td>
                                                <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">Optional</Badge></td>
                                                <td className="px-3 py-2 text-muted-foreground">Agent UUID (falls back to default agent)</td>
                                            </tr>
                                            <tr>
                                                <td className="px-3 py-2 font-mono text-xs">from_number</td>
                                                <td className="px-3 py-2 text-muted-foreground">string</td>
                                                <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">Optional</Badge></td>
                                                <td className="px-3 py-2 text-muted-foreground">Caller ID phone number</td>
                                            </tr>
                                            <tr>
                                                <td className="px-3 py-2 font-mono text-xs">contact_name</td>
                                                <td className="px-3 py-2 text-muted-foreground">string</td>
                                                <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">Optional</Badge></td>
                                                <td className="px-3 py-2 text-muted-foreground">Name of the contact being called</td>
                                            </tr>
                                            <tr>
                                                <td className="px-3 py-2 font-mono text-xs">metadata</td>
                                                <td className="px-3 py-2 text-muted-foreground">object</td>
                                                <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">Optional</Badge></td>
                                                <td className="px-3 py-2 text-muted-foreground">Custom key-value pairs (max 10KB)</td>
                                            </tr>
                                            <tr>
                                                <td className="px-3 py-2 font-mono text-xs">scheduled_at</td>
                                                <td className="px-3 py-2 text-muted-foreground">string</td>
                                                <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">Optional</Badge></td>
                                                <td className="px-3 py-2 text-muted-foreground">ISO 8601 datetime to schedule call</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <Separator />

                            {/* cURL Example */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium flex items-center gap-2">
                                        <Code2 className="h-4 w-4" />
                                        cURL Example
                                    </Label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => handleCopy(curlExample, 'curl')}
                                    >
                                        {copiedItem === 'curl' ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                                        Copy
                                    </Button>
                                </div>
                                <pre className="rounded-md border bg-slate-950 dark:bg-slate-900/50 p-4 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">
                                    {curlExample}
                                </pre>
                            </div>

                            <Separator />

                            {/* Response */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Successful Response</Label>
                                <pre className="rounded-md border bg-slate-950 dark:bg-slate-900/50 p-4 text-xs text-green-400 overflow-x-auto">
{`{
  "success": true,
  "status": "initiated",
  "call_id": "call_abc123...",
  "lead_timezone": "America/New_York",
  "agent": "Sales Agent"
}`}
                                </pre>
                            </div>

                            {/* Zapier / Make.com */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    <ExternalLink className="h-4 w-4" />
                                    Zapier / Make.com / n8n
                                </Label>
                                <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-sm">
                                    <p className="text-muted-foreground">
                                        Use the &quot;HTTP / Webhook&quot; module in your automation tool:
                                    </p>
                                    <div className="space-y-1 font-mono text-xs">
                                        {zapierNote.split('\n').map((line) => (
                                            <p key={line}>{line}</p>
                                        ))}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs mt-2"
                                        onClick={() => handleCopy(zapierNote, 'zapier')}
                                    >
                                        {copiedItem === 'zapier' ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                                        Copy Config
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Regenerate Key Confirmation */}
            <AlertDialog open={showRegenConfirm} onOpenChange={setShowRegenConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will invalidate your current API key immediately. Any existing
                            integrations (Zapier, Make.com, n8n, etc.) using the old key will
                            stop working until updated with the new key.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleGenerateKey}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Regenerate Key
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
