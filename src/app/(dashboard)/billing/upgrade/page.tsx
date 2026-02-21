'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/dashboard/Header';
import { PricingTable } from '@/components/dashboard/PricingTable';
import type { PlanTier } from '@/types/database';

type BillingInterval = 'monthly' | 'yearly';

export default function UpgradePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSelectTier = async (tier: PlanTier, interval: BillingInterval = 'monthly') => {
        setLoading(true);
        setLoadingTier(tier);
        setError(null);

        try {
            const response = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tier,
                    interval,
                    return_url: window.location.origin + '/billing',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create checkout session');
            }

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setLoading(false);
            setLoadingTier(null);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-auto">
                <Link
                    href="/billing"
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to Billing
                </Link>

                <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold tracking-tight">Choose Your Plan</h2>
                    <p className="text-muted-foreground mt-2">
                        Select a plan to get started with Prosody. All plans include core AI voice agent features.
                    </p>
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-md text-center max-w-xl mx-auto">
                        {error}
                    </div>
                )}

                <div className="max-w-5xl mx-auto">
                    <PricingTable
                        onSelectTier={handleSelectTier}
                        loading={loading}
                        loadingTier={loadingTier}
                        buttonLabel="Subscribe"
                    />
                </div>

                <p className="text-center text-sm text-muted-foreground">
                    Pay yearly and save 2 months. You can upgrade, downgrade, or cancel at any time.
                </p>
            </div>
        </div>
    );
}
