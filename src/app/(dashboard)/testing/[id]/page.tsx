import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { TestSuiteEditor } from '@/components/dashboard/TestSuiteEditor';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Test Suite' };

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function TestSuiteDetailPage({ params }: PageProps) {
    const { id } = await params;
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Fetch suite with cases, personas, and recent runs
    const { data: suite } = await supabase
        .from('test_suites')
        .select(`
            *,
            agent:agents(id, name, provider, config),
            test_cases(
                *,
                persona:test_personas(*)
            ),
            test_runs(id, status, passed_cases, failed_cases, errored_cases, avg_score, total_cases, duration_ms, estimated_cost_cents, created_at)
        `)
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .order('sort_order', { referencedTable: 'test_cases', ascending: true })
        .order('created_at', { referencedTable: 'test_runs', ascending: false })
        .limit(10, { referencedTable: 'test_runs' })
        .single();

    if (!suite) {
        notFound();
    }

    // Fetch all available personas
    const { data: personas } = await supabase
        .from('test_personas')
        .select('*')
        .or(`is_preset.eq.true,agency_id.eq.${user.agency.id}`)
        .order('is_preset', { ascending: false })
        .order('name', { ascending: true });

    return (
        <div className="flex flex-col h-full">
            <Header
                title={suite.name}
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-4xl mx-auto">
                    <TestSuiteEditor suite={suite} personas={personas || []} />
                </div>
            </div>
        </div>
    );
}
