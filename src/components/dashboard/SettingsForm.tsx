'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Eye, Palette, Mail, Phone, Globe, Clock, Webhook, Copy, RefreshCw, Key, Hash, CalendarCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Agency } from '@/types';

interface SettingsFormProps {
    agency: Agency;
    agents?: { id: string; name: string }[];
}

// Values masked by the server look like "...abc1" — they are not real keys
const isMasked = (v?: string | null): boolean => !!v?.startsWith('...');

// For a secret field: if it was masked, init to "" (user types to replace)
const initSecret = (v?: string | null): string => isMasked(v) ? '' : (v || '');

export function SettingsForm({ agency, agents }: SettingsFormProps) {
    const [showPreview, setShowPreview] = useState(false);
    const [savingBranding, setSavingBranding] = useState(false);
    const [brandingSaved, setBrandingSaved] = useState(false);
    const [brandingError, setBrandingError] = useState<string | null>(null);
    const [savingIntegrations, setSavingIntegrations] = useState(false);
    const [integrationsSaved, setIntegrationsSaved] = useState(false);
    const [integrationsError, setIntegrationsError] = useState<string | null>(null);
    const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);
    const [apiGuideTab, setApiGuideTab] = useState<'zapier' | 'generic'>('zapier');
    const [savingKeys, setSavingKeys] = useState(false);
    const [keysSaved, setKeysSaved] = useState(false);
    const [keysError, setKeysError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);
    const [slackTesting, setSlackTesting] = useState(false);
    const [slackTestResult, setSlackTestResult] = useState<string | null>(null);
    const [calendlyValidating, setCalendlyValidating] = useState(false);
    const [calendlyEventTypes, setCalendlyEventTypes] = useState<{ uri: string; name: string; duration: number }[]>([]);

    // Track which secret fields have an existing value on the server (came as masked "...xxxx")
    // This never changes — it's computed once from the initial agency prop.
    const [hadMasked] = useState(() => ({
        retellApiKey: isMasked(agency.retell_api_key),
        vapiApiKey: isMasked(agency.vapi_api_key),
        blandApiKey: isMasked(agency.bland_api_key),
        ghlApiKey: isMasked(agency.integrations?.ghl?.api_key),
        ghlTriggerSecret: isMasked(agency.integrations?.ghl?.trigger_config?.webhook_secret),
        hubspotTriggerSecret: isMasked(agency.integrations?.hubspot?.trigger_config?.webhook_secret),
        slackWebhookUrl: isMasked(agency.integrations?.slack?.webhook_url),
        calendlyApiToken: isMasked(agency.integrations?.calendly?.api_token),
        apiTriggerKey: isMasked(agency.integrations?.api?.api_key),
    }));

    const [formData, setFormData] = useState({
        name: agency.name,
        companyName: agency.branding?.company_name || '',
        primaryColor: agency.branding?.primary_color || '#0f172a',
        secondaryColor: agency.branding?.secondary_color || '#1e293b',
        accentColor: agency.branding?.accent_color || '#3b82f6',
        logoUrl: agency.branding?.logo_url || '',
        faviconUrl: agency.branding?.favicon_url || '',
        tagline: agency.branding?.tagline || '',
        loginMessage: agency.branding?.login_message || '',
        footerText: agency.branding?.footer_text || '',
        websiteUrl: agency.branding?.website_url || '',
        supportEmail: agency.branding?.support_email || '',
        supportPhone: agency.branding?.support_phone || '',
        retellApiKey: initSecret(agency.retell_api_key),
        vapiApiKey: initSecret(agency.vapi_api_key),
        blandApiKey: initSecret(agency.bland_api_key),
        // CRM Integrations
        ghlApiKey: initSecret(agency.integrations?.ghl?.api_key),
        ghlLocationId: agency.integrations?.ghl?.location_id || '',
        hubspotEnabled: agency.integrations?.hubspot?.enabled || false,
        // HubSpot Trigger
        hubspotTriggerEnabled: agency.integrations?.hubspot?.trigger_config?.enabled || false,
        hubspotTriggerSecret: initSecret(agency.integrations?.hubspot?.trigger_config?.webhook_secret),
        hubspotDefaultAgentId: agency.integrations?.hubspot?.trigger_config?.default_agent_id || '',
        gcalDefaultCalendarId: agency.integrations?.google_calendar?.default_calendar_id || 'primary',
        // GHL Trigger
        ghlTriggerEnabled: agency.integrations?.ghl?.trigger_config?.enabled || false,
        ghlTriggerSecret: initSecret(agency.integrations?.ghl?.trigger_config?.webhook_secret),
        ghlDefaultAgentId: agency.integrations?.ghl?.trigger_config?.default_agent_id || '',
        // Slack
        slackWebhookUrl: initSecret(agency.integrations?.slack?.webhook_url),
        slackEnabled: agency.integrations?.slack?.enabled || false,
        slackChannelName: agency.integrations?.slack?.channel_name || '',
        // Calendly
        calendlyApiToken: initSecret(agency.integrations?.calendly?.api_token),
        calendlyEnabled: agency.integrations?.calendly?.enabled || false,
        calendlyUserUri: agency.integrations?.calendly?.user_uri || '',
        calendlyDefaultEventType: agency.integrations?.calendly?.default_event_type_uri || '',
        // API Trigger (Make.com / n8n)
        apiTriggerEnabled: agency.integrations?.api?.enabled || false,
        apiTriggerKey: initSecret(agency.integrations?.api?.api_key),
        apiDefaultAgentId: agency.integrations?.api?.default_agent_id || '',
        // Calling Window
        callingWindowEnabled: agency.calling_window?.enabled ?? agency.integrations?.ghl?.calling_window?.enabled ?? false,
        callingWindowStart: agency.calling_window?.start_hour ?? agency.integrations?.ghl?.calling_window?.start_hour ?? 9,
        callingWindowEnd: agency.calling_window?.end_hour ?? agency.integrations?.ghl?.calling_window?.end_hour ?? 20,
        callingWindowDays: agency.calling_window?.days_of_week ?? agency.integrations?.ghl?.calling_window?.days_of_week ?? [1, 2, 3, 4, 5],
    });

    // Whether a key exists on the server: either user typed a new value or a masked value was present
    const hasKey = (field: keyof typeof hadMasked, formValue: string) => !!formValue || hadMasked[field];

    const handleSaveApiKeys = async () => {
        setSavingKeys(true);
        setKeysSaved(false);
        setKeysError(null);
        setSyncResult(null);
        try {
            // Only include keys that were actually changed.
            // If user typed a new key → send it. If empty and was masked → skip (preserve server value).
            // If empty and no previous value → send null.
            const payload: Record<string, string | null> = {};
            if (formData.retellApiKey) payload.retell_api_key = formData.retellApiKey;
            else if (!hadMasked.retellApiKey) payload.retell_api_key = null;
            if (formData.vapiApiKey) payload.vapi_api_key = formData.vapiApiKey;
            else if (!hadMasked.vapiApiKey) payload.vapi_api_key = null;
            if (formData.blandApiKey) payload.bland_api_key = formData.blandApiKey;
            else if (!hadMasked.blandApiKey) payload.bland_api_key = null;

            const response = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                setKeysError(data.error || 'Failed to save API keys');
                return;
            }

            setKeysSaved(true);
            toast.success('API keys saved');
        } catch {
            setKeysError('Failed to save API keys');
        } finally {
            setSavingKeys(false);
        }
    };

    const handleSyncAgents = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'agents' }),
            });

            if (!response.ok) {
                const data = await response.json();
                setSyncResult(`Error: ${data.error || 'Sync failed'}`);
                return;
            }

            const data = await response.json();
            const agentCount = data.results?.agents?.synced || data.synced || 0;
            const callCount = data.results?.calls?.synced || 0;
            const callErrors = data.results?.calls?.errors || 0;
            const errorDetails = data.results?.calls?.errorDetails || '';

            let message = `Synced ${agentCount} agent${agentCount !== 1 ? 's' : ''} and ${callCount} call${callCount !== 1 ? 's' : ''}`;
            if (callErrors > 0) {
                message += ` (${callErrors} call error${callErrors !== 1 ? 's' : ''}${errorDetails ? ': ' + errorDetails : ''})`;
            }
            setSyncResult(message);
            toast.success(message);
        } catch {
            setSyncResult('Error: Sync failed unexpectedly');
        } finally {
            setSyncing(false);
        }
    };

    const handleSaveBranding = async () => {
        setSavingBranding(true);
        setBrandingSaved(false);
        setBrandingError(null);

        const validationError = validateBranding();
        if (validationError) {
            setBrandingError(validationError);
            setSavingBranding(false);
            return;
        }

        try {
            const response = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    branding: {
                        ...agency.branding,
                        company_name: formData.companyName,
                        primary_color: formData.primaryColor,
                        secondary_color: formData.secondaryColor,
                        accent_color: formData.accentColor,
                        logo_url: formData.logoUrl,
                        favicon_url: formData.faviconUrl,
                        tagline: formData.tagline,
                        login_message: formData.loginMessage,
                        footer_text: formData.footerText,
                        website_url: formData.websiteUrl,
                        support_email: formData.supportEmail,
                        support_phone: formData.supportPhone,
                    },
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                setBrandingError(data.error || 'Failed to save branding');
                return;
            }

            setBrandingSaved(true);
            toast.success('Branding saved');
        } catch {
            setBrandingError('An unexpected error occurred');
        } finally {
            setSavingBranding(false);
        }
    };

    const handleSaveIntegrations = async () => {
        setSavingIntegrations(true);
        setIntegrationsSaved(false);
        setIntegrationsError(null);

        try {
            // Build integration payloads with ONLY form-managed fields.
            // Server deep-merges, so omitted fields (OAuth tokens, etc.) are preserved.
            // For secret fields: only include if user typed a new value.
            // If empty and was masked → omit (server preserves existing).
            const ghlPayload: Record<string, unknown> = {
                location_id: formData.ghlLocationId || agency.integrations?.ghl?.oauth_location_id || null,
                enabled: !!(formData.ghlApiKey || hadMasked.ghlApiKey || agency.integrations?.ghl?.auth_method === 'oauth'),
                trigger_config: {
                    enabled: formData.ghlTriggerEnabled,
                    default_agent_id: formData.ghlDefaultAgentId || null,
                    ...(formData.ghlTriggerSecret ? { webhook_secret: formData.ghlTriggerSecret } : {}),
                },
                calling_window: {
                    enabled: formData.callingWindowEnabled,
                    start_hour: formData.callingWindowStart,
                    end_hour: formData.callingWindowEnd,
                    days_of_week: formData.callingWindowDays,
                },
            };
            if (formData.ghlApiKey) ghlPayload.api_key = formData.ghlApiKey;
            else if (!hadMasked.ghlApiKey) ghlPayload.api_key = null;

            const hubspotPayload: Record<string, unknown> = {
                trigger_config: {
                    enabled: formData.hubspotTriggerEnabled,
                    default_agent_id: formData.hubspotDefaultAgentId || null,
                    ...(formData.hubspotTriggerSecret ? { webhook_secret: formData.hubspotTriggerSecret } : {}),
                },
            };

            const gcalPayload: Record<string, unknown> = {
                default_calendar_id: formData.gcalDefaultCalendarId || 'primary',
            };

            const apiPayload: Record<string, unknown> = {
                enabled: formData.apiTriggerEnabled,
                default_agent_id: formData.apiDefaultAgentId || null,
            };
            if (formData.apiTriggerKey) apiPayload.api_key = formData.apiTriggerKey;
            else if (!hadMasked.apiTriggerKey) apiPayload.api_key = null;

            const slackPayload: Record<string, unknown> = {
                enabled: formData.slackEnabled,
                channel_name: formData.slackChannelName || null,
            };
            if (formData.slackWebhookUrl) slackPayload.webhook_url = formData.slackWebhookUrl;
            else if (!hadMasked.slackWebhookUrl) slackPayload.webhook_url = null;

            const calendlyPayload: Record<string, unknown> = {
                enabled: formData.calendlyEnabled,
                user_uri: formData.calendlyUserUri || null,
                default_event_type_uri: formData.calendlyDefaultEventType || null,
            };
            if (formData.calendlyApiToken) calendlyPayload.api_token = formData.calendlyApiToken;
            else if (!hadMasked.calendlyApiToken) calendlyPayload.api_token = null;

            const response = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    integrations: {
                        ghl: ghlPayload,
                        hubspot: hubspotPayload,
                        google_calendar: gcalPayload,
                        api: apiPayload,
                        slack: slackPayload,
                        calendly: calendlyPayload,
                    },
                    calling_window: {
                        enabled: formData.callingWindowEnabled,
                        start_hour: formData.callingWindowStart,
                        end_hour: formData.callingWindowEnd,
                        days_of_week: formData.callingWindowDays,
                    },
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                setIntegrationsError(data.error || 'Failed to save integrations');
                return;
            }

            setIntegrationsSaved(true);
            toast.success('Integrations saved');
        } catch {
            setIntegrationsError('An unexpected error occurred');
        } finally {
            setSavingIntegrations(false);
        }
    };

    const validateBranding = (): string | null => {
        const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
        if (formData.primaryColor && !hexColorRegex.test(formData.primaryColor)) {
            return 'Primary color must be a valid hex color (e.g. #0f172a)';
        }
        if (formData.secondaryColor && !hexColorRegex.test(formData.secondaryColor)) {
            return 'Secondary color must be a valid hex color (e.g. #1e293b)';
        }
        if (formData.accentColor && !hexColorRegex.test(formData.accentColor)) {
            return 'Accent color must be a valid hex color (e.g. #3b82f6)';
        }

        const urlFields = [
            { value: formData.logoUrl, label: 'Logo URL' },
            { value: formData.faviconUrl, label: 'Favicon URL' },
            { value: formData.websiteUrl, label: 'Website URL' },
        ];
        for (const field of urlFields) {
            if (field.value) {
                try {
                    new URL(field.value);
                } catch {
                    return `${field.label} must be a valid URL (e.g. https://example.com)`;
                }
            }
        }

        if (formData.supportEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.supportEmail)) {
                return 'Support email must be a valid email address';
            }
        }

        return null;
    };

    return (
        <div className="space-y-6">
            {/* Branding */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Palette className="h-5 w-5" />
                                Branding
                            </CardTitle>
                            <CardDescription>
                                Customize how your platform appears to clients
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowPreview(!showPreview)}
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            {showPreview ? 'Hide Preview' : 'Show Preview'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Live Preview */}
                    {showPreview && (
                        <div className="rounded-lg border overflow-hidden">
                            <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                                <Eye className="h-3 w-3" />
                                Live Preview - Login Page
                            </div>
                            <div
                                className="p-8 flex flex-col items-center justify-center min-h-[300px] bg-slate-50 dark:bg-slate-900"
                            >
                                {/* Header Preview */}
                                <div className="text-center mb-6">
                                    {formData.logoUrl ? (
                                        <div className="h-12 mb-2">
                                            <Image
                                                src={formData.logoUrl}
                                                alt="Logo"
                                                width={200}
                                                height={50}
                                                className="h-12 w-auto object-contain mx-auto"
                                                unoptimized
                                            />
                                        </div>
                                    ) : (
                                        <h2
                                            className="text-2xl font-bold mb-2"
                                            style={{ color: formData.primaryColor }}
                                        >
                                            {formData.companyName || formData.name || 'Your Company'}
                                        </h2>
                                    )}
                                    {formData.tagline && (
                                        <p className="text-sm text-slate-500">{formData.tagline}</p>
                                    )}
                                </div>

                                {/* Login Message Preview */}
                                {formData.loginMessage && (
                                    <div
                                        className="mb-4 p-3 rounded-lg text-center text-sm max-w-sm"
                                        style={{
                                            backgroundColor: `${formData.primaryColor}10`,
                                            borderColor: `${formData.primaryColor}30`,
                                            borderWidth: 1,
                                        }}
                                    >
                                        {formData.loginMessage}
                                    </div>
                                )}

                                {/* Card Preview */}
                                <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-6 space-y-4">
                                    <div className="space-y-2">
                                        <div className="h-4 bg-slate-200 rounded w-16" />
                                        <div className="h-10 bg-slate-100 rounded" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-4 bg-slate-200 rounded w-20" />
                                        <div className="h-10 bg-slate-100 rounded" />
                                    </div>
                                    <div
                                        className="h-10 rounded flex items-center justify-center text-white text-sm font-medium"
                                        style={{ backgroundColor: formData.accentColor }}
                                    >
                                        Sign In
                                    </div>
                                </div>

                                {/* Footer Preview */}
                                <p className="text-xs text-slate-400 mt-6">
                                    {formData.footerText || `© ${new Date().getFullYear()} ${formData.companyName || formData.name || 'Your Company'}`}
                                </p>
                            </div>

                            {/* Sidebar Preview */}
                            <div className="border-t">
                                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                                    <Eye className="h-3 w-3" />
                                    Sidebar Preview
                                </div>
                                <div className="flex">
                                    <div
                                        className="w-64 p-4 text-white min-h-[120px]"
                                        style={{ backgroundColor: formData.primaryColor }}
                                    >
                                        {formData.logoUrl ? (
                                            <div className="h-8 mb-4">
                                                <Image
                                                    src={formData.logoUrl}
                                                    alt="Logo"
                                                    width={150}
                                                    height={32}
                                                    className="h-8 w-auto object-contain brightness-0 invert"
                                                    unoptimized
                                                />
                                            </div>
                                        ) : (
                                            <div className="font-semibold mb-4">
                                                {formData.companyName || formData.name || 'Your Company'}
                                            </div>
                                        )}
                                        <div className="space-y-2 text-sm opacity-80">
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-white/20 rounded" />
                                                Dashboard
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-white/20 rounded" />
                                                Calls
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-white/20 rounded" />
                                                Agents
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-slate-50 p-4 text-slate-400 text-sm">
                                        Main content area
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Identity */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground">Identity</h4>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Agency Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Display Name</Label>
                                <Input
                                    id="companyName"
                                    value={formData.companyName}
                                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                    placeholder="Shown to clients"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tagline">Tagline</Label>
                            <Input
                                id="tagline"
                                value={formData.tagline}
                                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                                placeholder="Your company's tagline or slogan"
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Colors */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground">Colors</h4>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="primaryColor">Primary (Sidebar)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="primaryColor"
                                        type="color"
                                        value={formData.primaryColor}
                                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                        className="w-12 h-10 p-1"
                                    />
                                    <Input
                                        value={formData.primaryColor}
                                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="secondaryColor">Secondary</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="secondaryColor"
                                        type="color"
                                        value={formData.secondaryColor}
                                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                                        className="w-12 h-10 p-1"
                                    />
                                    <Input
                                        value={formData.secondaryColor}
                                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accentColor">Accent (Buttons)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="accentColor"
                                        type="color"
                                        value={formData.accentColor}
                                        onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                                        className="w-12 h-10 p-1"
                                    />
                                    <Input
                                        value={formData.accentColor}
                                        onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Logos */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground">Logos & Icons</h4>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="logoUrl">Logo URL</Label>
                                <div className="space-y-2">
                                    <Input
                                        id="logoUrl"
                                        value={formData.logoUrl}
                                        onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                                        placeholder="https://example.com/logo.png"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Recommended: 200x50px, PNG or SVG
                                    </p>
                                    {formData.logoUrl && (
                                        <div className="w-full h-12 rounded border bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                            <Image
                                                src={formData.logoUrl}
                                                alt="Logo preview"
                                                width={128}
                                                height={48}
                                                className="max-w-full max-h-full object-contain"
                                                unoptimized
                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="faviconUrl">Favicon URL</Label>
                                <div className="space-y-2">
                                    <Input
                                        id="faviconUrl"
                                        value={formData.faviconUrl}
                                        onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
                                        placeholder="https://example.com/favicon.ico"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Recommended: 32x32px, ICO or PNG
                                    </p>
                                    {formData.faviconUrl && (
                                        <div className="w-8 h-8 rounded border bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                            <Image
                                                src={formData.faviconUrl}
                                                alt="Favicon preview"
                                                width={32}
                                                height={32}
                                                className="w-full h-full object-contain"
                                                unoptimized
                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Custom Text */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground">Custom Text</h4>
                        <div className="space-y-2">
                            <Label htmlFor="loginMessage">Login Page Message</Label>
                            <Textarea
                                id="loginMessage"
                                value={formData.loginMessage}
                                onChange={(e) => setFormData({ ...formData, loginMessage: e.target.value })}
                                placeholder="Welcome message shown on the login page"
                                rows={2}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="footerText">Footer Text</Label>
                            <Input
                                id="footerText"
                                value={formData.footerText}
                                onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                                placeholder={`© ${new Date().getFullYear()} Your Company Name`}
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Contact Info */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="websiteUrl" className="flex items-center gap-1">
                                    <Globe className="h-3 w-3" />
                                    Website
                                </Label>
                                <Input
                                    id="websiteUrl"
                                    value={formData.websiteUrl}
                                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                                    placeholder="https://yourcompany.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="supportEmail" className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    Support Email
                                </Label>
                                <Input
                                    id="supportEmail"
                                    type="email"
                                    value={formData.supportEmail}
                                    onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                                    placeholder="support@yourcompany.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="supportPhone" className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    Support Phone
                                </Label>
                                <Input
                                    id="supportPhone"
                                    type="tel"
                                    value={formData.supportPhone}
                                    onChange={(e) => setFormData({ ...formData, supportPhone: e.target.value })}
                                    placeholder="+1 (555) 123-4567"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {brandingError && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/50 rounded-md">
                            {brandingError}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button
                            onClick={handleSaveBranding}
                            disabled={savingBranding}
                            variant={brandingSaved ? 'outline' : 'default'}
                        >
                            {savingBranding ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : brandingSaved ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                                    Saved
                                </>
                            ) : (
                                'Save branding'
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* API Keys */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Voice Provider API Keys
                    </CardTitle>
                    <CardDescription>
                        Connect your Retell, Vapi, or Bland accounts to sync agents and calls
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="retellApiKey">Retell API Key</Label>
                        <Input
                            id="retellApiKey"
                            type="password"
                            value={formData.retellApiKey}
                            onChange={(e) => {
                                setFormData({ ...formData, retellApiKey: e.target.value });
                                setKeysSaved(false);
                                setSyncResult(null);
                            }}
                            placeholder={hadMasked.retellApiKey ? `Key set (${agency.retell_api_key}) — type to replace` : 'Enter your Retell API key'}
                        />
                        <p className="text-xs text-muted-foreground">
                            Find your API key at{' '}
                            <a href="https://beta.retellai.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                beta.retellai.com/dashboard
                            </a>
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="vapiApiKey">Vapi API Key</Label>
                        <Input
                            id="vapiApiKey"
                            type="password"
                            value={formData.vapiApiKey}
                            onChange={(e) => {
                                setFormData({ ...formData, vapiApiKey: e.target.value });
                                setKeysSaved(false);
                                setSyncResult(null);
                            }}
                            placeholder={hadMasked.vapiApiKey ? `Key set (${agency.vapi_api_key}) — type to replace` : 'Enter your Vapi API key'}
                        />
                        <p className="text-xs text-muted-foreground">
                            Find your API key at{' '}
                            <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                dashboard.vapi.ai
                            </a>
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="blandApiKey">Bland API Key</Label>
                        <Input
                            id="blandApiKey"
                            type="password"
                            value={formData.blandApiKey}
                            onChange={(e) => {
                                setFormData({ ...formData, blandApiKey: e.target.value });
                                setKeysSaved(false);
                                setSyncResult(null);
                            }}
                            placeholder={hadMasked.blandApiKey ? `Key set (${agency.bland_api_key}) — type to replace` : 'Enter your Bland API key'}
                        />
                        <p className="text-xs text-muted-foreground">
                            Find your API key at{' '}
                            <a href="https://app.bland.ai/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                app.bland.ai/dashboard
                            </a>
                        </p>
                    </div>

                    {keysError && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/50 rounded-md">
                            {keysError}
                        </div>
                    )}

                    {syncResult && (
                        <div className={`p-3 text-sm rounded-md ${syncResult.startsWith('Error') ? 'text-red-600 bg-red-50 dark:bg-red-950/50' : 'text-green-600 bg-green-50 dark:bg-green-950/50'}`}>
                            {syncResult}
                        </div>
                    )}

                    <Separator />

                    <div className="flex gap-3">
                        <Button
                            onClick={handleSaveApiKeys}
                            disabled={savingKeys || (!hasKey('retellApiKey', formData.retellApiKey) && !hasKey('vapiApiKey', formData.vapiApiKey) && !hasKey('blandApiKey', formData.blandApiKey))}
                            variant={keysSaved ? 'outline' : 'default'}
                        >
                            {savingKeys ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : keysSaved ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                                    Keys Saved
                                </>
                            ) : (
                                'Save API Keys'
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleSyncAgents}
                            disabled={syncing || (!hasKey('retellApiKey', formData.retellApiKey) && !hasKey('vapiApiKey', formData.vapiApiKey) && !hasKey('blandApiKey', formData.blandApiKey))}
                        >
                            {syncing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Syncing...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Sync Agents
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* CRM Integrations */}
            <Card>
                <CardHeader>
                    <CardTitle>CRM Integrations</CardTitle>
                    <CardDescription>
                        Connect your CRM to automatically log calls and sync contacts
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* GoHighLevel */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-sm">
                                GHL
                            </div>
                            <div>
                                <h4 className="font-medium">GoHighLevel</h4>
                                <p className="text-sm text-muted-foreground">Connect to log calls and create contacts</p>
                            </div>
                        </div>

                        {/* OAuth Connection (Primary) */}
                        {agency.integrations?.ghl?.auth_method === 'oauth' ? (
                            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                                <div>
                                    <p className="text-sm font-medium text-green-700 dark:text-green-300">Connected via OAuth</p>
                                    {agency.integrations?.ghl?.oauth_location_id && (
                                        <p className="text-xs text-green-600 dark:text-green-400">
                                            Location: {agency.integrations.ghl.oauth_location_id}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDisconnectConfirm('ghl')}
                                >
                                    Disconnect
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => { window.location.href = '/api/auth/ghl'; }}
                                >
                                    Connect with GoHighLevel
                                </Button>

                                {/* API Key Fallback */}
                                <details className="group">
                                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        Or connect manually with API key
                                    </summary>
                                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="ghlApiKey">API Key</Label>
                                            <Input
                                                id="ghlApiKey"
                                                type="password"
                                                value={formData.ghlApiKey}
                                                onChange={(e) => { setFormData({ ...formData, ghlApiKey: e.target.value }); setIntegrationsSaved(false); }}
                                                placeholder={hadMasked.ghlApiKey ? `Key set (${agency.integrations?.ghl?.api_key}) — type to replace` : 'Enter your GHL API key'}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="ghlLocationId">Location ID</Label>
                                            <Input
                                                id="ghlLocationId"
                                                value={formData.ghlLocationId}
                                                onChange={(e) => { setFormData({ ...formData, ghlLocationId: e.target.value }); setIntegrationsSaved(false); }}
                                                placeholder="Your GHL Location ID"
                                            />
                                        </div>
                                    </div>
                                    {(formData.ghlApiKey || hadMasked.ghlApiKey) && (
                                        <p className="text-sm text-green-600 mt-2">Connected via API key</p>
                                    )}
                                </details>
                            </div>
                        )}

                        {/* GHL Outbound Trigger */}
                        {(formData.ghlApiKey || hadMasked.ghlApiKey || agency.integrations?.ghl?.auth_method === 'oauth') && (
                            <div className="mt-6 space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Webhook className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <h5 className="font-medium text-sm">Outbound Trigger Webhook</h5>
                                            <p className="text-xs text-muted-foreground">
                                                Allow GHL workflows to trigger outbound AI calls
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={formData.ghlTriggerEnabled}
                                        onCheckedChange={(checked: boolean) => {
                                            const updates: Partial<typeof formData> = { ghlTriggerEnabled: checked };
                                            // Generate webhook secret if enabling for the first time
                                            if (checked && !formData.ghlTriggerSecret) {
                                                const array = new Uint8Array(32);
                                                crypto.getRandomValues(array);
                                                updates.ghlTriggerSecret = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
                                            }
                                            setFormData({ ...formData, ...updates });
                                        }}
                                    />
                                </div>

                                {formData.ghlTriggerEnabled && (
                                    <div className="space-y-3 pl-6">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Webhook URL</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    readOnly
                                                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/ghl/trigger-call`}
                                                    className="text-xs font-mono bg-muted"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="shrink-0"
                                                    aria-label="Copy to clipboard"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`${window.location.origin}/api/ghl/trigger-call`).catch(() => {});
                                                    }}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs">Webhook Secret</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    readOnly
                                                    type="password"
                                                    value={formData.ghlTriggerSecret}
                                                    className="text-xs font-mono bg-muted"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="shrink-0"
                                                    aria-label="Copy to clipboard"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(formData.ghlTriggerSecret).catch(() => {});
                                                    }}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="shrink-0"
                                                    onClick={() => {
                                                        const array = new Uint8Array(32);
                                                        crypto.getRandomValues(array);
                                                        setFormData({
                                                            ...formData,
                                                            ghlTriggerSecret: Array.from(array, b => b.toString(16).padStart(2, '0')).join(''),
                                                        });
                                                    }}
                                                >
                                                    <RefreshCw className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Set this as the x-ghl-signature header value in your GHL webhook action
                                            </p>
                                        </div>

                                        {agents && agents.length > 0 && (
                                            <div className="space-y-1">
                                                <Label className="text-xs" htmlFor="ghlDefaultAgentId">Default Outbound Agent</Label>
                                                <select
                                                    id="ghlDefaultAgentId"
                                                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                                    value={formData.ghlDefaultAgentId}
                                                    onChange={(e) => { setFormData({ ...formData, ghlDefaultAgentId: e.target.value }); setIntegrationsSaved(false); }}
                                                >
                                                    <option value="">Select an agent...</option>
                                                    {agents.map(a => (
                                                        <option key={a.id} value={a.id}>{a.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Calling Window */}
                        {(formData.ghlApiKey || hadMasked.ghlApiKey || agency.integrations?.ghl?.auth_method === 'oauth') && (
                            <div className="mt-4 space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <h5 className="font-medium text-sm">Calling Window</h5>
                                            <p className="text-xs text-muted-foreground">
                                                Enforce timezone-aware calling hours for outbound calls
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={formData.callingWindowEnabled}
                                        onCheckedChange={(checked: boolean) => { setFormData({ ...formData, callingWindowEnabled: checked }); setIntegrationsSaved(false); }}
                                    />
                                </div>

                                {formData.callingWindowEnabled && (
                                    <div className="space-y-3 pl-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs" htmlFor="callingWindowStart">Start Hour</Label>
                                                <select
                                                    id="callingWindowStart"
                                                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                                    value={formData.callingWindowStart}
                                                    onChange={(e) => { setFormData({ ...formData, callingWindowStart: parseInt(e.target.value) }); setIntegrationsSaved(false); }}
                                                >
                                                    {Array.from({ length: 24 }, (_, i) => (
                                                        <option key={i} value={i}>
                                                            {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs" htmlFor="callingWindowEnd">End Hour</Label>
                                                <select
                                                    id="callingWindowEnd"
                                                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                                    value={formData.callingWindowEnd}
                                                    onChange={(e) => { setFormData({ ...formData, callingWindowEnd: parseInt(e.target.value) }); setIntegrationsSaved(false); }}
                                                >
                                                    {Array.from({ length: 24 }, (_, i) => (
                                                        <option key={i} value={i}>
                                                            {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs">Allowed Days</Label>
                                            <div className="flex gap-1">
                                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        aria-pressed={formData.callingWindowDays.includes(i)}
                                                        className={`px-2 py-1 text-xs rounded border ${
                                                            formData.callingWindowDays.includes(i)
                                                                ? 'bg-primary text-primary-foreground border-primary'
                                                                : 'bg-background border-input hover:bg-accent'
                                                        }`}
                                                        onClick={() => {
                                                            const days = formData.callingWindowDays.includes(i)
                                                                ? formData.callingWindowDays.filter(d => d !== i)
                                                                : [...formData.callingWindowDays, i].sort();
                                                            setFormData({ ...formData, callingWindowDays: days });
                                                        }}
                                                    >
                                                        {day}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <p className="text-xs text-muted-foreground">
                                            Calls will only be made between {formData.callingWindowStart === 0 ? '12 AM' : formData.callingWindowStart < 12 ? `${formData.callingWindowStart} AM` : formData.callingWindowStart === 12 ? '12 PM' : `${formData.callingWindowStart - 12} PM`} and {formData.callingWindowEnd === 0 ? '12 AM' : formData.callingWindowEnd < 12 ? `${formData.callingWindowEnd} AM` : formData.callingWindowEnd === 12 ? '12 PM' : `${formData.callingWindowEnd - 12} PM`} in the lead&apos;s local timezone.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* HubSpot */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                                HS
                            </div>
                            <div>
                                <h4 className="font-medium">HubSpot</h4>
                                <p className="text-sm text-muted-foreground">Connect via OAuth to sync contacts and calls</p>
                            </div>
                        </div>
                        {agency.integrations?.hubspot?.enabled ? (
                            <div className="flex items-center gap-4">
                                <p className="text-sm text-green-600">✓ HubSpot connected</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDisconnectConfirm('hubspot')}
                                >
                                    Disconnect
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                onClick={() => window.location.href = '/api/auth/hubspot'}
                            >
                                Connect HubSpot
                            </Button>
                        )}

                        {/* HubSpot Outbound Trigger */}
                        {agency.integrations?.hubspot?.enabled && (
                            <div className="mt-6 space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Webhook className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <h5 className="font-medium text-sm">Outbound Trigger Webhook</h5>
                                            <p className="text-xs text-muted-foreground">
                                                Allow HubSpot workflows to trigger outbound AI calls
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={formData.hubspotTriggerEnabled}
                                        onCheckedChange={(checked: boolean) => {
                                            const updates: Partial<typeof formData> = { hubspotTriggerEnabled: checked };
                                            if (checked && !formData.hubspotTriggerSecret && !hadMasked.hubspotTriggerSecret) {
                                                const array = new Uint8Array(32);
                                                crypto.getRandomValues(array);
                                                updates.hubspotTriggerSecret = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
                                            }
                                            setFormData({ ...formData, ...updates });
                                        }}
                                    />
                                </div>

                                {formData.hubspotTriggerEnabled && (
                                    <div className="space-y-3 pl-6">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Webhook URL</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    readOnly
                                                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/hubspot/trigger-call`}
                                                    className="text-xs font-mono bg-muted"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="shrink-0"
                                                    aria-label="Copy to clipboard"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`${window.location.origin}/api/hubspot/trigger-call`).catch(() => {});
                                                    }}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs">Webhook Secret</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    readOnly
                                                    type="password"
                                                    value={formData.hubspotTriggerSecret}
                                                    className="text-xs font-mono bg-muted"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="shrink-0"
                                                    aria-label="Copy to clipboard"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(formData.hubspotTriggerSecret).catch(() => {});
                                                    }}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="shrink-0"
                                                    onClick={() => {
                                                        const array = new Uint8Array(32);
                                                        crypto.getRandomValues(array);
                                                        setFormData({
                                                            ...formData,
                                                            hubspotTriggerSecret: Array.from(array, b => b.toString(16).padStart(2, '0')).join(''),
                                                        });
                                                    }}
                                                >
                                                    <RefreshCw className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Used for HMAC-SHA256 signature verification of incoming webhook requests
                                            </p>
                                        </div>

                                        {agents && agents.length > 0 && (
                                            <div className="space-y-1">
                                                <Label className="text-xs" htmlFor="hubspotDefaultAgentId">Default Outbound Agent</Label>
                                                <select
                                                    id="hubspotDefaultAgentId"
                                                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                                    value={formData.hubspotDefaultAgentId}
                                                    onChange={(e) => { setFormData({ ...formData, hubspotDefaultAgentId: e.target.value }); setIntegrationsSaved(false); }}
                                                >
                                                    <option value="">Select an agent...</option>
                                                    {agents.map(a => (
                                                        <option key={a.id} value={a.id}>{a.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Google Calendar */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                GC
                            </div>
                            <div>
                                <h4 className="font-medium">Google Calendar</h4>
                                <p className="text-sm text-muted-foreground">Connect to check availability and book events</p>
                            </div>
                        </div>
                        {agency.integrations?.google_calendar?.enabled ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <p className="text-sm text-green-600">✓ Google Calendar connected</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDisconnectConfirm('google_calendar')}
                                    >
                                        Disconnect
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Default Calendar ID</Label>
                                    <Input
                                        value={formData.gcalDefaultCalendarId}
                                        onChange={(e) => { setFormData({ ...formData, gcalDefaultCalendarId: e.target.value }); setIntegrationsSaved(false); }}
                                        placeholder="primary"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Use &quot;primary&quot; for your main calendar, or paste a specific calendar ID
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                onClick={() => window.location.href = '/api/auth/google-calendar'}
                            >
                                Connect Google Calendar
                            </Button>
                        )}
                    </div>

                    <Separator />

                    {/* Slack */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center text-white font-bold text-sm">
                                <Hash className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-medium">Slack</h4>
                                <p className="text-sm text-muted-foreground">Send call notifications to a Slack channel</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="font-medium text-sm">Enable Slack Notifications</h5>
                                    <p className="text-xs text-muted-foreground">
                                        Post call summaries to Slack when workflows trigger
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.slackEnabled}
                                    onCheckedChange={(checked: boolean) => { setFormData({ ...formData, slackEnabled: checked }); setIntegrationsSaved(false); }}
                                />
                            </div>

                            {formData.slackEnabled && (
                                <div className="space-y-3 pl-6">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Incoming Webhook URL</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="password"
                                                value={formData.slackWebhookUrl}
                                                onChange={(e) => { setFormData({ ...formData, slackWebhookUrl: e.target.value }); setIntegrationsSaved(false); }}
                                                placeholder="https://hooks.slack.com/services/T.../B.../..."
                                                className="text-xs font-mono"
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="shrink-0"
                                                aria-label="Copy to clipboard"
                                                onClick={() => navigator.clipboard.writeText(formData.slackWebhookUrl).catch(() => {})}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Create one at <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="underline">Slack Incoming Webhooks</a>
                                        </p>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs">Channel Name (optional)</Label>
                                        <Input
                                            value={formData.slackChannelName}
                                            onChange={(e) => { setFormData({ ...formData, slackChannelName: e.target.value }); setIntegrationsSaved(false); }}
                                            placeholder="#call-notifications"
                                            className="text-xs"
                                        />
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!formData.slackWebhookUrl || slackTesting}
                                        onClick={async () => {
                                            setSlackTesting(true);
                                            setSlackTestResult(null);
                                            try {
                                                const res = await fetch('/api/integrations/slack/test', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ webhook_url: formData.slackWebhookUrl }),
                                                });
                                                const json = await res.json();
                                                setSlackTestResult(res.ok ? 'Test message sent!' : json.error || 'Test failed');
                                            } catch {
                                                setSlackTestResult('Failed to send test');
                                            } finally {
                                                setSlackTesting(false);
                                            }
                                        }}
                                    >
                                        {slackTesting ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : null}
                                        Send Test Message
                                    </Button>
                                    {slackTestResult && (
                                        <p className={`text-xs ${slackTestResult.includes('sent') ? 'text-green-600' : 'text-red-500'}`}>
                                            {slackTestResult}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Calendly */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                <CalendarCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-medium">Calendly</h4>
                                <p className="text-sm text-muted-foreground">Book and manage appointments via Calendly</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="font-medium text-sm">Enable Calendly</h5>
                                    <p className="text-xs text-muted-foreground">
                                        Use Calendly scheduling in workflow actions
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.calendlyEnabled}
                                    onCheckedChange={(checked: boolean) => { setFormData({ ...formData, calendlyEnabled: checked }); setIntegrationsSaved(false); }}
                                />
                            </div>

                            {formData.calendlyEnabled && (
                                <div className="space-y-3 pl-6">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Personal Access Token</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="password"
                                                value={formData.calendlyApiToken}
                                                onChange={(e) => { setFormData({ ...formData, calendlyApiToken: e.target.value }); setIntegrationsSaved(false); }}
                                                placeholder="Paste your Calendly API token"
                                                className="text-xs font-mono"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="shrink-0"
                                                disabled={!formData.calendlyApiToken || calendlyValidating}
                                                onClick={async () => {
                                                    setCalendlyValidating(true);
                                                    try {
                                                        const res = await fetch('/api/integrations/calendly/validate', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ api_token: formData.calendlyApiToken }),
                                                        });
                                                        const json = await res.json();
                                                        if (res.ok && json.success) {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                calendlyUserUri: json.user.uri,
                                                            }));
                                                            setCalendlyEventTypes(json.event_types || []);
                                                        } else {
                                                            toast.error(json.error || 'Invalid token');
                                                        }
                                                    } catch {
                                                        toast.error('Failed to validate token');
                                                    } finally {
                                                        setCalendlyValidating(false);
                                                    }
                                                }}
                                            >
                                                {calendlyValidating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                                                Connect
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Generate at <a href="https://calendly.com/integrations/api_webhooks" target="_blank" rel="noopener noreferrer" className="underline">Calendly API & Webhooks</a>
                                        </p>
                                    </div>

                                    {formData.calendlyUserUri && (
                                        <p className="text-xs text-green-600">✓ Connected to Calendly</p>
                                    )}

                                    {calendlyEventTypes.length > 0 && (
                                        <div className="space-y-1">
                                            <Label className="text-xs" htmlFor="calendlyDefaultEventType">Default Event Type</Label>
                                            <select
                                                id="calendlyDefaultEventType"
                                                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                                value={formData.calendlyDefaultEventType}
                                                onChange={(e) => { setFormData({ ...formData, calendlyDefaultEventType: e.target.value }); setIntegrationsSaved(false); }}
                                            >
                                                <option value="">Select an event type...</option>
                                                {calendlyEventTypes.map(et => (
                                                    <option key={et.uri} value={et.uri}>
                                                        {et.name} ({et.duration} min)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* API / Automation */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold text-sm">
                                <Key className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-medium">API / Automation</h4>
                                <p className="text-sm text-muted-foreground">Trigger calls from Zapier, Make.com, n8n, or any HTTP client</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Webhook className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <h5 className="font-medium text-sm">Enable API Trigger</h5>
                                        <p className="text-xs text-muted-foreground">
                                            Allow external systems to trigger outbound calls via API
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={formData.apiTriggerEnabled}
                                    onCheckedChange={(checked: boolean) => {
                                        const updates: Partial<typeof formData> = { apiTriggerEnabled: checked };
                                        // Generate API key if enabling for the first time
                                        if (checked && !formData.apiTriggerKey && !hadMasked.apiTriggerKey) {
                                            const array = new Uint8Array(32);
                                            crypto.getRandomValues(array);
                                            updates.apiTriggerKey = 'pdy_sk_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
                                        }
                                        setFormData({ ...formData, ...updates });
                                    }}
                                />
                            </div>

                            {formData.apiTriggerEnabled && (
                                <div className="space-y-3 pl-6">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Endpoint URL</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                readOnly
                                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/trigger-call`}
                                                className="text-xs font-mono bg-muted"
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="shrink-0"
                                                aria-label="Copy to clipboard"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/api/trigger-call`).catch(() => {});
                                                }}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs">API Key</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                readOnly
                                                type="password"
                                                value={formData.apiTriggerKey}
                                                className="text-xs font-mono bg-muted"
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="shrink-0"
                                                aria-label="Copy to clipboard"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(formData.apiTriggerKey).catch(() => {});
                                                }}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="shrink-0"
                                                onClick={() => {
                                                    const array = new Uint8Array(32);
                                                    crypto.getRandomValues(array);
                                                    setFormData({
                                                        ...formData,
                                                        apiTriggerKey: 'pdy_sk_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join(''),
                                                    });
                                                }}
                                            >
                                                <RefreshCw className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Send as <code className="bg-muted px-1 rounded">Authorization: Bearer {'<key>'}</code> header
                                        </p>
                                    </div>

                                    {agents && agents.length > 0 && (
                                        <div className="space-y-1">
                                            <Label className="text-xs" htmlFor="apiDefaultAgentId">Default Outbound Agent</Label>
                                            <select
                                                id="apiDefaultAgentId"
                                                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                                value={formData.apiDefaultAgentId}
                                                onChange={(e) => { setFormData({ ...formData, apiDefaultAgentId: e.target.value }); setIntegrationsSaved(false); }}
                                            >
                                                <option value="">Select an agent...</option>
                                                {agents.map(a => (
                                                    <option key={a.id} value={a.id}>{a.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium text-foreground">Setup Guide</p>
                                            <div className="flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setApiGuideTab('zapier')}
                                                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${apiGuideTab === 'zapier' ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'}`}
                                                >
                                                    Zapier
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setApiGuideTab('generic')}
                                                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${apiGuideTab === 'generic' ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'}`}
                                                >
                                                    cURL / HTTP
                                                </button>
                                            </div>
                                        </div>

                                        {apiGuideTab === 'zapier' ? (
                                            <ol className="space-y-1 list-decimal list-inside">
                                                <li>Add a <strong className="text-foreground">Webhooks by Zapier</strong> action</li>
                                                <li>Choose <strong className="text-foreground">Custom Request</strong></li>
                                                <li>Method: <code className="bg-muted px-1 rounded">POST</code></li>
                                                <li>URL: Paste the <strong className="text-foreground">Endpoint URL</strong> above</li>
                                                <li>Headers: <code className="bg-muted px-1 rounded">Authorization: Bearer {'<your key>'}</code></li>
                                                <li>Data: <code className="bg-muted px-1 rounded">{`{"phone_number": "+1..."}`}</code></li>
                                                <li>Click <strong className="text-foreground">Test</strong> to verify the connection</li>
                                            </ol>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <p>Send a POST request with a JSON body containing <code className="bg-muted px-1 rounded">phone_number</code> (required). Optional: <code className="bg-muted px-1 rounded">agent_id</code>, <code className="bg-muted px-1 rounded">from_number</code>, <code className="bg-muted px-1 rounded">contact_name</code>, <code className="bg-muted px-1 rounded">metadata</code>, <code className="bg-muted px-1 rounded">scheduled_at</code>.</p>
                                                <div className="bg-muted rounded p-2 font-mono text-[10px] leading-relaxed overflow-x-auto">
                                                    <span className="text-muted-foreground">curl</span> -X POST {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/trigger-call \<br />
                                                    {'  '}-H {'"'}Authorization: Bearer {'<key>'}{'"\u00A0\\'}<br />
                                                    {'  '}-H {'"'}Content-Type: application/json{'"'} \<br />
                                                    {'  '}-d {'\''}{`{"phone_number": "+15551234567"}`}{'\''}<br />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {integrationsError && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/50 rounded-md">
                            {integrationsError}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button
                            onClick={handleSaveIntegrations}
                            disabled={savingIntegrations}
                            variant={integrationsSaved ? 'outline' : 'default'}
                        >
                            {savingIntegrations ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : integrationsSaved ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                                    Saved
                                </>
                            ) : (
                                'Save integrations'
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={disconnectConfirm !== null} onOpenChange={(open: boolean) => { if (!open) setDisconnectConfirm(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect integration?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will disconnect your{' '}
                            {disconnectConfirm === 'ghl' ? 'GoHighLevel' : disconnectConfirm === 'hubspot' ? 'HubSpot' : 'Google Calendar'}{' '}
                            integration. Any workflows using this integration will stop working.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (disconnectConfirm === 'ghl') {
                                    window.location.href = '/api/auth/ghl?action=disconnect';
                                } else if (disconnectConfirm === 'hubspot') {
                                    window.location.href = '/api/auth/hubspot?action=disconnect';
                                } else if (disconnectConfirm === 'google_calendar') {
                                    window.location.href = '/api/auth/google-calendar?action=disconnect';
                                }
                            }}
                        >
                            Disconnect
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
