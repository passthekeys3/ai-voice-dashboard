import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { ExperimentResults } from '@/components/dashboard/ExperimentResults';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isValidUuid } from '@/lib/validation';
import { computeVariantMetrics, computeSignificance } from '@/lib/experiments/metrics';

export const metadata: Metadata = { title: 'Experiment Details' };

export default async function ExperimentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    if (!isValidUuid(id)) {
        notFound();
    }
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Fetch experiment with variants
    const { data: experiment, error } = await supabase
        .from('experiments')
        .select('*, agent:agents(name), variants:experiment_variants(*)')
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .single();

    if (error || !experiment) {
        notFound();
    }

    // Get all agent IDs for this agency (for scoping variant call queries)
    const { data: agencyAgents } = await supabase
        .from('agents')
        .select('id')
        .eq('agency_id', user.agency.id);
    const agencyAgentIds = agencyAgents?.map(a => a.id) || [];

    // Calculate metrics for each variant using shared computation
    const variantCallsMap: Record<string, { duration_seconds?: number; sentiment?: string; status?: string }[]> = {};

    for (const variant of experiment.variants || []) {
        if (agencyAgentIds.length === 0) {
            Object.assign(variant, computeVariantMetrics([]));
            variantCallsMap[variant.id] = [];
            continue;
        }

        const { data: calls } = await supabase
            .from('calls')
            .select('duration_seconds, sentiment, status')
            .eq('variant_id', variant.id)
            .in('agent_id', agencyAgentIds);

        variantCallsMap[variant.id] = calls || [];
        Object.assign(variant, computeVariantMetrics(calls || []));
    }

    // Compute statistical significance between top 2 variants
    if (experiment.variants && experiment.variants.length >= 2) {
        const sorted = [...experiment.variants].sort((a, b) => {
            const goal = experiment.goal || 'conversion';
            const metricKey = goal === 'conversion' ? 'conversion_rate' : goal === 'duration' ? 'avg_duration' : 'avg_sentiment';
            return (b[metricKey] || 0) - (a[metricKey] || 0);
        });

        const topTwo = sorted.slice(0, 2);
        experiment.confidence = computeSignificance(
            experiment.goal || 'conversion',
            { calls: variantCallsMap[topTwo[0].id] || [], metrics: topTwo[0] },
            { calls: variantCallsMap[topTwo[1].id] || [], metrics: topTwo[1] },
        );
    }

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Experiment Details"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/experiments" aria-label="Back to experiments">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">{experiment.name}</h2>
                        <p className="text-muted-foreground">
                            {experiment.description || `Testing ${experiment.variants?.length || 0} variants`}
                        </p>
                    </div>
                </div>

                <ExperimentResults experiment={experiment} />
            </div>
        </div>
    );
}
