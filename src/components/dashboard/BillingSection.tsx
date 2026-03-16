'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { PlanTier, PlanType } from '@/types/database';
import { formatDuration } from '@/lib/utils';

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused' | 'expired' | null;

interface BillingData {
    subscription: {
        status: SubscriptionStatus;
        subscription_id: string | null;
        price_id: string | null;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        plan_tier: PlanTier | null;
        plan_type?: PlanType | null;
        plan_name: string | null;
        limits: {
            maxAgents: number;
            maxCallMinutesPerMonth: number;
            maxClients: number;
            additionalClientPrice?: number;
        } | null;
        per_minute_rate?: number | null;
        is_beta?: boolean;
        beta_ends_at?: string | null;
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

function getStatusBadge(status: SubscriptionStatus, isBeta?: boolean) {
    if (!status) {
        return <Badge variant="outline">No subscription</Badge>;
    }

    if (isBeta && status === 'trialing') {
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Beta</Badge>;
    }

    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
        active: { variant: 'default', label: 'Active' },
        trialing: { variant: 'secondary', label: 'Trial' },
        past_due: { variant: 'destructive', label: 'Past Due' },
        canceled: { variant: 'outline', label: 'Canceled' },
        unpaid: { variant: 'destructive', label: 'Unpaid' },
        incomplete: { variant: 'outline', label: 'Incomplete' },
        incomplete_expired: { variant: 'outline', label: 'Expired' },
        expired: { variant: 'destructive', label: 'Trial Expired' },
        paused: { variant: 'secondary', label: 'Paused' },
    };

    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getPlanTypeBadge(planType: PlanType | null | undefined) {
    if (!planType) return null;
    return planType === 'managed'
        ? <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Managed</Badge>
        : <Badge variant="secondary">Self-Service</Badge>;
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
        const controller = new AbortController();

        async function fetchBillingData() {
            try {
                const response = await fetch('/api/billing/portal', { signal: controller.signal });
                if (!response.ok) {
                    throw new Error('Failed to fetch billing data');
                }
                const result = await response.json();
                setBillingData(result.data);
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
                setError('Failed to load billing information');
            } finally {
                setLoading(false);
            }
        }

        fetchBillingData();
        return () => controller.abort();
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
    const planType = billingData?.subscription.plan_type;
    const limits = billingData?.subscription.limits;
    const perMinuteRate = billingData?.subscription.per_minute_rate;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                        <CardTitle>Billing & Subscription</CardTitle>
                        <CardDescription>Manage your subscription and billing details</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {getPlanTypeBadge(planType)}
                        {planName && <Badge variant="secondary">{planName}</Badge>}
                        {billingData && getStatusBadge(billingData.subscription.status, billingData.subscription.is_beta)}
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
                                {billingData.subscription.is_beta && (
                                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900/50">
                                        <p className="font-medium text-blue-700 dark:text-blue-400">Beta Program</p>
                                        <p className="text-sm text-blue-600 dark:text-blue-500 mt-1">
                                            You have full access to all Agency-tier features.
                                            {billingData.subscription.beta_ends_at && (
                                                <> Beta access ends {formatDate(billingData.subscription.beta_ends_at)}.</>
                                            )}
                                        </p>
                                    </div>
                                )}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="min-w-0">
                                        <p className="text-sm text-muted-foreground">
                                            {billingData.subscription.is_beta ? 'Beta Period' : 'Current Period'}
                                        </p>
                                        <p className="font-medium text-sm sm:text-base break-words">
                                            {formatDate(billingData.subscription.current_period_start)} –{' '}
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
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                                                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                                                    <p className="text-xl sm:text-2xl font-bold">
                                                        {!isFinite(limits.maxAgents) ? '∞' : limits.maxAgents}
                                                    </p>
                                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                                        {!isFinite(limits.maxAgents) ? 'Unlimited Agents' : 'Max Agents'}
                                                    </p>
                                                </div>
                                                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                                                    <p className="text-xl sm:text-2xl font-bold">{limits.maxClients}</p>
                                                    <p className="text-xs sm:text-sm text-muted-foreground">Clients Included</p>
                                                    {limits.additionalClientPrice != null && limits.additionalClientPrice > 0 && (
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            ${limits.additionalClientPrice}/additional
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="col-span-2 sm:col-span-1 p-3 sm:p-4 bg-muted/50 rounded-lg">
                                                    <p className="text-xl sm:text-2xl font-bold">
                                                        {perMinuteRate != null ? `$${perMinuteRate}` : '—'}
                                                    </p>
                                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                                        {perMinuteRate != null ? 'Per Minute Rate' : 'No Per-Minute Billing'}
                                                    </p>
                                                    {planType === 'self_service' && perMinuteRate != null && (
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Only when using platform keys
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                <Separator />

                                {/* Current Period Usage */}
                                <div>
                                    <h4 className="text-sm font-medium mb-3">Current Period Usage</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                                        <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                                            <p className="text-xl sm:text-2xl font-bold">{billingData.usage.total_calls}</p>
                                            <p className="text-xs sm:text-sm text-muted-foreground">Total Calls</p>
                                        </div>
                                        <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                                            <p className="text-xl sm:text-2xl font-bold">{formatDuration(billingData.usage.total_minutes * 60)}</p>
                                            <p className="text-xs sm:text-sm text-muted-foreground">Duration Used</p>
                                        </div>
                                        <div className="col-span-2 sm:col-span-1 p-3 sm:p-4 bg-muted/50 rounded-lg">
                                            <p className="text-xl sm:text-2xl font-bold">${billingData.usage.total_cost.toFixed(2)}</p>
                                            <p className="text-xs sm:text-sm text-muted-foreground">Usage Cost</p>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Actions */}
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-3">
                                        <Button
                                            onClick={handleManageBilling}
                                            disabled={actionLoading}
                                            className="w-full sm:w-auto"
                                        >
                                            {actionLoading ? 'Loading...' : 'Manage Subscription'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => router.push('/billing/upgrade')}
                                            className="w-full sm:w-auto"
                                        >
                                            Change Plan
                                        </Button>
                                    </div>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
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
