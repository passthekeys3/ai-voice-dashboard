'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface AgentControlsProps {
    agentId: string;
    isActive: boolean;
    clientId: string | null;
    clients: { id: string; name: string }[];
}

export function AgentControls({ agentId, isActive, clientId, clients }: AgentControlsProps) {
    const router = useRouter();
    const [active, setActive] = useState(isActive);
    const [selectedClient, setSelectedClient] = useState(clientId || '');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const response = await fetch(`/api/agents/${agentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    is_active: active,
                    client_id: selectedClient || null,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                setMessage(`Error: ${data.error}`);
                return;
            }

            setMessage('Agent updated successfully');
            router.refresh();
        } catch (_err) {
            setMessage('Failed to update agent');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Agent Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Active Toggle */}
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

                {/* Client Assignment */}
                <div className="space-y-2">
                    <Label>Assign to Client</Label>
                    <Select value={selectedClient || 'unassigned'} onValueChange={(val) => setSelectedClient(val === 'unassigned' ? '' : val)}>
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
                    <p className="text-sm text-muted-foreground">
                        Assign this agent to a client for white-labeling
                    </p>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-4">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    {message && (
                        <span className={`text-sm ${message.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                            {message}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
