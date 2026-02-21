'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Key, Eye, EyeOff, X } from 'lucide-react';
import { toast } from 'sonner';

interface ClientApiKeysEditorProps {
    clientId: string;
    retellApiKey?: string | null;
    vapiApiKey?: string | null;
    blandApiKey?: string | null;
}

const API_KEY_MAX_LENGTH = 256;
const API_KEY_PATTERN = /^[a-zA-Z0-9_\-:.]+$/;

const PROVIDERS = [
    { key: 'retell_api_key' as const, label: 'Retell API Key', placeholder: 'key_...' },
    { key: 'vapi_api_key' as const, label: 'Vapi API Key', placeholder: 'vapi-...' },
    { key: 'bland_api_key' as const, label: 'Bland API Key', placeholder: 'sk-...' },
] as const;

type ProviderKey = typeof PROVIDERS[number]['key'];

// Masked values from the API look like "...abc1" — they are not real keys
const isMasked = (v?: string | null): v is string => !!v?.startsWith('...');

export function ClientApiKeysEditor({
    clientId,
    retellApiKey,
    vapiApiKey,
    blandApiKey,
}: ClientApiKeysEditorProps) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    // Map props to initial state: masked values are NOT real keys, so start empty
    const initial: Record<ProviderKey, string | null | undefined> = {
        retell_api_key: retellApiKey,
        vapi_api_key: vapiApiKey,
        bland_api_key: blandApiKey,
    };

    const [keys, setKeys] = useState<Record<ProviderKey, string>>({
        retell_api_key: isMasked(retellApiKey) ? '' : (retellApiKey || ''),
        vapi_api_key: isMasked(vapiApiKey) ? '' : (vapiApiKey || ''),
        bland_api_key: isMasked(blandApiKey) ? '' : (blandApiKey || ''),
    });
    const [visibility, setVisibility] = useState<Record<ProviderKey, boolean>>({
        retell_api_key: false,
        vapi_api_key: false,
        bland_api_key: false,
    });
    // Track which existing keys the user explicitly wants to clear
    const [cleared, setCleared] = useState<Record<ProviderKey, boolean>>({
        retell_api_key: false,
        vapi_api_key: false,
        bland_api_key: false,
    });

    // Whether a key existed on the server (came as masked value)
    const hasExisting = (key: ProviderKey) => isMasked(initial[key]);

    // Has changes if user typed a new key, or cleared an existing one
    const hasChanges = PROVIDERS.some(({ key }) =>
        keys[key].trim() !== '' || (hasExisting(key) && cleared[key])
    );

    const validate = (): string | null => {
        for (const { key, label } of PROVIDERS) {
            const value = keys[key].trim();
            if (value) {
                if (value.length > API_KEY_MAX_LENGTH) {
                    return `${label} is too long (max ${API_KEY_MAX_LENGTH} characters)`;
                }
                if (!API_KEY_PATTERN.test(value)) {
                    return `${label} contains invalid characters`;
                }
            }
        }
        return null;
    };

    const handleSave = async () => {
        const error = validate();
        if (error) {
            toast.error(error);
            return;
        }

        setSaving(true);
        try {
            const payload: Record<string, string | null> = {};
            for (const { key } of PROVIDERS) {
                const value = keys[key].trim();
                if (value) {
                    // New key entered
                    payload[key] = value;
                } else if (cleared[key]) {
                    // User explicitly cleared an existing key
                    payload[key] = null;
                }
                // Otherwise: don't include — preserve existing server value
            }

            const response = await fetch(`/api/clients/${clientId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error?.message || data.error || 'Failed to save API keys');
            }

            toast.success('API keys updated');
            router.refresh();
        } catch (err) {
            console.error('Failed to save API keys:', err);
            toast.error('Failed to save API keys', {
                description: err instanceof Error ? err.message : 'Please try again',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleClear = (key: ProviderKey) => {
        setKeys((prev) => ({ ...prev, [key]: '' }));
        if (hasExisting(key)) {
            setCleared((prev) => ({ ...prev, [key]: true }));
        }
    };

    const handleChange = (key: ProviderKey, value: string) => {
        setKeys((prev) => ({ ...prev, [key]: value }));
        // If user starts typing, unmark cleared
        if (value && cleared[key]) {
            setCleared((prev) => ({ ...prev, [key]: false }));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Voice Provider API Keys
                </CardTitle>
                <CardDescription>
                    Assign provider-specific API keys for this client&apos;s workspace.
                    Leave empty to use the agency&apos;s default key.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {PROVIDERS.map(({ key, label, placeholder }) => {
                    const existing = hasExisting(key);
                    const isCleared = cleared[key];
                    const hasValue = !!keys[key];
                    // Show X if user typed something OR there's an existing key not yet cleared
                    const showClear = hasValue || (existing && !isCleared);

                    // Dynamic placeholder: show masked hint if key exists on server
                    const inputPlaceholder = existing && !isCleared
                        ? `Key set (${initial[key]}) — type to replace`
                        : placeholder;

                    return (
                        <div key={key} className="space-y-1.5">
                            <Label htmlFor={key}>{label}</Label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        id={key}
                                        type={visibility[key] ? 'text' : 'password'}
                                        value={keys[key]}
                                        onChange={(e) => handleChange(key, e.target.value)}
                                        placeholder={inputPlaceholder}
                                        className="pr-10 font-mono text-sm"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                            setVisibility((prev) => ({
                                                ...prev,
                                                [key]: !prev[key],
                                            }))
                                        }
                                        tabIndex={-1}
                                    >
                                        {visibility[key] ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                                {showClear && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:text-red-500"
                                        onClick={() => handleClear(key)}
                                        tabIndex={-1}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            {existing && isCleared && (
                                <p className="text-xs text-amber-600">
                                    Key will be removed on save. This client will use the agency default.
                                </p>
                            )}
                        </div>
                    );
                })}

                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                        Keys are stored securely and used when building agents for this client.
                    </p>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        size="sm"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save Keys
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
