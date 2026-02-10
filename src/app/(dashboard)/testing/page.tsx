import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { TestSuitesList } from '@/components/dashboard/TestSuitesList';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Testing' };

export default async function TestingPage() {
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Fetch test suites with case count and latest run
    const { data: suites } = await supabase
        .from('test_suites')
        .select(`
            *,
            agent:agents(name),
            test_cases(id),
            latest_run:test_runs(id, status, passed_cases, failed_cases, errored_cases, avg_score, total_cases, created_at)
        `)
        .eq('agency_id', user.agency.id)
        .order('created_at', { ascending: false })
        .order('created_at', { referencedTable: 'test_runs', ascending: false })
        .limit(1, { referencedTable: 'test_runs' });

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Testing"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Agent Testing</h2>
                        <p className="text-muted-foreground">
                            Validate agent behavior with AI-powered test simulations before deploying
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/testing/new">
                            <Plus className="mr-2 h-4 w-4" />
                            New Test Suite
                        </Link>
                    </Button>
                </div>

                <TestSuitesList suites={suites || []} />
            </div>
        </div>
    );
}
