'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import type { ClientPermissions } from '@/types';
import { DEFAULT_CLIENT_PERMISSIONS } from '@/types/database';

interface ClientPermissionsEditorProps {
    permissions: ClientPermissions;
    agencyId: string;
    isAgencyDefault?: boolean; // true = editing agency defaults, false = editing client override
    clientId?: string; // required if isAgencyDefault is false
}

const PERMISSION_LABELS: Record<keyof ClientPermissions, { label: string; description: string }> = {
    show_costs: {
        label: 'Show Call Costs',
        description: 'Allow clients to see the cost of each call',
    },
    show_transcripts: {
        label: 'Show Transcripts',
        description: 'Allow clients to view call transcripts',
    },
    show_analytics: {
        label: 'Show Analytics',
        description: 'Allow clients to access the analytics dashboard',
    },
    allow_playback: {
        label: 'Allow Audio Playback',
        description: 'Allow clients to listen to call recordings',
    },
    can_edit_agents: {
        label: 'Edit Agents',
        description: 'Allow clients to modify agent settings (prompts, voice, knowledge base)',
    },
    can_create_agents: {
        label: 'Create Agents',
        description: 'Allow clients to create new agents via the Agent Builder',
    },
    can_export_calls: {
        label: 'Export Calls',
        description: 'Allow clients to download call data as CSV exports',
    },
};

export function ClientPermissionsEditor({
    permissions: initialPermissions,
    agencyId,
    isAgencyDefault = true,
    clientId,
}: ClientPermissionsEditorProps) {
    const router = useRouter();
    const [permissions, setPermissions] = useState<ClientPermissions>(
        initialPermissions || DEFAULT_CLIENT_PERMISSIONS
    );
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const handleToggle = (key: keyof ClientPermissions) => {
        setPermissions(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const endpoint = isAgencyDefault
                ? `/api/agencies/${agencyId}/permissions`
                : `/api/clients/${clientId}/permissions`;

            const response = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || 'Failed to save permissions');
            }

            toast.success('Permissions saved');
            setHasChanges(false);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {isAgencyDefault ? 'Default Client Permissions' : 'Client Permissions'}
                </CardTitle>
                <CardDescription>
                    {isAgencyDefault
                        ? 'These permissions apply to all clients by default. Individual clients can have custom overrides.'
                        : 'Override the default permissions for this specific client.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {(Object.keys(PERMISSION_LABELS) as Array<keyof ClientPermissions>).map((key) => (
                    <div key={key} className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor={key} className="text-base">
                                {PERMISSION_LABELS[key].label}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                {PERMISSION_LABELS[key].description}
                            </p>
                        </div>
                        <Switch
                            id={key}
                            checked={permissions[key]}
                            onCheckedChange={() => handleToggle(key)}
                        />
                    </div>
                ))}

                <div className="pt-4 border-t">
                    <Button onClick={handleSave} disabled={saving || !hasChanges}>
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Permissions'
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
