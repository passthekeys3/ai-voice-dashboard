'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { PlanTier, PlanType } from '@/types/database';

type BillingInterval = 'monthly' | 'yearly';

interface TierConfig {
    tier: PlanTier;
    displayName: string;
    selfServicePrice: number;
    managedPrice: number;
    selfServiceYearlyMonthly: number;
    managedYearlyMonthly: number;
    selfServiceYearlyTotal: number;
    managedYearlyTotal: number;
    includedClients: number;
    selfServiceOverage: number;
    managedOverage: number;
    selfServiceFeatures: string[];
    managedFeatures: string[];
}

// Per-minute rate when using platform keys (applied to Self-Service w/ platform keys + all Managed)
const PER_MINUTE_RATE = 0.15;

// Must match TIER_CONFIGS in src/lib/billing/tiers.ts
const TIERS: TierConfig[] = [
    {
        tier: 'starter',
        displayName: 'Starter',
        selfServicePrice: 67,
        managedPrice: 97,
        selfServiceYearlyMonthly: 56,
        managedYearlyMonthly: 81,
        selfServiceYearlyTotal: 670,
        managedYearlyTotal: 970,
        includedClients: 3,
        selfServiceOverage: 15,
        managedOverage: 20,
        selfServiceFeatures: [
            '3 Clients included',
            'Unlimited agents',
            'AI Agent Builder',
            'Custom domain',
            'Call analytics',
            'Workflow automation',
            'Email support',
        ],
        managedFeatures: [
            '3 Clients included',
            'Done-for-you agent setup',
            'AI Agent Builder',
            'Custom domain',
            'Call analytics',
            'Workflow automation',
            'Priority support',
        ],
    },
    {
        tier: 'growth',
        displayName: 'Growth',
        selfServicePrice: 147,
        managedPrice: 197,
        selfServiceYearlyMonthly: 123,
        managedYearlyMonthly: 164,
        selfServiceYearlyTotal: 1470,
        managedYearlyTotal: 1970,
        includedClients: 10,
        selfServiceOverage: 12,
        managedOverage: 17,
        selfServiceFeatures: [
            '10 Clients included',
            'All Starter features',
            'CRM integrations (GHL + HubSpot)',
            'Stripe Connect client billing',
        ],
        managedFeatures: [
            '10 Clients included',
            'All Starter features',
            'Done-for-you integrations',
            'CRM integrations (GHL + HubSpot)',
            'Stripe Connect client billing',
        ],
    },
    {
        tier: 'agency',
        displayName: 'Agency',
        selfServicePrice: 297,
        managedPrice: 397,
        selfServiceYearlyMonthly: 248,
        managedYearlyMonthly: 331,
        selfServiceYearlyTotal: 2970,
        managedYearlyTotal: 3970,
        includedClients: 25,
        selfServiceOverage: 10,
        managedOverage: 15,
        selfServiceFeatures: [
            '25 Clients included',
            'All features',
            'White-label platform',
            'API access',
            'Priority support',
        ],
        managedFeatures: [
            '25 Clients included',
            'All features',
            'Done-for-you white-label setup',
            'API access',
            'Dedicated support',
        ],
    },
];

interface PricingTableProps {
    currentTier?: PlanTier | null;
    currentPlanType?: PlanType | null;
    onSelectTier: (tier: PlanTier, interval: BillingInterval, planType: PlanType) => void;
    loading?: boolean;
    loadingTier?: PlanTier | null;
    buttonLabel?: string;
    currentInterval?: BillingInterval;
}

export function PricingTable({
    currentTier,
    currentPlanType,
    onSelectTier,
    loading,
    loadingTier,
    buttonLabel = 'Get Started',
    currentInterval = 'monthly',
}: PricingTableProps) {
    const [interval, setBillingInterval] = useState<BillingInterval>(currentInterval);
    const [planType, setPlanType] = useState<PlanType>(currentPlanType || 'self_service');

    return (
        <div className="space-y-6">
            {/* Plan type toggle */}
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-1 rounded-full border bg-muted/50 p-1">
                    <button
                        onClick={() => setPlanType('self_service')}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                            planType === 'self_service'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Self-Service
                    </button>
                    <button
                        onClick={() => setPlanType('managed')}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                            planType === 'managed'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Managed
                    </button>
                </div>
            </div>

            {/* Plan type description */}
            <p className="text-center text-sm text-muted-foreground max-w-lg mx-auto">
                {planType === 'self_service'
                    ? 'Build and manage your own AI voice agents. Use your own API keys for flat-rate pricing, or our platform keys for $0.15/min.'
                    : 'We build and manage your AI agents for you. All calls use our platform at $0.15/min.'}
            </p>

            {/* Billing interval toggle */}
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-1 rounded-full border bg-muted/50 p-1">
                    <button
                        onClick={() => setBillingInterval('monthly')}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                            interval === 'monthly'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setBillingInterval('yearly')}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                            interval === 'yearly'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Yearly
                    </button>
                    <span className="ml-1 mr-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-2 py-0.5">
                        -2 months
                    </span>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {TIERS.map((tier) => {
                    const isCurrent = currentTier === tier.tier && currentPlanType === planType;
                    const isRecommended = tier.tier === 'growth';
                    const isLoading = loading && loadingTier === tier.tier;
                    const isSelfService = planType === 'self_service';

                    const monthlyPrice = isSelfService ? tier.selfServicePrice : tier.managedPrice;
                    const yearlyMonthly = isSelfService ? tier.selfServiceYearlyMonthly : tier.managedYearlyMonthly;
                    const yearlyTotal = isSelfService ? tier.selfServiceYearlyTotal : tier.managedYearlyTotal;
                    const displayPrice = interval === 'yearly' ? yearlyMonthly : monthlyPrice;
                    const overageRate = isSelfService ? tier.selfServiceOverage : tier.managedOverage;
                    const features = isSelfService ? tier.selfServiceFeatures : tier.managedFeatures;

                    return (
                        <Card
                            key={`${tier.tier}-${planType}`}
                            className={`relative flex flex-col ${
                                isRecommended ? 'border-primary shadow-md' : ''
                            } ${isCurrent ? 'border-green-500 bg-green-50/50 dark:bg-green-950/10' : ''}`}
                        >
                            {isRecommended && !isCurrent && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge>Popular</Badge>
                                </div>
                            )}
                            {isCurrent && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                        Current Plan
                                    </Badge>
                                </div>
                            )}

                            <CardHeader className="pb-4">
                                <CardTitle>{tier.displayName}</CardTitle>
                                <CardDescription>
                                    <span className="text-3xl font-bold text-foreground">${displayPrice}</span>
                                    <span className="text-muted-foreground">/month</span>
                                    {interval === 'yearly' && (
                                        <span className="block text-xs text-muted-foreground mt-1">
                                            ${yearlyTotal}/year — save ${monthlyPrice * 12 - yearlyTotal}
                                        </span>
                                    )}
                                    {/* Per-minute rate indicator */}
                                    {planType === 'managed' && (
                                        <span className="block text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                                            + ${PER_MINUTE_RATE}/min for calls
                                        </span>
                                    )}
                                    {planType === 'self_service' && (
                                        <span className="block text-xs text-muted-foreground mt-1">
                                            ${PER_MINUTE_RATE}/min with platform keys
                                        </span>
                                    )}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="flex flex-col flex-1">
                                {/* Client limit + overage */}
                                <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
                                    <p className="font-medium">{tier.includedClients} clients included</p>
                                    <p className="text-muted-foreground">${overageRate}/additional client</p>
                                </div>

                                <ul className="space-y-2.5 flex-1 mb-6">
                                    {features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2 text-sm">
                                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    className="w-full"
                                    variant={isCurrent ? 'outline' : isRecommended ? 'default' : 'outline'}
                                    disabled={isCurrent || loading}
                                    onClick={() => onSelectTier(tier.tier, interval, planType)}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : isCurrent ? (
                                        'Current Plan'
                                    ) : currentTier ? (
                                        `Switch to ${tier.displayName}`
                                    ) : (
                                        buttonLabel
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
