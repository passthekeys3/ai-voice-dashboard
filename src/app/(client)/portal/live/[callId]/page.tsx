import type { Metadata } from 'next';

import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { LiveTranscript } from '@/components/dashboard/LiveTranscript';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Live Call' };

export default async function ClientLiveCallPage({
    params,
    searchParams,
}: {
    params: Promise<{ callId: string }>;
    searchParams: Promise<{ provider?: string }>;
}) {
    const { callId } = await params;
    // External IDs from providers can be any format (not necessarily UUIDs)
    if (!callId || callId.length > 200) {
        notFound();
    }
    const { provider } = await searchParams;
    const user = await requireAuth();

    // Client users must have a client assignment
    if (!user.client) {
        notFound();
    }

    const supabase = await createClient();

    // Get agents scoped to this client
    const { data: agentIds } = await supabase
        .from('agents')
        .select('id')
        .eq('agency_id', user.agency.id)
        .eq('client_id', user.client.id);

    if (!agentIds || agentIds.length === 0) {
        notFound();
    }

    // Validate the call belongs to one of the client's agents
    const { data: call } = await supabase
        .from('calls')
        .select('id')
        .eq('external_id', callId)
        .in('agent_id', agentIds.map(a => a.id))
        .single();

    if (!call) {
        notFound();
    }

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Live Call"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/portal/live" aria-label="Back to live monitoring">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Live Transcript</h2>
                        <p className="text-muted-foreground">
                            Watching call in real-time
                        </p>
                    </div>
                </div>

                <LiveTranscript callId={callId} provider={provider || 'retell'} basePath="/portal" />
            </div>
        </div>
    );
}
