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
import { Plus, Loader2, Building2, Calendar, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { BillingType } from '@/types';

export function CreateClientDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [billingType, setBillingType] = useState<BillingType | ''>('');
    const [billingAmount, setBillingAmount] = useState('');

    const resetForm = () => {
        setName('');
        setEmail('');
        setBillingType('');
        setBillingAmount('');
        setError(null);
    };

    const getBillingAmountLabel = () => {
        switch (billingType) {
            case 'subscription':
                return 'Monthly Fee ($)';
            case 'per_minute':
                return 'Rate per Minute ($)';
            case 'one_time':
                return 'One-Time Amount ($)';
            default:
                return 'Amount ($)';
        }
    };

    const parseDollarsToCents = (dollars: string): number | null => {
        const value = parseFloat(dollars);
        if (isNaN(value)) return null;
        return Math.round(value * 100);
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            setError('Please enter a business name');
            return;
        }
        if (!email.trim()) {
            setError('Please enter a contact email');
            return;
        }
        if (billingType && !billingAmount) {
            setError('Please enter a billing amount');
            return;
        }

        const billingAmountCents = billingType ? parseDollarsToCents(billingAmount) : null;
        if (billingType && (billingAmountCents === null || billingAmountCents < 0)) {
            setError('Please enter a valid billing amount');
            return;
        }

        setCreating(true);
        setError(null);

        try {
            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    billing_type: billingType || null,
                    billing_amount_cents: billingAmountCents,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'Failed to create client');
            }

            setOpen(false);
            resetForm();
            toast.success('Client created successfully');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen: boolean) => {
            setOpen(isOpen);
            if (!isOpen) {
                resetForm();
            }
        }}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Client
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Add New Client
                    </DialogTitle>
                    <DialogDescription>
                        Add a business client to manage their voice AI agents and calls.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Business Name */}
                    <div className="space-y-2">
                        <Label htmlFor="client-name">Business Name *</Label>
                        <Input
                            id="client-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Acme Plumbing"
                        />
                    </div>

                    {/* Contact Email */}
                    <div className="space-y-2">
                        <Label htmlFor="client-email">Contact Email *</Label>
                        <Input
                            id="client-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g., owner@acmeplumbing.com"
                        />
                        <p className="text-xs text-muted-foreground">
                            This email will be used for client portal access
                        </p>
                    </div>

                    {/* Billing Configuration */}
                    <div className="space-y-2">
                        <Label htmlFor="billing-type">Billing Model (Optional)</Label>
                        <Select
                            value={billingType || 'none'}
                            onValueChange={(value: string) => setBillingType(value === 'none' ? '' : value as BillingType)}
                        >
                            <SelectTrigger id="billing-type" className="w-full">
                                <SelectValue placeholder="Select billing model" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Configure later</SelectItem>
                                <SelectItem value="subscription">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Monthly Subscription
                                    </div>
                                </SelectItem>
                                <SelectItem value="per_minute">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Per-Minute Usage
                                    </div>
                                </SelectItem>
                                <SelectItem value="one_time">
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="h-4 w-4" />
                                        One-Time Fee
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {billingType && (
                        <div className="space-y-2">
                            <Label htmlFor="billing-amount">{getBillingAmountLabel()}</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    $
                                </span>
                                <Input
                                    id="billing-amount"
                                    type="text"
                                    inputMode="decimal"
                                    value={billingAmount}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                                            setBillingAmount(value);
                                        }
                                    }}
                                    placeholder={billingType === 'per_minute' ? 'e.g., 0.15' : 'e.g., 299.00'}
                                    className="pl-7"
                                />
                            </div>
                        </div>
                    )}

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
                    <Button onClick={handleCreate} disabled={creating}>
                        {creating ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            'Add Client'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
