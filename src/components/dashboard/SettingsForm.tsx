'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Palette, Mail, Phone, Globe, RefreshCw, Key, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Agency } from '@/types';

interface SettingsFormProps {
    agency: Agency;
}

// Values masked by the server look like "...abc1" — they are not real keys
const isMasked = (v?: string | null): boolean => !!v?.startsWith('...');

// For a secret field: if it was masked, init to "" (user types to replace)
const initSecret = (v?: string | null): string => isMasked(v) ? '' : (v || '');

export function SettingsForm({ agency }: SettingsFormProps) {
    const [showPreview, setShowPreview] = useState(false);
    const [savingBranding, setSavingBranding] = useState(false);
    const [brandingSaved, setBrandingSaved] = useState(false);
    const [brandingError, setBrandingError] = useState<string | null>(null);
    const [savingKeys, setSavingKeys] = useState(false);
    const [keysSaved, setKeysSaved] = useState(false);
    const [keysError, setKeysError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);
    // Track which secret fields have an existing value on the server (came as masked "...xxxx")
    // This never changes — it's computed once from the initial agency prop.
    const [hadMasked] = useState(() => ({
        retellApiKey: isMasked(agency.retell_api_key),
        vapiApiKey: isMasked(agency.vapi_api_key),
        vapiPublicKey: isMasked(agency.vapi_public_key),
        blandApiKey: isMasked(agency.bland_api_key),
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
        vapiPublicKey: initSecret(agency.vapi_public_key),
        blandApiKey: initSecret(agency.bland_api_key),
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
            if (formData.vapiPublicKey) payload.vapi_public_key = formData.vapiPublicKey;
            else if (!hadMasked.vapiPublicKey) payload.vapi_public_key = null;
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
            // Hard reload so the new theme/branding takes effect immediately
            window.location.reload();
        } catch {
            setBrandingError('An unexpected error occurred');
        } finally {
            setSavingBranding(false);
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
                        <Label htmlFor="vapiPublicKey">Vapi Public Key</Label>
                        <Input
                            id="vapiPublicKey"
                            type="text"
                            value={formData.vapiPublicKey}
                            onChange={(e) => {
                                setFormData({ ...formData, vapiPublicKey: e.target.value });
                                setKeysSaved(false);
                                setSyncResult(null);
                            }}
                            placeholder={hadMasked.vapiPublicKey ? `Key set (${agency.vapi_public_key}) — type to replace` : 'Enter your Vapi Public key'}
                        />
                        <p className="text-xs text-muted-foreground">
                            Required for test calls. Find under &quot;Public Key&quot; in your{' '}
                            <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                Vapi Dashboard
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
                            disabled={savingKeys || (!hasKey('retellApiKey', formData.retellApiKey) && !hasKey('vapiApiKey', formData.vapiApiKey) && !hasKey('vapiPublicKey', formData.vapiPublicKey) && !hasKey('blandApiKey', formData.blandApiKey))}
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
                            disabled={syncing || (!hasKey('retellApiKey', formData.retellApiKey) && !hasKey('vapiApiKey', formData.vapiApiKey) && !hasKey('vapiPublicKey', formData.vapiPublicKey) && !hasKey('blandApiKey', formData.blandApiKey))}
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

        </div>
    );
}
