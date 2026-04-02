'use client';

import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, PhoneIcon, MapPin, Info } from 'lucide-react';
import { PROVIDER_LABELS } from '@/lib/constants/config';

interface BuyPhoneNumberButtonProps {
    agents: { id: string; name: string; provider?: string }[];
    configuredProviders: string[];
    onPurchaseComplete?: () => void;
}

const POPULAR_AREA_CODES = [
    { code: '212', region: 'New York, NY' },
    { code: '213', region: 'Los Angeles, CA' },
    { code: '312', region: 'Chicago, IL' },
    { code: '415', region: 'San Francisco, CA' },
    { code: '512', region: 'Austin, TX' },
    { code: '617', region: 'Boston, MA' },
    { code: '702', region: 'Las Vegas, NV' },
    { code: '305', region: 'Miami, FL' },
    { code: '404', region: 'Atlanta, GA' },
    { code: '713', region: 'Houston, TX' },
    { code: '720', region: 'Denver, CO' },
    { code: '503', region: 'Portland, OR' },
];

export function BuyPhoneNumberButton({ agents, configuredProviders, onPurchaseComplete }: BuyPhoneNumberButtonProps) {
    const [open, setOpen] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const purchaseInProgress = useRef(false);

    const [provider, setProvider] = useState<string>(configuredProviders[0] || '');
    const [areaCode, setAreaCode] = useState('');
    const [customAreaCode, setCustomAreaCode] = useState('');
    const [agentId, setAgentId] = useState<string>('');

    // Filter agents to only show those matching the selected provider
    const filteredAgents = useMemo(() => {
        if (!provider) return agents;
        return agents.filter(a => !a.provider || a.provider === provider);
    }, [agents, provider]);

    const resetForm = () => {
        setProvider(configuredProviders[0] || '');
        setAreaCode('');
        setCustomAreaCode('');
        setAgentId('');
        setError(null);
    };

    const handlePurchase = async () => {
        if (purchaseInProgress.current) return;
        purchaseInProgress.current = true;

        const finalAreaCode = areaCode === 'custom' ? customAreaCode : areaCode;

        if (!provider) {
            setError('Please select a voice provider');
            purchaseInProgress.current = false;
            return;
        }

        if (!finalAreaCode || finalAreaCode.length !== 3) {
            setError('Please enter a valid 3-digit area code');
            purchaseInProgress.current = false;
            return;
        }

        setPurchasing(true);
        setError(null);

        try {
            const response = await fetch('/api/phone-numbers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    area_code: finalAreaCode,
                    agent_id: agentId || undefined,
                    provider,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to purchase number');
            }

            setOpen(false);
            resetForm();
            onPurchaseComplete?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setPurchasing(false);
            purchaseInProgress.current = false;
        }
    };

    if (configuredProviders.length === 0) {
        return (
            <Button disabled>
                <Plus className="mr-2 h-4 w-4" />
                Buy Phone Number
            </Button>
        );
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen: boolean) => {
            setOpen(isOpen);
            if (!isOpen) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Buy Phone Number
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PhoneIcon className="h-5 w-5" />
                        Purchase Phone Number
                    </DialogTitle>
                    <DialogDescription>
                        Get a new phone number for your AI agents. The number will be purchased from your selected provider.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Provider Selection */}
                    <div className="space-y-2">
                        <Label>Voice Provider *</Label>
                        {configuredProviders.length === 1 ? (
                            <div className="flex items-center gap-2 p-2.5 border rounded-md bg-muted/50">
                                <span className="text-sm font-medium">{PROVIDER_LABELS[configuredProviders[0]] || configuredProviders[0]}</span>
                            </div>
                        ) : (
                            <Select value={provider} onValueChange={(v: string) => {
                                setProvider(v);
                                setAgentId(''); // Reset agent when switching provider
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    {configuredProviders.map((p) => (
                                        <SelectItem key={p} value={p}>
                                            {PROVIDER_LABELS[p] || p}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Area Code */}
                    <div className="space-y-2">
                        <Label>Area Code *</Label>
                        <Select value={areaCode} onValueChange={setAreaCode}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select area code" />
                            </SelectTrigger>
                            <SelectContent>
                                {POPULAR_AREA_CODES.map((ac) => (
                                    <SelectItem key={ac.code} value={ac.code}>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-3 w-3 text-muted-foreground" />
                                            ({ac.code}) {ac.region}
                                        </div>
                                    </SelectItem>
                                ))}
                                <SelectItem value="custom">
                                    Enter custom area code...
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {areaCode === 'custom' && (
                        <div className="space-y-2">
                            <Label>Custom Area Code *</Label>
                            <Input
                                type="text"
                                value={customAreaCode}
                                onChange={(e) => setCustomAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                placeholder="e.g., 555"
                                maxLength={3}
                            />
                        </div>
                    )}

                    {/* Agent Assignment */}
                    <div className="space-y-2">
                        <Label>Assign to Agent (Optional)</Label>
                        <Select value={agentId || 'none'} onValueChange={(v: string) => setAgentId(v === 'none' ? '' : v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select agent (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No agent (assign later)</SelectItem>
                                {filteredAgents.map((agent) => (
                                    <SelectItem key={agent.id} value={agent.id}>
                                        {agent.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            You can assign this number to an agent later
                        </p>
                    </div>

                    {/* Billing Info */}
                    <div className="bg-muted p-4 rounded-lg flex items-start gap-2.5">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium">
                                Billed by {PROVIDER_LABELS[provider] || 'your provider'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Phone number charges are billed directly to your {PROVIDER_LABELS[provider] || 'provider'} account.
                                Check your provider dashboard for pricing details.
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handlePurchase} disabled={purchasing || !areaCode || !provider}>
                        {purchasing ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Purchasing...
                            </>
                        ) : (
                            'Purchase Number'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
