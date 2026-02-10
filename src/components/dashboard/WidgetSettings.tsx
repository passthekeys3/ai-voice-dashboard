'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Code, Copy, Check, Globe, Palette } from 'lucide-react';

interface WidgetConfig {
    color?: string;
    position?: 'left' | 'right';
    greeting?: string;
    avatar_url?: string;
}

interface WidgetSettingsProps {
    agentId: string;
    agentName: string;
    widgetEnabled: boolean;
    widgetConfig: WidgetConfig;
}

export function WidgetSettings({
    agentId,
    agentName,
    widgetEnabled: initialEnabled,
    widgetConfig: initialConfig,
}: WidgetSettingsProps) {
    const [enabled, setEnabled] = useState(initialEnabled);
    const [config, setConfig] = useState<WidgetConfig>({
        color: initialConfig?.color || '#0f172a',
        position: initialConfig?.position || 'right',
        greeting: initialConfig?.greeting || `Talk to ${agentName}`,
        avatar_url: initialConfig?.avatar_url || '',
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : 'https://app.prosody.ai';

    const embedCode = `<script src="${baseUrl}/widget/embed.js"
  data-agent-id="${agentId}"
  data-color="${config.color || '#0f172a'}"
  data-position="${config.position || 'right'}">
</script>`;

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSaved(false);

        try {
            const response = await fetch(`/api/agents/${agentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    widget_enabled: enabled,
                    widget_config: config,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save widget settings');
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(embedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = embedCode;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="h-5 w-5" />
                            Web Voice Widget
                        </CardTitle>
                        <CardDescription>
                            Embed a voice call widget on any website
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant={enabled ? 'default' : 'secondary'}>
                            {enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Switch
                            checked={enabled}
                            onCheckedChange={setEnabled}
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Embed Code */}
                {enabled && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                                <Code className="h-4 w-4" />
                                Embed Code
                            </Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopy}
                                className="h-8"
                            >
                                {copied ? (
                                    <>
                                        <Check className="mr-1 h-3 w-3" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="mr-1 h-3 w-3" />
                                        Copy
                                    </>
                                )}
                            </Button>
                        </div>
                        <pre className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                            {embedCode}
                        </pre>
                        <p className="text-xs text-muted-foreground">
                            Paste this code before the closing <code>&lt;/body&gt;</code> tag of any website.
                        </p>
                    </div>
                )}

                {/* Appearance Settings */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Appearance
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Primary Color */}
                        <div className="space-y-2">
                            <Label htmlFor="widget-color">Primary Color</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    id="widget-color"
                                    value={config.color || '#0f172a'}
                                    onChange={(e) => setConfig({ ...config, color: e.target.value })}
                                    className="w-10 h-10 rounded cursor-pointer border border-border"
                                />
                                <Input
                                    value={config.color || '#0f172a'}
                                    onChange={(e) => setConfig({ ...config, color: e.target.value })}
                                    placeholder="#0f172a"
                                    className="flex-1 font-mono text-sm"
                                />
                            </div>
                        </div>

                        {/* Position */}
                        <div className="space-y-2">
                            <Label>Button Position</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={config.position === 'left' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setConfig({ ...config, position: 'left' })}
                                    className="flex-1"
                                >
                                    Bottom Left
                                </Button>
                                <Button
                                    type="button"
                                    variant={config.position === 'right' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setConfig({ ...config, position: 'right' })}
                                    className="flex-1"
                                >
                                    Bottom Right
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Greeting */}
                    <div className="space-y-2">
                        <Label htmlFor="widget-greeting">Greeting Text</Label>
                        <Input
                            id="widget-greeting"
                            value={config.greeting || ''}
                            onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
                            placeholder={`Talk to ${agentName}`}
                        />
                        <p className="text-xs text-muted-foreground">
                            Displayed when the widget opens, before a call starts.
                        </p>
                    </div>

                    {/* Avatar URL */}
                    <div className="space-y-2">
                        <Label htmlFor="widget-avatar">Avatar URL (optional)</Label>
                        <Input
                            id="widget-avatar"
                            value={config.avatar_url || ''}
                            onChange={(e) => setConfig({ ...config, avatar_url: e.target.value })}
                            placeholder="https://example.com/avatar.png"
                        />
                        <p className="text-xs text-muted-foreground">
                            Custom avatar image for the widget. Leave empty to show the agent&apos;s initial.
                        </p>
                    </div>
                </div>

                {/* Preview */}
                {enabled && (
                    <div className="space-y-2">
                        <Label>Preview</Label>
                        <div className="relative bg-slate-100 dark:bg-slate-800 rounded-lg h-32 flex items-end justify-end p-4 overflow-hidden">
                            <div className="text-xs text-muted-foreground absolute top-3 left-3">
                                Your website
                            </div>
                            {/* Simulated floating button */}
                            <div
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    backgroundColor: config.color || '#0f172a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                    position: 'absolute',
                                    bottom: 16,
                                    [config.position === 'left' ? 'left' : 'right']: 16,
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error / Success */}
                {error && (
                    <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Widget Settings'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
