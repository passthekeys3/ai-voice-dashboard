'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Link2, Link2Off, AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';

interface ConnectStatus {
    connected: boolean;
    account_id?: string;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
    onboarding_complete?: boolean;
    requirements?: { currently_due: number } | null;
    platform_fee_percent?: number;
    error?: string;
}

export function StripeConnectSection() {
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<ConnectStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [platformFee, setPlatformFee] = useState<string>('0');
    const [feeLoading, setFeeLoading] = useState(false);

    // Check for onboarding return in URL params
    useEffect(() => {
        const stripeConnect = searchParams.get('stripe_connect');
        if (stripeConnect === 'return') {
            setSuccessMessage('Stripe Connect onboarding complete! Checking your account status...');
            window.history.replaceState({}, '', window.location.pathname);
        } else if (stripeConnect === 'refresh') {
            setError('Stripe onboarding session expired. Please try again.');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [searchParams]);

    // Fetch Connect status
    useEffect(() => {
        async function fetchStatus() {
            try {
                const response = await fetch('/api/billing/connect');
                if (!response.ok) {
                    throw new Error('Failed to fetch Connect status');
                }
                const result = await response.json();
                setStatus(result.data);
                if (result.data?.platform_fee_percent !== undefined) {
                    setPlatformFee(String(result.data.platform_fee_percent));
                }
            } catch {
                setError('Failed to load Stripe Connect status');
            } finally {
                setLoading(false);
            }
        }

        fetchStatus();
    }, []);

    const handleSavePlatformFee = async () => {
        const feeValue = parseFloat(platformFee);
        if (isNaN(feeValue) || feeValue < 0 || feeValue > 50) {
            setError('Platform fee must be between 0% and 50%');
            return;
        }

        setFeeLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/billing/connect', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform_fee_percent: feeValue }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update platform fee');
            }

            setSuccessMessage('Platform fee updated successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update platform fee');
        } finally {
            setFeeLoading(false);
        }
    };

    const handleConnect = async () => {
        setActionLoading('connect');
        setError(null);

        try {
            const response = await fetch('/api/billing/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    return_url: window.location.href,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start Stripe Connect onboarding');
            }

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start onboarding');
            setActionLoading(null);
        }
    };

    const handleViewDashboard = async () => {
        setActionLoading('dashboard');
        setError(null);

        try {
            const response = await fetch('/api/billing/connect/dashboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to open Stripe Dashboard');
            }

            if (data.url) {
                window.open(data.url, '_blank');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to open dashboard');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect your Stripe account? This will remove payment methods for all your clients.')) {
            return;
        }

        setActionLoading('disconnect');
        setError(null);

        try {
            const response = await fetch('/api/billing/connect', {
                method: 'DELETE',
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to disconnect');
            }

            setStatus({ connected: false });
            setSuccessMessage('Stripe account disconnected successfully');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to disconnect');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Stripe Connect — Client Billing</CardTitle>
                    <CardDescription>Connect your Stripe account to bill clients directly</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-10 w-40" />
                </CardContent>
            </Card>
        );
    }

    const isConnected = status?.connected;
    const isFullyActive = isConnected && status.charges_enabled && status.payouts_enabled;
    const isOnboardingIncomplete = isConnected && !status.details_submitted;
    const hasRequirements = isConnected && status.requirements && status.requirements.currently_due > 0;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Link2 className="h-5 w-5" />
                            Stripe Connect — Client Billing
                        </CardTitle>
                        <CardDescription>
                            Connect your Stripe account to collect payments from your clients directly
                        </CardDescription>
                    </div>
                    {isFullyActive && <Badge variant="default">Connected</Badge>}
                    {isConnected && !isFullyActive && !isOnboardingIncomplete && (
                        <Badge variant="secondary">Restricted</Badge>
                    )}
                    {isOnboardingIncomplete && <Badge variant="outline">Setup Incomplete</Badge>}
                    {!isConnected && <Badge variant="outline">Not Connected</Badge>}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Messages */}
                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-md flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}
                {successMessage && (
                    <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-950/20 rounded-md flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                        {successMessage}
                    </div>
                )}

                {/* Not Connected State */}
                {!isConnected && (
                    <div className="p-6 border-2 border-dashed rounded-lg text-center">
                        <Link2Off className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <h3 className="text-lg font-semibold mb-2">Connect Your Stripe Account</h3>
                        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                            Link your Stripe account to automatically collect payments from your clients.
                            Invoices are created on your account — we never touch the money.
                        </p>
                        <Button
                            onClick={handleConnect}
                            disabled={actionLoading !== null}
                            size="lg"
                        >
                            {actionLoading === 'connect' ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Setting up...
                                </>
                            ) : (
                                <>
                                    <Link2 className="h-4 w-4 mr-2" />
                                    Connect Stripe
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* Onboarding Incomplete */}
                {isOnboardingIncomplete && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-amber-800 dark:text-amber-200">
                                    Complete your Stripe setup
                                </p>
                                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                    You started linking your Stripe account but haven&apos;t finished the verification process.
                                </p>
                                <Button
                                    variant="outline"
                                    className="mt-3"
                                    onClick={handleConnect}
                                    disabled={actionLoading !== null}
                                >
                                    {actionLoading === 'connect' ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        'Complete Setup'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Connected + Active */}
                {isConnected && status.details_submitted && (
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm text-muted-foreground">Charges</p>
                                <p className="font-medium flex items-center gap-1.5">
                                    {status.charges_enabled ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            Enabled
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="h-4 w-4 text-amber-600" />
                                            Restricted
                                        </>
                                    )}
                                </p>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm text-muted-foreground">Payouts</p>
                                <p className="font-medium flex items-center gap-1.5">
                                    {status.payouts_enabled ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            Enabled
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="h-4 w-4 text-amber-600" />
                                            Restricted
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Platform Fee */}
                        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                            <div>
                                <Label htmlFor="platform-fee" className="text-sm font-medium">
                                    Platform Fee
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Percentage deducted from client invoices as your platform fee (0-50%)
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative w-32">
                                    <Input
                                        id="platform-fee"
                                        type="number"
                                        min={0}
                                        max={50}
                                        step={0.5}
                                        value={platformFee}
                                        onChange={(e) => setPlatformFee(e.target.value)}
                                        className="pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSavePlatformFee}
                                    disabled={feeLoading || parseFloat(platformFee) === (status?.platform_fee_percent ?? 0)}
                                >
                                    {feeLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 mr-1" />
                                            Save
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Requirements Warning */}
                        {hasRequirements && (
                            <div className="p-3 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-md flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                Your Stripe account has {status.requirements!.currently_due} pending requirement(s).
                                Open your Stripe Dashboard to resolve them.
                            </div>
                        )}

                        <Separator />

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3">
                            <Button
                                onClick={handleViewDashboard}
                                disabled={actionLoading !== null}
                            >
                                {actionLoading === 'dashboard' ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Opening...
                                    </>
                                ) : (
                                    <>
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        View Stripe Dashboard
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDisconnect}
                                disabled={actionLoading !== null}
                            >
                                {actionLoading === 'disconnect' ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Disconnecting...
                                    </>
                                ) : (
                                    <>
                                        <Link2Off className="h-4 w-4 mr-2" />
                                        Disconnect
                                    </>
                                )}
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Disconnecting will remove payment methods for all your clients.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
