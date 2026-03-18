import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { ExperimentsList } from '@/components/dashboard/ExperimentsList';
import { TierGate } from '@/components/ui/tier-gate';
import { getTierFromPriceId } from '@/lib/billing/tiers';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Experiments' };

export default async function ExperimentsPage() {
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Resolve current tier for feature gating
    const tierInfo = getTierFromPriceId(user.agency.subscription_price_id || '');
    const currentTier = tierInfo?.tier ?? null;

    // Fetch experiments with variants
    const { data: experiments } = await supabase
        .from('experiments')
        .select('*, agent:agents(name), variants:experiment_variants(id)')
        .eq('agency_id', user.agency.id)
        .order('created_at', { ascending: false });

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Experiments"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <TierGate currentTier={currentTier} requiredFeature="experiments" label="A/B Experiments">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-2xl font-bold tracking-tight">A/B Experiments</h2>
                        <Button asChild>
                            <Link href="/experiments/new">
                                <Plus className="mr-2 h-4 w-4" />
                                New Experiment
                            </Link>
                        </Button>
                    </div>

                    <ExperimentsList
                        experiments={experiments || []}
                    />
                </TierGate>
            </div>
        </div>
    );
}
