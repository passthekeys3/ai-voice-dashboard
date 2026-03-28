'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { getAllTierConfigs, PLATFORM_PER_MINUTE_RATE } from '@/lib/billing/tiers';
import type { PlanTier, PlanType } from '@/types/database';

type BillingInterval = 'monthly' | 'yearly';

// Derive pricing data from the single source of truth in tiers.ts
const TIERS = getAllTierConfigs();

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
                    ? `Build and manage your own AI voice agents. Use your own API keys for flat-rate pricing, or our platform keys for $${PLATFORM_PER_MINUTE_RATE}/min.`
                    : `We build and manage your AI agents for you. All calls use our platform at $${PLATFORM_PER_MINUTE_RATE}/min.`}
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
                {TIERS.map(({ tier, selfService, managed }) => {
                    const config = planType === 'self_service' ? selfService : managed;
                    const isCurrent = currentTier === tier && currentPlanType === planType;
                    const isRecommended = tier === 'growth';
                    const isLoading = loading && loadingTier === tier;

                    const displayPrice = interval === 'yearly' ? config.yearlyMonthly : config.monthlyPrice;

                    return (
                        <Card
                            key={`${tier}-${planType}`}
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
                                <CardTitle>{config.displayName}</CardTitle>
                                <CardDescription>
                                    <span className="text-3xl font-bold text-foreground">${displayPrice}</span>
                                    <span className="text-muted-foreground">/month</span>
                                    {interval === 'yearly' && (
                                        <span className="block text-xs text-muted-foreground mt-1">
                                            ${config.yearlyPrice}/year — save ${config.monthlyPrice * 12 - config.yearlyPrice}
                                        </span>
                                    )}
                                    {/* Per-minute rate indicator */}
                                    {planType === 'managed' && (
                                        <span className="block text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                                            + ${PLATFORM_PER_MINUTE_RATE}/min for calls
                                        </span>
                                    )}
                                    {planType === 'self_service' && (
                                        <span className="block text-xs text-muted-foreground mt-1">
                                            ${PLATFORM_PER_MINUTE_RATE}/min with platform keys
                                        </span>
                                    )}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="flex flex-col flex-1">
                                {/* Client limit + overage */}
                                <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
                                    <p className="font-medium">{config.limits.maxClients} clients included</p>
                                    <p className="text-muted-foreground">${config.limits.additionalClientPrice}/additional client</p>
                                </div>

                                <ul className="space-y-2.5 flex-1 mb-6">
                                    {config.features.map((feature) => (
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
                                    onClick={() => onSelectTier(tier, interval, planType)}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : isCurrent ? (
                                        'Current Plan'
                                    ) : currentTier ? (
                                        `Switch to ${config.displayName}`
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
