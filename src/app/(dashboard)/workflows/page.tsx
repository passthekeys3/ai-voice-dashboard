import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { WorkflowsList } from '@/components/dashboard/WorkflowsList';
import { Button } from '@/components/ui/button';
import { Plus, History } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Workflows' };

export default async function WorkflowsPage() {
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Fetch workflows
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*, agent:agents(name)')
        .eq('agency_id', user.agency.id)
        .order('created_at', { ascending: false });

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Workflows"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Workflows</h2>
                        <p className="text-muted-foreground">
                            Automate actions after each call
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/workflows/history">
                                <History className="mr-2 h-4 w-4" />
                                View History
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/workflows/new">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Workflow
                            </Link>
                        </Button>
                    </div>
                </div>

                <WorkflowsList
                    workflows={workflows || []}
                />
            </div>
        </div>
    );
}
