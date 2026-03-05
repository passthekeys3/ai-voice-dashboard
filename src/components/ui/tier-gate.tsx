'use client';

import Link from 'next/link';
import { Lock, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PlanTier, TierFeature } from '@/lib/billing/tiers';
import { hasFeature, minimumTierForFeature, featureLabel } from '@/lib/billing/tiers';

interface TierGateProps {
    /** User's current tier, or null if no subscription */
    currentTier: PlanTier | null;
    /** The feature being gated */
    requiredFeature: TierFeature;
    /** Content to render when the user has access */
    children: React.ReactNode;
    /** Optional custom label for the feature (defaults to featureLabel()) */
    label?: string;
}

/** Human-readable tier name */
function tierDisplayName(tier: PlanTier): string {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Wraps content behind a tier feature check.
 * If the user's tier has the required feature, renders children.
 * Otherwise, renders an upgrade prompt card.
 */
export function TierGate({ currentTier, requiredFeature, children, label }: TierGateProps) {
    if (currentTier && hasFeature(currentTier, requiredFeature)) {
        return <>{children}</>;
    }

    const minTier = minimumTierForFeature(requiredFeature);
    const displayLabel = label || featureLabel(requiredFeature);

    return (
        <Card className="border-dashed">
            <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-3 p-3 rounded-full bg-muted w-fit">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg">{displayLabel}</CardTitle>
                <CardDescription>
                    This feature is available on the{' '}
                    <Badge variant="secondary" className="font-semibold">
                        {tierDisplayName(minTier)}
                    </Badge>{' '}
                    plan and above.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
                <Button asChild>
                    <Link href="/billing/upgrade">
                        Upgrade Plan
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}

/**
 * Standalone upgrade card — renders the locked card directly without needing children.
 * Use this inside components where the tier check is done separately (e.g., after hooks).
 */
export function TierGateCard({ currentTier: _currentTier, requiredFeature, label }: Omit<TierGateProps, 'children'>) {
    const minTier = minimumTierForFeature(requiredFeature);
    const displayLabel = label || featureLabel(requiredFeature);

    return (
        <Card className="border-dashed">
            <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-3 p-3 rounded-full bg-muted w-fit">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg">{displayLabel}</CardTitle>
                <CardDescription>
                    This feature is available on the{' '}
                    <Badge variant="secondary" className="font-semibold">
                        {tierDisplayName(minTier)}
                    </Badge>{' '}
                    plan and above.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
                <Button asChild>
                    <Link href="/billing/upgrade">
                        Upgrade Plan
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}

/**
 * Inline badge for showing tier requirements on cards/list items.
 * Shows "Growth+" or "Agency" badge with lock icon.
 */
export function TierBadge({ feature, currentTier }: { feature: TierFeature; currentTier: PlanTier | null }) {
    if (currentTier && hasFeature(currentTier, feature)) {
        return null; // No badge needed — user has access
    }

    const minTier = minimumTierForFeature(feature);

    return (
        <Badge variant="outline" className="text-xs gap-1 font-normal">
            <Lock className="h-3 w-3" />
            {tierDisplayName(minTier)}+
        </Badge>
    );
}
