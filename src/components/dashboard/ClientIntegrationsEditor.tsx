'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Plug, Loader2, RotateCcw, Settings2, CheckCircle2,
    ArrowRight, MessageSquare, Key, Calendar, Link2, Unlink, AlertTriangle,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import type { IntegrationSource } from '@/lib/integrations/resolve';

/* ── Types ─────────────────────────────────────────────────────── */

interface IntegrationMeta {
    key: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    /** Fields the user can configure for this integration */
    fields: { name: string; label: string; type: 'text' | 'url' | 'toggle' | 'select'; placeholder?: string; optionsKey?: string; description?: string; section?: string }[];
    /** Whether this integration requires OAuth */
    requiresOAuth?: boolean;
    /** OAuth initiation URL (without clientId — appended at runtime) */
    oauthUrl?: string;
    /** Whether this integration is coming soon (disabled) */
    comingSoon?: boolean;
}

interface ClientIntegrationsEditorProps {
    clientId: string;
    /** Whether this is shown in the portal (client self-service) vs admin */
    isPortal?: boolean;
}

/* ── Integration metadata ──────────────────────────────────────── */

const INTEGRATIONS: IntegrationMeta[] = [
    {
        key: 'ghl',
        name: 'GoHighLevel',
        description: 'CRM automation — contacts, pipelines, appointments',
        icon: <ArrowRight className="h-4 w-4" />,
        fields: [
            { name: 'location_id', label: 'Location ID', type: 'text', placeholder: 'GHL Location ID', description: 'Override the agency location for this client (optional).' },
            { name: 'enabled', label: 'Enabled', type: 'toggle' },
        ],
        requiresOAuth: true,
        oauthUrl: '/api/auth/crm',
    },
    {
        key: 'hubspot',
        name: 'HubSpot',
        description: 'CRM sync — contacts, deals, call logging',
        icon: <ArrowRight className="h-4 w-4" />,
        fields: [
            { name: 'portal_id', label: 'Portal ID', type: 'text', placeholder: 'HubSpot Portal ID', description: 'Override the agency portal for this client (optional).' },
            { name: 'enabled', label: 'Enabled', type: 'toggle' },
        ],
        requiresOAuth: true,
        oauthUrl: '/api/auth/hubspot',
    },
    {
        key: 'api',
        name: 'API / Webhooks',
        description: 'Trigger calls via REST API & receive call data',
        icon: <Key className="h-4 w-4" />,
        fields: [
            { name: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://hook.make.com/...', description: 'Receive call_started and call_ended events at this URL. Works with Zapier, Make, n8n, or any HTTPS endpoint.', section: 'Incoming Webhooks' },
            { name: 'enabled', label: 'API Enabled', type: 'toggle', description: 'Allow triggering outbound calls via the REST API for this client.', section: 'Outbound API' },
            { name: 'default_agent_id', label: 'Default Agent', type: 'select', placeholder: 'Select an agent', optionsKey: 'agents', description: 'Used when no agent_id is specified in the API request.' },
        ],
    },
    {
        key: 'google_calendar',
        name: 'Google Calendar',
        description: 'Calendar availability & booking',
        icon: <Calendar className="h-4 w-4" />,
        fields: [
            { name: 'enabled', label: 'Enabled', type: 'toggle' },
        ],
        requiresOAuth: true,
    },
    {
        key: 'slack',
        name: 'Slack',
        description: 'Call notifications in Slack channels',
        icon: <MessageSquare className="h-4 w-4" />,
        fields: [
            { name: 'channel_name', label: 'Channel', type: 'text', placeholder: 'Auto-populated from OAuth', description: 'The Slack channel receiving notifications.' },
            { name: 'enabled', label: 'Enabled', type: 'toggle' },
        ],
        requiresOAuth: true,
        oauthUrl: '/api/auth/slack',
    },
    {
        key: 'calendly',
        name: 'Calendly',
        description: 'Scheduling links and booking management',
        icon: <Calendar className="h-4 w-4" />,
        fields: [
            { name: 'enabled', label: 'Enabled', type: 'toggle' },
        ],
        requiresOAuth: true,
        oauthUrl: '/api/auth/calendly',
    },
];

/* ── Component ─────────────────────────────────────────────────── */

export function ClientIntegrationsEditor({ clientId, isPortal = false }: ClientIntegrationsEditorProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data from API
    const [resolved, setResolved] = useState<Record<string, unknown> | null>(null);
    const [_clientOverrides, setClientOverrides] = useState<Record<string, unknown> | null>(null);
    const [source, setSource] = useState<Partial<Record<string, IntegrationSource>>>({});
    const [agents, setAgents] = useState<{ id: string; name: string; provider: string }[]>([]);

    // Dialog state
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editFields, setEditFields] = useState<Record<string, unknown>>({});
    const [disconnectingInteg, setDisconnectingInteg] = useState<IntegrationMeta | null>(null);

    const fetchIntegrations = useCallback(async () => {
        try {
            const [intRes, agentsRes] = await Promise.all([
                fetch(`/api/clients/${clientId}/integrations`),
                fetch('/api/agents'),
            ]);
            if (!intRes.ok) throw new Error('Failed to fetch');
            const data = await intRes.json();
            setResolved(data.resolved);
            setClientOverrides(data.clientOverrides);
            setSource(data.source);

            if (agentsRes.ok) {
                const agentsData = await agentsRes.json();
                // Filter to agents assigned to this client
                const clientAgents = (agentsData.data || [])
                    .filter((a: { client_id?: string }) => a.client_id === clientId)
                    .map((a: { id: string; name: string; provider: string }) => ({
                        id: a.id,
                        name: a.name,
                        provider: a.provider,
                    }));
                setAgents(clientAgents);
            }
        } catch {
            toast.error('Failed to load integration settings');
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchIntegrations();
    }, [fetchIntegrations]);

    const handleOpenEdit = (key: string) => {
        // Pre-fill with resolved values (which may be masked)
        const current = (resolved?.[key] as Record<string, unknown>) || {};
        // Start with empty fields — user fills fresh values for non-masked fields
        const fields: Record<string, unknown> = {};
        const meta = INTEGRATIONS.find(i => i.key === key);
        if (meta) {
            for (const f of meta.fields) {
                if (f.type === 'toggle') {
                    fields[f.name] = current[f.name] ?? false;
                } else if (f.type === 'select') {
                    // Always pre-fill select values (they aren't masked)
                    fields[f.name] = current[f.name] ?? '';
                } else {
                    // Don't pre-fill masked values
                    const val = current[f.name];
                    fields[f.name] = (typeof val === 'string' && val.startsWith('...')) ? '' : (val ?? '');
                }
            }
        }
        setEditFields(fields);
        setEditingKey(key);
    };

    const handleSave = async () => {
        if (!editingKey) return;
        setSaving(true);
        try {
            // Build the update — only include non-empty fields
            const update: Record<string, unknown> = {};
            const meta = INTEGRATIONS.find(i => i.key === editingKey);
            if (meta) {
                for (const f of meta.fields) {
                    const val = editFields[f.name];
                    if (f.type === 'toggle') {
                        update[f.name] = val;
                    } else if (typeof val === 'string' && val.length > 0) {
                        update[f.name] = val;
                    }
                    // Skip empty strings to preserve existing values
                }
            }

            const res = await fetch(`/api/clients/${clientId}/integrations`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ integrations: { [editingKey]: update } }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save');
            }

            toast.success('Integration settings saved');
            setEditingKey(null);
            await fetchIntegrations();
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleResetToDefault = async (key: string) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/clients/${clientId}/integrations?key=${key}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to reset');
            toast.success('Reset to agency default');
            await fetchIntegrations();
            router.refresh();
        } catch {
            toast.error('Failed to reset integration');
        } finally {
            setSaving(false);
        }
    };

    const getSourceBadge = (key: string) => {
        const s = source[key];
        if (s === 'client') {
            return (
                <Badge variant="default" className="text-xs bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 hover:bg-violet-100">
                    Client Override
                </Badge>
            );
        }
        if (s === 'agency') {
            return (
                <Badge variant="secondary" className="text-xs">
                    Agency Default
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="text-xs text-muted-foreground">
                Not Configured
            </Badge>
        );
    };

    const isConfigured = (key: string) => source[key] === 'client' || source[key] === 'agency';

    /** Check if a client has its own OAuth tokens (not inherited from agency) */
    const hasClientOAuth = (key: string) => {
        if (source[key] !== 'client') return false;
        const config = resolved?.[key] as Record<string, unknown> | undefined;
        return !!config?.access_token;
    };

    /** Check if the resolved config has an active OAuth connection (from any source) */
    const hasOAuthConnection = (key: string) => {
        const config = resolved?.[key] as Record<string, unknown> | undefined;
        return !!config?.access_token;
    };

    const handleOAuthConnect = (oauthUrl: string) => {
        window.location.href = `${oauthUrl}?clientId=${clientId}`;
    };

    const handleOAuthDisconnect = (integ: IntegrationMeta) => {
        setDisconnectingInteg(integ);
    };

    const confirmDisconnect = () => {
        if (!disconnectingInteg?.oauthUrl) return;
        window.location.href = `${disconnectingInteg.oauthUrl}?action=disconnect&clientId=${clientId}`;
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Plug className="h-5 w-5" />
                        Integrations
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Plug className="h-5 w-5" />
                        {isPortal ? 'Integrations' : 'Client Integrations'}
                    </CardTitle>
                    <CardDescription>
                        {isPortal
                            ? 'Configure your own integrations or use agency defaults.'
                            : 'Override agency integration settings for this client. Unset fields fall back to agency defaults.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {INTEGRATIONS.map((integ) => (
                            <div
                                key={integ.key}
                                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        {integ.icon}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{integ.name}</span>
                                            {getSourceBadge(integ.key)}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{integ.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {integ.comingSoon ? (
                                        <Badge variant="outline" className="text-xs text-muted-foreground">
                                            Coming Soon
                                        </Badge>
                                    ) : integ.requiresOAuth && integ.oauthUrl ? (
                                        <>
                                            {hasClientOAuth(integ.key) ? (
                                                <>
                                                    <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
                                                        Connected
                                                    </Badge>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleOpenEdit(integ.key)}
                                                    >
                                                        <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                                                        Configure
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleOAuthDisconnect(integ)}
                                                        title="Disconnect this client's CRM"
                                                    >
                                                        <Unlink className="h-3.5 w-3.5" />
                                                    </Button>
                                                </>
                                            ) : hasOAuthConnection(integ.key) ? (
                                                <>
                                                    <Badge variant="secondary" className="text-xs" title={
                                                        (() => {
                                                            const config = resolved?.[integ.key] as Record<string, unknown> | undefined;
                                                            const id = config?.location_id || config?.oauth_location_id || config?.portal_id;
                                                            return id ? `Connected to: ${id}` : undefined;
                                                        })()
                                                    }>
                                                        Using Agency
                                                    </Badge>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleOAuthConnect(integ.oauthUrl!)}
                                                    >
                                                        <Link2 className="h-3.5 w-3.5 mr-1.5" />
                                                        Connect Own
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOAuthConnect(integ.oauthUrl!)}
                                                >
                                                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                                                    Connect
                                                </Button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {source[integ.key] === 'client' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleResetToDefault(integ.key)}
                                                    disabled={saving}
                                                    title="Reset to agency default"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleOpenEdit(integ.key)}
                                            >
                                                {isConfigured(integ.key) ? (
                                                    <>
                                                        <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                                                        Configure
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                        Set Up
                                                    </>
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={!!editingKey} onOpenChange={(open: boolean) => !open && setEditingKey(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Configure {INTEGRATIONS.find(i => i.key === editingKey)?.name}
                        </DialogTitle>
                        <DialogDescription>
                            {source[editingKey || ''] === 'agency'
                                ? 'Currently using agency defaults. Set values below to override for this client.'
                                : source[editingKey || ''] === 'client'
                                    ? 'This client has custom settings. Edit below or reset to agency defaults.'
                                    : 'No configuration exists yet. Set values below to configure.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {(() => {
                            const fields = INTEGRATIONS.find(i => i.key === editingKey)?.fields || [];
                            let lastSection: string | undefined;
                            return fields.map((field) => {
                                const showSection = field.section && field.section !== lastSection;
                                if (field.section) lastSection = field.section;
                                return (
                                    <div key={field.name}>
                                        {showSection && (
                                            <>
                                                {lastSection !== fields.find(f => f.section)?.section && <Separator />}
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{field.section}</p>
                                            </>
                                        )}
                                        {field.type === 'toggle' ? (
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <Label htmlFor={`field-${field.name}`}>{field.label}</Label>
                                                    <Switch
                                                        id={`field-${field.name}`}
                                                        checked={!!editFields[field.name]}
                                                        onCheckedChange={(v: boolean) =>
                                                            setEditFields(prev => ({ ...prev, [field.name]: v }))
                                                        }
                                                    />
                                                </div>
                                                {field.description && (
                                                    <p className="text-xs text-muted-foreground">{field.description}</p>
                                                )}
                                            </div>
                                        ) : field.type === 'select' && field.optionsKey === 'agents' ? (
                                            <div className="space-y-1.5">
                                                <Label htmlFor={`field-${field.name}`}>{field.label}</Label>
                                                <Select
                                                    value={(editFields[field.name] as string) || 'none'}
                                                    onValueChange={(v: string) =>
                                                        setEditFields(prev => ({ ...prev, [field.name]: v === 'none' ? '' : v }))
                                                    }
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder={field.placeholder || 'Select an agent'} />
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
                                                {agents.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">No agents assigned to this client yet.</p>
                                                ) : field.description ? (
                                                    <p className="text-xs text-muted-foreground">{field.description}</p>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <Label htmlFor={`field-${field.name}`}>{field.label}</Label>
                                                <Input
                                                    id={`field-${field.name}`}
                                                    value={(editFields[field.name] as string) || ''}
                                                    onChange={(e) =>
                                                        setEditFields(prev => ({ ...prev, [field.name]: e.target.value }))
                                                    }
                                                    placeholder={field.placeholder}
                                                    className="text-sm"
                                                />
                                                {field.description && (
                                                    <p className="text-xs text-muted-foreground">{field.description}</p>
                                                )}
                                                {/* Show hint when a field has an existing value (was masked) but is now blank */}
                                                {!editFields[field.name] && isConfigured(editingKey || '') && !field.description && (
                                                    <p className="text-xs text-muted-foreground">Leave blank to keep existing value</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}

                        {INTEGRATIONS.find(i => i.key === editingKey)?.requiresOAuth && (
                            <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                {hasClientOAuth(editingKey || '')
                                    ? 'This client has its own CRM connection. Settings below apply to this client only.'
                                    : source[editingKey || ''] === 'agency'
                                        ? 'Currently using the agency CRM connection. You can connect this client\'s own CRM account from the integrations list.'
                                        : 'Connect this client\'s CRM account from the integrations list to enable this integration.'}
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingKey(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Disconnect Confirmation Dialog */}
            <Dialog open={!!disconnectingInteg} onOpenChange={(open: boolean) => !open && setDisconnectingInteg(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Disconnect {disconnectingInteg?.name}?
                        </DialogTitle>
                        <DialogDescription>
                            This will remove this client&apos;s {disconnectingInteg?.name} connection.
                            {source[disconnectingInteg?.key || ''] === 'client' && (
                                <> The agency&apos;s connection will be used as a fallback if available.</>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDisconnectingInteg(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDisconnect}>
                            Disconnect
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
