'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { PlanTier } from '@/types/database';

type BillingInterval = 'monthly' | 'yearly';

interface TierConfig {
    tier: PlanTier;
    name: string;
    monthlyPrice: number;
    yearlyMonthly: number;
    yearlyTotal: number;
    limits: {
        maxAgents: number;
        maxCallMinutesPerMonth: number;
        maxClients: number;
    };
    features: string[];
}

// Must match the TIER_CONFIGS in src/lib/billing/tiers.ts
const TIERS: TierConfig[] = [
    {
        tier: 'starter',
        name: 'Starter',
        monthlyPrice: 99,
        yearlyMonthly: 83,
        yearlyTotal: 990,
        limits: { maxAgents: Infinity, maxCallMinutesPerMonth: Infinity, maxClients: 3 },
        features: [
            '3 Clients included',
            '$15/client for additional clients',
            'Unlimited agents',
            'AI Agent Builder',
            'Custom domain',
            'Call analytics',
            'Workflow automation',
            'Email support',
        ],
    },
    {
        tier: 'growth',
        name: 'Growth',
        monthlyPrice: 249,
        yearlyMonthly: 208,
        yearlyTotal: 2490,
        limits: { maxAgents: Infinity, maxCallMinutesPerMonth: Infinity, maxClients: 5 },
        features: [
            '5 Clients included',
            '$12/client for additional clients',
            'All Starter features',
            'CRM integrations (GHL + HubSpot)',
            'Stripe Connect client billing',
        ],
    },
    {
        tier: 'scale',
        name: 'Scale',
        monthlyPrice: 499,
        yearlyMonthly: 416,
        yearlyTotal: 4990,
        limits: { maxAgents: Infinity, maxCallMinutesPerMonth: Infinity, maxClients: 10 },
        features: [
            '10 Clients included',
            '$10/client for additional clients',
            'All features',
            'White-label platform',
            'API access',
            'Priority support',
        ],
    },
];

interface PricingTableProps {
    currentTier?: PlanTier | null;
    onSelectTier: (tier: PlanTier, interval: BillingInterval) => void;
    loading?: boolean;
    loadingTier?: PlanTier | null;
    buttonLabel?: string;
    currentInterval?: BillingInterval;
}

export function PricingTable({
    currentTier,
    onSelectTier,
    loading,
    loadingTier,
    buttonLabel = 'Get Started',
    currentInterval = 'monthly',
}: PricingTableProps) {
    const [interval, setBillingInterval] = useState<BillingInterval>(currentInterval);

    return (
        <div className="space-y-6">
            {/* Billing toggle */}
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
                    const isCurrent = currentTier === tier.tier;
                    const isRecommended = tier.tier === 'growth';
                    const isLoading = loading && loadingTier === tier.tier;
                    const displayPrice = interval === 'yearly' ? tier.yearlyMonthly : tier.monthlyPrice;

                    return (
                        <Card
                            key={tier.tier}
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
                                <CardTitle>{tier.name}</CardTitle>
                                <CardDescription>
                                    <span className="text-3xl font-bold text-foreground">${displayPrice}</span>
                                    <span className="text-muted-foreground">/month</span>
                                    {interval === 'yearly' && (
                                        <span className="block text-xs text-muted-foreground mt-1">
                                            ${tier.yearlyTotal}/year — save ${tier.monthlyPrice * 12 - tier.yearlyTotal}
                                        </span>
                                    )}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="flex flex-col flex-1">
                                <ul className="space-y-2.5 flex-1 mb-6">
                                    {tier.features.map((feature) => (
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
                                    onClick={() => onSelectTier(tier.tier, interval)}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : isCurrent ? (
                                        'Current Plan'
                                    ) : currentTier ? (
                                        `Switch to ${tier.name}`
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
