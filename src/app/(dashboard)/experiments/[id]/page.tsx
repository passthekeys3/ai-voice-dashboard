import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { ExperimentResults } from '@/components/dashboard/ExperimentResults';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Experiment Details' };

export default async function ExperimentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
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

    // Calculate metrics for each variant
    for (const variant of experiment.variants || []) {
        const { data: calls } = await supabase
            .from('calls')
            .select('duration_seconds, sentiment, status')
            .eq('variant_id', variant.id);

        if (calls && calls.length > 0) {
            variant.call_count = calls.length;
            variant.avg_duration = Math.round(
                calls.reduce((sum: number, c: { duration_seconds?: number }) => sum + (c.duration_seconds || 0), 0) / calls.length
            );

            const sentimentScores = calls.map((c: { sentiment?: string }) => {
                if (c.sentiment === 'positive') return 1;
                if (c.sentiment === 'negative') return 0;
                return 0.5;
            });
            variant.avg_sentiment = Math.round(
                sentimentScores.reduce((sum: number, s: number) => sum + s, 0) / sentimentScores.length * 100
            ) / 100;

            const completedCalls = calls.filter((c: { status?: string }) => c.status === 'completed').length;
            variant.conversion_rate = Math.round((completedCalls / calls.length) * 100);
        } else {
            variant.call_count = 0;
            variant.avg_duration = 0;
            variant.avg_sentiment = 0;
            variant.conversion_rate = 0;
        }
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
                        <Link href="/experiments">
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
