'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, CreditCard, Calendar, DollarSign, Clock, CheckCircle2, AlertCircle, Link2Off, Brain } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { BillingType } from '@/types';

interface ClientBillingEditorProps {
    clientId: string;
    billingType?: BillingType | null;
    billingAmountCents?: number | null;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    nextBillingDate?: string | null;
    agencyHasConnect?: boolean;
    aiCallAnalysis?: boolean;
}

const BILLING_TYPE_INFO: Record<BillingType, { label: string; description: string; amountLabel: string; amountPlaceholder: string }> = {
    subscription: {
        label: 'Monthly Subscription',
        description: 'Fixed monthly fee charged on a recurring basis',
        amountLabel: 'Monthly Fee',
        amountPlaceholder: 'e.g., 299.00',
    },
    per_minute: {
        label: 'Per-Minute Usage',
        description: 'Charge based on total call minutes used',
        amountLabel: 'Rate per Minute',
        amountPlaceholder: 'e.g., 0.15',
    },
    one_time: {
        label: 'One-Time Fee',
        description: 'Single payment for services rendered',
        amountLabel: 'One-Time Amount',
        amountPlaceholder: 'e.g., 1500.00',
    },
};

function formatCentsToDollars(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) return '';
    return (cents / 100).toFixed(2);
}

function parseDollarsToCents(dollars: string): number | null {
    const value = parseFloat(dollars);
    if (isNaN(value)) return null;
    return Math.round(value * 100);
}

function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export function ClientBillingEditor({
    clientId,
    billingType: initialBillingType,
    billingAmountCents: initialAmountCents,
    stripeSubscriptionId,
    stripeCustomerId,
    nextBillingDate,
    agencyHasConnect,
    aiCallAnalysis: initialAiCallAnalysis,
}: ClientBillingEditorProps) {
    const router = useRouter();
    const [billingType, setBillingType] = useState<BillingType | ''>(initialBillingType || '');
    const [amountInput, setAmountInput] = useState(formatCentsToDollars(initialAmountCents));
    const [aiCallAnalysis, setAiCallAnalysis] = useState(initialAiCallAnalysis ?? false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [setupLoading, setSetupLoading] = useState(false);

    const handleBillingTypeChange = (value: BillingType | 'none') => {
        if (value === 'none') {
            setBillingType('');
        } else {
            setBillingType(value);
        }
        setHasChanges(true);
    };

    const handleAmountChange = (value: string) => {
        // Allow only valid decimal input
        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
            setAmountInput(value);
            setHasChanges(true);
        }
    };

    const handleSave = async () => {
        if (billingType && !amountInput) {
            toast.error('Please enter a billing amount');
            return;
        }

        const amountCents = parseDollarsToCents(amountInput);
        if (billingType && amountCents !== null && amountCents < 0) {
            toast.error('Amount must be a positive number');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`/api/clients/${clientId}/billing`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    billing_type: billingType || null,
                    billing_amount_cents: billingType ? amountCents : null,
                    ai_call_analysis: aiCallAnalysis,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || 'Failed to save billing settings');
            }

            toast.success('Billing settings saved');
            setHasChanges(false);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleSetupPayment = async () => {
        setSetupLoading(true);
        try {
            const response = await fetch(`/api/clients/${clientId}/billing/setup-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create payment setup');
            }

            // For now, show the client_secret in a toast — a full Stripe Elements modal
            // would be implemented as a separate component in production.
            toast.success('Payment setup initiated! Client secret ready for Stripe Elements integration.');
            // In production, you would mount Stripe Elements with:
            // data.client_secret and data.stripe_account_id
            console.log('SetupIntent created:', { clientSecret: data.client_secret, stripeAccountId: data.stripe_account_id });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to set up payment');
        } finally {
            setSetupLoading(false);
        }
    };

    const currentTypeInfo = billingType ? BILLING_TYPE_INFO[billingType] : null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Billing Configuration
                </CardTitle>
                <CardDescription>
                    Configure how you bill this client for voice AI services.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Billing Type Selector */}
                <div className="space-y-2">
                    <Label htmlFor="billing-type">Billing Model</Label>
                    <Select
                        value={billingType || 'none'}
                        onValueChange={(value: string) => handleBillingTypeChange(value as BillingType | 'none')}
                    >
                        <SelectTrigger id="billing-type" className="w-full">
                            <SelectValue placeholder="Select billing model" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No billing configured</SelectItem>
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
                    {currentTypeInfo && (
                        <p className="text-sm text-muted-foreground">
                            {currentTypeInfo.description}
                        </p>
                    )}
                </div>

                {/* Billing Amount */}
                {billingType && currentTypeInfo && (
                    <div className="space-y-2">
                        <Label htmlFor="billing-amount">{currentTypeInfo.amountLabel}</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                $
                            </span>
                            <Input
                                id="billing-amount"
                                type="text"
                                inputMode="decimal"
                                value={amountInput}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                placeholder={currentTypeInfo.amountPlaceholder}
                                className="pl-7"
                            />
                        </div>
                        {billingType === 'per_minute' && (
                            <p className="text-sm text-muted-foreground">
                                Rate charged per minute of call time
                            </p>
                        )}
                    </div>
                )}

                {/* Stripe Subscription Info (read-only) */}
                {billingType === 'subscription' && stripeSubscriptionId && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <CreditCard className="h-4 w-4" />
                            Active Subscription
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Subscription ID</p>
                                <p className="font-mono text-xs truncate">{stripeSubscriptionId}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Next Billing</p>
                                <p>{formatDate(nextBillingDate)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary */}
                {billingType && amountInput && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            Billing Summary
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                            {billingType === 'subscription' && `$${amountInput}/month recurring`}
                            {billingType === 'per_minute' && `$${amountInput} per minute of call time`}
                            {billingType === 'one_time' && `$${amountInput} one-time payment`}
                        </p>
                    </div>
                )}

                {/* Payment Method Setup */}
                {billingType && (
                    <>
                        <Separator />
                        <div className="space-y-3">
                            <Label className="text-base">Payment Collection</Label>
                            {!agencyHasConnect ? (
                                <div className="p-4 bg-muted/50 rounded-lg flex items-start gap-3">
                                    <Link2Off className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">Stripe not connected</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Connect your Stripe account in Settings to collect payments from this client.
                                        </p>
                                    </div>
                                </div>
                            ) : stripeCustomerId ? (
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                            Payment method on file
                                        </p>
                                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                            This client has a Stripe customer set up for automatic billing.
                                        </p>
                                        <Badge variant="outline" className="mt-2 font-mono text-xs">
                                            {stripeCustomerId}
                                        </Badge>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                            No payment method
                                        </p>
                                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                            Set up a payment method to automatically collect payments from this client.
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-3"
                                            onClick={handleSetupPayment}
                                            disabled={setupLoading}
                                        >
                                            {setupLoading ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Setting up...
                                                </>
                                            ) : (
                                                <>
                                                    <CreditCard className="h-4 w-4 mr-2" />
                                                    Set Up Payment Method
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* AI Call Analysis Add-on */}
                <Separator />
                <div className="space-y-3">
                    <Label className="text-base flex items-center gap-2">
                        <Brain className="h-4 w-4 text-purple-500" />
                        AI Call Analysis
                    </Label>
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Enable AI-powered analysis</p>
                            <p className="text-sm text-muted-foreground max-w-md">
                                AI analyzes every call transcript — extracts sentiment, topics, objections, and action items. $0.01 per analyzed call.
                            </p>
                        </div>
                        <Switch
                            checked={aiCallAnalysis}
                            onCheckedChange={(checked: boolean) => {
                                setAiCallAnalysis(checked);
                                setHasChanges(true);
                            }}
                        />
                    </div>
                    {aiCallAnalysis && (
                        <p className="text-xs text-muted-foreground">
                            Calls shorter than 30 seconds or with very short transcripts are automatically skipped.
                        </p>
                    )}
                </div>

                <div className="pt-4 border-t">
                    <Button onClick={handleSave} disabled={saving || !hasChanges}>
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Billing Settings'
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
