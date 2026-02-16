'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { PlanTier } from '@/types/database';

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused' | null;

interface BillingData {
    subscription: {
        status: SubscriptionStatus;
        subscription_id: string | null;
        price_id: string | null;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        plan_tier: PlanTier | null;
        plan_name: string | null;
        limits: {
            maxAgents: number;
            maxCallMinutesPerMonth: number;
            maxClients: number;
        } | null;
    };
    has_payment_method: boolean;
    usage: {
        period_start: string;
        period_end: string;
        total_calls: number;
        total_minutes: number;
        total_cost: number;
    };
}

function getStatusBadge(status: SubscriptionStatus) {
    if (!status) {
        return <Badge variant="outline">No subscription</Badge>;
    }

    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
        active: { variant: 'default', label: 'Active' },
        trialing: { variant: 'secondary', label: 'Trial' },
        past_due: { variant: 'destructive', label: 'Past Due' },
        canceled: { variant: 'outline', label: 'Canceled' },
        unpaid: { variant: 'destructive', label: 'Unpaid' },
        incomplete: { variant: 'outline', label: 'Incomplete' },
        incomplete_expired: { variant: 'outline', label: 'Expired' },
        paused: { variant: 'secondary', label: 'Paused' },
    };

    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export function BillingSection() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [billingData, setBillingData] = useState<BillingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Check for checkout success/cancel in URL params
    useEffect(() => {
        const checkout = searchParams.get('checkout');
        if (checkout === 'success') {
            setSuccessMessage('Subscription activated successfully! Your billing details have been updated.');
            window.history.replaceState({}, '', window.location.pathname);
        } else if (checkout === 'canceled') {
            setError('Checkout was canceled. You can try again when ready.');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [searchParams]);

    // Fetch billing data
    useEffect(() => {
        async function fetchBillingData() {
            try {
                const response = await fetch('/api/billing/portal');
                if (!response.ok) {
                    throw new Error('Failed to fetch billing data');
                }
                const result = await response.json();
                setBillingData(result.data);
            } catch (_err) {
                setError('Failed to load billing information');
            } finally {
                setLoading(false);
            }
        }

        fetchBillingData();
    }, []);

    const handleManageBilling = async () => {
        setActionLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/billing/portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    return_url: window.location.href,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to open billing portal');
            }

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (_err) {
            setError('Failed to open billing portal');
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Billing & Subscription</CardTitle>
                    <CardDescription>Manage your subscription and billing details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-10 w-40" />
                </CardContent>
            </Card>
        );
    }

    const hasActiveSubscription = billingData?.subscription.status === 'active' ||
        billingData?.subscription.status === 'trialing';

    const planName = billingData?.subscription.plan_name;
    const limits = billingData?.subscription.limits;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Billing & Subscription</CardTitle>
                        <CardDescription>Manage your subscription and billing details</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {planName && <Badge variant="secondary">{planName}</Badge>}
                        {billingData && getStatusBadge(billingData.subscription.status)}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Messages */}
                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-md">
                        {error}
                    </div>
                )}
                {successMessage && (
                    <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-950/20 rounded-md">
                        {successMessage}
                    </div>
                )}

                {/* Subscription Status */}
                {billingData && (
                    <>
                        {hasActiveSubscription ? (
                            <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Current Period</p>
                                        <p className="font-medium">
                                            {formatDate(billingData.subscription.current_period_start)} -{' '}
                                            {formatDate(billingData.subscription.current_period_end)}
                                        </p>
                                    </div>
                                    {billingData.subscription.cancel_at_period_end && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Cancellation</p>
                                            <p className="font-medium text-amber-600">
                                                Will cancel on {formatDate(billingData.subscription.current_period_end)}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Plan Limits */}
                                {limits && (
                                    <>
                                        <Separator />
                                        <div>
                                            <h4 className="text-sm font-medium mb-3">Plan Limits</h4>
                                            <div className="grid gap-4 md:grid-cols-3">
                                                <div className="p-4 bg-muted/50 rounded-lg">
                                                    <p className="text-2xl font-bold">{limits.maxAgents}</p>
                                                    <p className="text-sm text-muted-foreground">Max Agents</p>
                                                </div>
                                                <div className="p-4 bg-muted/50 rounded-lg">
                                                    <p className="text-2xl font-bold">{limits.maxCallMinutesPerMonth.toLocaleString()}</p>
                                                    <p className="text-sm text-muted-foreground">Minutes/Month</p>
                                                </div>
                                                <div className="p-4 bg-muted/50 rounded-lg">
                                                    <p className="text-2xl font-bold">{limits.maxClients}</p>
                                                    <p className="text-sm text-muted-foreground">Max Clients</p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                <Separator />

                                {/* Current Period Usage */}
                                <div>
                                    <h4 className="text-sm font-medium mb-3">Current Period Usage</h4>
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="p-4 bg-muted/50 rounded-lg">
                                            <p className="text-2xl font-bold">{billingData.usage.total_calls}</p>
                                            <p className="text-sm text-muted-foreground">Total Calls</p>
                                        </div>
                                        <div className="p-4 bg-muted/50 rounded-lg">
                                            <p className="text-2xl font-bold">{billingData.usage.total_minutes.toFixed(1)}</p>
                                            <p className="text-sm text-muted-foreground">Minutes Used</p>
                                        </div>
                                        <div className="p-4 bg-muted/50 rounded-lg">
                                            <p className="text-2xl font-bold">${billingData.usage.total_cost.toFixed(2)}</p>
                                            <p className="text-sm text-muted-foreground">Usage Cost</p>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Actions */}
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        onClick={handleManageBilling}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? 'Loading...' : 'Manage Subscription'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => router.push('/billing/upgrade')}
                                    >
                                        Change Plan
                                    </Button>
                                    <p className="text-sm text-muted-foreground self-center">
                                        Update payment method, view invoices, or change your plan
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-6 border-2 border-dashed rounded-lg text-center">
                                    <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Subscribe to unlock all features and start making AI-powered calls.
                                    </p>
                                    <Button
                                        onClick={() => router.push('/billing/upgrade')}
                                        size="lg"
                                    >
                                        Choose a Plan
                                    </Button>
                                </div>

                                {billingData.subscription.status === 'past_due' && (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                                        <p className="text-amber-700 dark:text-amber-400 font-medium">
                                            Your subscription payment is past due
                                        </p>
                                        <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                                            Please update your payment method to restore access.
                                        </p>
                                        <Button
                                            variant="outline"
                                            className="mt-3"
                                            onClick={handleManageBilling}
                                            disabled={actionLoading}
                                        >
                                            Update Payment Method
                                        </Button>
                                    </div>
                                )}

                                {billingData.subscription.status === 'canceled' && billingData.has_payment_method && (
                                    <div className="p-4 bg-muted/50 rounded-lg">
                                        <p className="font-medium">Your subscription has been canceled</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            You can resubscribe at any time to regain access.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
