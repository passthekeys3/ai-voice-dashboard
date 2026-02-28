'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Plug, Loader2, RotateCcw, Settings2, CheckCircle2,
    ArrowRight, MessageSquare, Key, Calendar,
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
    fields: { name: string; label: string; type: 'text' | 'url' | 'toggle'; placeholder?: string }[];
    /** Whether this integration requires OAuth (Phase 2) */
    requiresOAuth?: boolean;
}

interface ClientIntegrationsEditorProps {
    clientId: string;
    /** Whether this is shown in the portal (client self-service) vs admin */
    isPortal?: boolean;
}

/* ── Integration metadata ──────────────────────────────────────── */

const INTEGRATIONS: IntegrationMeta[] = [
    {
        key: 'slack',
        name: 'Slack',
        description: 'Call notifications in Slack channels',
        icon: <MessageSquare className="h-4 w-4" />,
        fields: [
            { name: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://hooks.slack.com/services/...' },
            { name: 'channel_name', label: 'Channel Name', type: 'text', placeholder: '#call-notifications' },
            { name: 'enabled', label: 'Enabled', type: 'toggle' },
        ],
    },
    {
        key: 'api',
        name: 'API / Webhooks',
        description: 'Trigger calls via REST API & receive call data',
        icon: <Key className="h-4 w-4" />,
        fields: [
            { name: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://hook.make.com/...' },
            { name: 'enabled', label: 'Enabled', type: 'toggle' },
            { name: 'default_agent_id', label: 'Default Agent ID', type: 'text', placeholder: 'Agent UUID' },
        ],
    },
    {
        key: 'calendly',
        name: 'Calendly',
        description: 'Scheduling links and booking management',
        icon: <Calendar className="h-4 w-4" />,
        fields: [
            { name: 'api_token', label: 'API Token', type: 'text', placeholder: 'Calendly personal access token' },
            { name: 'user_uri', label: 'User URI', type: 'text', placeholder: 'https://api.calendly.com/users/...' },
            { name: 'default_event_type_uri', label: 'Event Type URI', type: 'text', placeholder: 'https://api.calendly.com/event_types/...' },
            { name: 'enabled', label: 'Enabled', type: 'toggle' },
        ],
    },
    {
        key: 'ghl',
        name: 'GoHighLevel',
        description: 'CRM automation (API key mode)',
        icon: <ArrowRight className="h-4 w-4" />,
        fields: [
            { name: 'api_key', label: 'API Key', type: 'text', placeholder: 'GHL API key' },
            { name: 'location_id', label: 'Location ID', type: 'text', placeholder: 'GHL Location ID' },
            { name: 'enabled', label: 'Enabled', type: 'toggle' },
        ],
        requiresOAuth: true,
    },
    {
        key: 'hubspot',
        name: 'HubSpot',
        description: 'CRM sync (OAuth required)',
        icon: <ArrowRight className="h-4 w-4" />,
        fields: [
            { name: 'enabled', label: 'Enabled', type: 'toggle' },
        ],
        requiresOAuth: true,
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
];

/* ── Component ─────────────────────────────────────────────────── */

export function ClientIntegrationsEditor({ clientId, isPortal = false }: ClientIntegrationsEditorProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data from API
    const [resolved, setResolved] = useState<Record<string, unknown> | null>(null);
    const [clientOverrides, setClientOverrides] = useState<Record<string, unknown> | null>(null);
    const [source, setSource] = useState<Partial<Record<string, IntegrationSource>>>({});

    // Dialog state
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editFields, setEditFields] = useState<Record<string, unknown>>({});

    const fetchIntegrations = useCallback(async () => {
        try {
            const res = await fetch(`/api/clients/${clientId}/integrations`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setResolved(data.resolved);
            setClientOverrides(data.clientOverrides);
            setSource(data.source);
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
                        {INTEGRATIONS.find(i => i.key === editingKey)?.fields.map((field) => (
                            <div key={field.name}>
                                {field.type === 'toggle' ? (
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
                                        {/* Show hint when a field has an existing value (was masked) but is now blank */}
                                        {!editFields[field.name] && isConfigured(editingKey || '') && (
                                            <p className="text-xs text-muted-foreground">Leave blank to keep existing value</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {INTEGRATIONS.find(i => i.key === editingKey)?.requiresOAuth && (
                            <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                Full OAuth connection (auto-refresh tokens) is coming soon.
                                API key authentication is available now for GoHighLevel.
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
        </>
    );
}
