'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Plus, Loader2, PhoneIcon, MapPin, DollarSign } from 'lucide-react';

interface BuyPhoneNumberButtonProps {
    agents: { id: string; name: string }[];
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

export function BuyPhoneNumberButton({ agents }: BuyPhoneNumberButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [areaCode, setAreaCode] = useState('');
    const [customAreaCode, setCustomAreaCode] = useState('');
    const [agentId, setAgentId] = useState<string>('');

    const resetForm = () => {
        setAreaCode('');
        setCustomAreaCode('');
        setAgentId('');
        setError(null);
    };

    const handlePurchase = async () => {
        const finalAreaCode = areaCode === 'custom' ? customAreaCode : areaCode;

        if (!finalAreaCode || finalAreaCode.length !== 3) {
            setError('Please enter a valid 3-digit area code');
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
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to purchase number');
            }

            setOpen(false);
            resetForm();
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setPurchasing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
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
                        Get a new phone number for your AI agents. Numbers are charged monthly.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
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

                    <div className="space-y-2">
                        <Label>Assign to Agent (Optional)</Label>
                        <Select value={agentId || 'none'} onValueChange={(v) => setAgentId(v === 'none' ? '' : v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select agent (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No agent (assign later)</SelectItem>
                                {agents.map((agent) => (
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

                    <div className="bg-muted p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Estimated Monthly Cost</span>
                            <div className="flex items-center gap-1 text-lg font-bold">
                                <DollarSign className="h-4 w-4" />
                                2.00/mo
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Billed to your Retell account
                        </p>
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
                    <Button onClick={handlePurchase} disabled={purchasing || !areaCode}>
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
