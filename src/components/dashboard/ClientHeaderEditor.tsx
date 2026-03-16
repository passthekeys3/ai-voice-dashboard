'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface ClientHeaderEditorProps {
    clientId: string;
    initialName: string;
    initialEmail: string;
    initialIsActive: boolean;
}

export function ClientHeaderEditor({
    clientId,
    initialName,
    initialEmail,
    initialIsActive,
}: ClientHeaderEditorProps) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState(initialName);
    const [email, setEmail] = useState(initialEmail);
    const [isActive, setIsActive] = useState(initialIsActive);

    // Track display values separately so we can revert on cancel
    const [displayName, setDisplayName] = useState(initialName);
    const [displayEmail, setDisplayEmail] = useState(initialEmail);
    const [displayActive, setDisplayActive] = useState(initialIsActive);

    const handleCancel = () => {
        setName(displayName);
        setEmail(displayEmail);
        setIsActive(displayActive);
        setEditing(false);
    };

    const handleSave = async () => {
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();

        if (!trimmedName) {
            toast.error('Client name is required');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/clients/${clientId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    email: trimmedEmail,
                    is_active: isActive,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to update client');
            }

            setDisplayName(trimmedName);
            setDisplayEmail(trimmedEmail);
            setDisplayActive(isActive);
            setEditing(false);
            toast.success('Client updated');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update client');
        } finally {
            setSaving(false);
        }
    };

    const handleActiveToggle = async (checked: boolean) => {
        setIsActive(checked);

        // If not in full edit mode, save immediately
        if (!editing) {
            setSaving(true);
            try {
                const res = await fetch(`/api/clients/${clientId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: checked }),
                });

                if (!res.ok) throw new Error('Failed to update status');

                setDisplayActive(checked);
                toast.success(checked ? 'Client activated' : 'Client deactivated');
            } catch {
                setIsActive(displayActive); // revert
                toast.error('Failed to update status');
            } finally {
                setSaving(false);
            }
        }
    };

    if (editing) {
        return (
            <div className="flex flex-col gap-2 min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Client name"
                        className="h-9 text-lg font-bold"
                        autoFocus
                    />
                    <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email (optional)"
                        type="email"
                        className="h-9"
                    />
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
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="min-w-0">
                <h2 className="text-2xl font-bold tracking-tight truncate">{displayName}</h2>
                {displayEmail && (
                    <p className="text-muted-foreground truncate">{displayEmail}</p>
                )}
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5" title={displayActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}>
                    <Switch
                        checked={displayActive}
                        onCheckedChange={handleActiveToggle}
                        disabled={saving}
                        aria-label="Toggle client active status"
                    />
                    <Badge variant={displayActive ? 'default' : 'secondary'} className="cursor-default">
                        {displayActive ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditing(true)}
                    aria-label="Edit client name and email"
                >
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
