import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { NewWorkflowFlow } from '@/components/dashboard/NewWorkflowFlow';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'New Workflow' };

export default async function NewWorkflowPage() {
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Fetch agents for the dropdown
    const { data: agents } = await supabase
        .from('agents')
        .select('id, name')
        .eq('agency_id', user.agency.id)
        .order('name');

    const context = {
        hasGHL: !!user.agency.integrations?.ghl?.enabled,
        hasHubSpot: !!user.agency.integrations?.hubspot?.enabled,
        hasGCal: !!user.agency.integrations?.google_calendar?.enabled,
        hasCalendly: !!user.agency.integrations?.calendly?.enabled,
        hasSlack: !!user.agency.integrations?.slack?.enabled,
    };

    return (
        <div className="flex flex-col h-full">
            <Header
                title="New Workflow"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-6 space-y-6 overflow-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/workflows">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Create Workflow</h2>
                        <p className="text-muted-foreground">
                            Set up automated actions for your calls
                        </p>
                    </div>
                </div>

                <NewWorkflowFlow
                    agents={agents || []}
                    context={context}
                />
            </div>
        </div>
    );
}
