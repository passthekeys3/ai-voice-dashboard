'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { PlanTier } from '@/types/database';

interface TierConfig {
    tier: PlanTier;
    name: string;
    monthlyPrice: number;
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
        limits: { maxAgents: 3, maxCallMinutesPerMonth: 500, maxClients: 5 },
        features: [
            'Up to 3 AI agents',
            '500 call minutes/month',
            'Up to 5 clients',
            'Call analytics',
            'Workflow automation',
            'Email support',
        ],
    },
    {
        tier: 'growth',
        name: 'Growth',
        monthlyPrice: 249,
        limits: { maxAgents: 10, maxCallMinutesPerMonth: 2000, maxClients: 25 },
        features: [
            'Up to 10 AI agents',
            '2,000 call minutes/month',
            'Up to 25 clients',
            'CRM integrations (GHL + HubSpot)',
            'Stripe Connect client billing',
            'Custom domain',
            'Priority support',
        ],
    },
    {
        tier: 'scale',
        name: 'Scale',
        monthlyPrice: 499,
        limits: { maxAgents: 50, maxCallMinutesPerMonth: 10000, maxClients: 100 },
        features: [
            'Up to 50 AI agents',
            '10,000 call minutes/month',
            'Up to 100 clients',
            'All integrations',
            'Stripe Connect client billing',
            'Custom domain + white-label',
            'API access',
            'Dedicated support',
        ],
    },
];

interface PricingTableProps {
    currentTier?: PlanTier | null;
    onSelectTier: (tier: PlanTier) => void;
    loading?: boolean;
    loadingTier?: PlanTier | null;
    buttonLabel?: string;
}

export function PricingTable({
    currentTier,
    onSelectTier,
    loading,
    loadingTier,
    buttonLabel = 'Get Started',
}: PricingTableProps) {
    return (
        <div className="grid gap-6 md:grid-cols-3">
            {TIERS.map((tier) => {
                const isCurrent = currentTier === tier.tier;
                const isRecommended = tier.tier === 'growth';
                const isLoading = loading && loadingTier === tier.tier;

                return (
                    <Card
                        key={tier.tier}
                        className={`relative flex flex-col ${
                            isRecommended ? 'border-primary shadow-md' : ''
                        } ${isCurrent ? 'border-green-500 bg-green-50/50 dark:bg-green-950/10' : ''}`}
                    >
                        {isRecommended && !isCurrent && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <Badge>Recommended</Badge>
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
                                <span className="text-3xl font-bold text-foreground">${tier.monthlyPrice}</span>
                                <span className="text-muted-foreground">/month</span>
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
                                onClick={() => onSelectTier(tier.tier)}
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
    );
}
