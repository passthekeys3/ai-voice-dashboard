import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { ExperimentEditor } from '@/components/dashboard/ExperimentEditor';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'New Experiment' };

export default async function NewExperimentPage() {
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Fetch agents for the dropdown
    const { data: agents } = await supabase
        .from('agents')
        .select('id, name')
        .eq('agency_id', user.agency.id)
        .order('name');

    return (
        <div className="flex flex-col h-full">
            <Header
                title="New Experiment"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-6 space-y-6 overflow-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/experiments">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">New Experiment</h2>
                        <p className="text-muted-foreground">
                            Test different prompts to optimize performance
                        </p>
                    </div>
                </div>

                <ExperimentEditor agents={agents || []} />
            </div>
        </div>
    );
}
