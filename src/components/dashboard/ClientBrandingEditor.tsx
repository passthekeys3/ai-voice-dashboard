'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Paintbrush, Pencil, Check, X, Loader2, RotateCcw } from 'lucide-react';
import { toast } from '@/lib/toast';
import type { ClientBranding } from '@/types';

interface ClientBrandingEditorProps {
    clientId: string;
    branding: ClientBranding | null;
}

export function ClientBrandingEditor({ clientId, branding }: ClientBrandingEditorProps) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [companyName, setCompanyName] = useState(branding?.company_name || '');
    const [logoUrl, setLogoUrl] = useState(branding?.logo_url || '');
    const [primaryColor, setPrimaryColor] = useState(branding?.primary_color || '');

    const [display, setDisplay] = useState<ClientBranding | null>(branding);

    const hasAnyBranding = display && (display.company_name || display.logo_url || display.primary_color);

    const handleCancel = () => {
        setCompanyName(display?.company_name || '');
        setLogoUrl(display?.logo_url || '');
        setPrimaryColor(display?.primary_color || '');
        setEditing(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const newBranding: ClientBranding = {};
            if (companyName.trim()) newBranding.company_name = companyName.trim();
            if (logoUrl.trim()) newBranding.logo_url = logoUrl.trim();
            if (primaryColor.trim()) newBranding.primary_color = primaryColor.trim();

            const res = await fetch(`/api/clients/${clientId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branding: Object.keys(newBranding).length > 0 ? newBranding : null }),
            });

            if (!res.ok) throw new Error('Failed to update branding');

            setDisplay(Object.keys(newBranding).length > 0 ? newBranding : null);
            setEditing(false);
            toast.success('Branding updated');
        } catch {
            toast.error('Failed to update branding');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/clients/${clientId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branding: null }),
            });

            if (!res.ok) throw new Error('Failed to reset branding');

            setDisplay(null);
            setCompanyName('');
            setLogoUrl('');
            setPrimaryColor('');
            setEditing(false);
            toast.success('Branding reset to agency defaults');
        } catch {
            toast.error('Failed to reset branding');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Paintbrush className="h-5 w-5" />
                    Branding
                </CardTitle>
                {!editing && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {editing ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="brand-name">Display Name</Label>
                            <Input
                                id="brand-name"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="Company name shown in sidebar"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="brand-logo">Logo URL</Label>
                            <Input
                                id="brand-logo"
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                placeholder="https://example.com/logo.png"
                                type="url"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="brand-color">Sidebar Color</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="brand-color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    placeholder="#0f172a"
                                    className="flex-1"
                                />
                                {primaryColor && (
                                    <div
                                        className="h-9 w-9 rounded-md border shrink-0"
                                        style={{ backgroundColor: primaryColor }}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                                Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                            </Button>
                            {hasAnyBranding && (
                                <Button size="sm" variant="outline" onClick={handleReset} disabled={saving} className="ml-auto">
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Reset to Defaults
                                </Button>
                            )}
                        </div>
                    </div>
                ) : hasAnyBranding ? (
                    <div className="space-y-3">
                        {display?.company_name && (
                            <div>
                                <p className="text-sm text-muted-foreground">Display Name</p>
                                <p className="font-medium">{display.company_name}</p>
                            </div>
                        )}
                        {display?.logo_url && (
                            <div>
                                <p className="text-sm text-muted-foreground">Logo</p>
                                <p className="font-mono text-sm truncate">{display.logo_url}</p>
                            </div>
                        )}
                        {display?.primary_color && (
                            <div>
                                <p className="text-sm text-muted-foreground">Sidebar Color</p>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="h-6 w-6 rounded border"
                                        style={{ backgroundColor: display.primary_color }}
                                    />
                                    <span className="font-mono text-sm">{display.primary_color}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-muted-foreground">
                        No custom branding configured. Using agency defaults.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
