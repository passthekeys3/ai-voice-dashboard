import type { Metadata } from 'next';

import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { LiveTranscript } from '@/components/dashboard/LiveTranscript';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Live Call' };

export default async function LiveCallPage({
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
    const isAdmin = isAgencyAdmin(user);

    // Build agent query scoped to agency — further scoped to client for non-admins
    const supabase = await createClient();
    let agentsQuery = supabase
        .from('agents')
        .select('id')
        .eq('agency_id', user.agency.id);

    if (!isAdmin) {
        if (user.client) {
            agentsQuery = agentsQuery.eq('client_id', user.client.id);
        } else {
            notFound();
        }
    }

    const { data: agentIds } = await agentsQuery;

    if (!agentIds || agentIds.length === 0) {
        notFound();
    }

    // Try to validate the call belongs to one of the user's agents.
    // Skip notFound() if the call isn't in the DB yet — active calls
    // from the provider API may not have a DB record until the webhook fires.
    // The LiveTranscript component handles the provider API fallback and
    // performs its own ownership check via /api/calls/[id]/live.
    const { data: call } = await supabase
        .from('calls')
        .select('id')
        .eq('external_id', callId)
        .in('agent_id', agentIds.map(a => a.id))
        .single();

    // If call exists in DB but doesn't match user's agents, deny access
    // If call doesn't exist in DB at all, allow through (provider API fallback)
    if (!call) {
        const { count } = await supabase
            .from('calls')
            .select('id', { count: 'exact', head: true })
            .eq('external_id', callId);

        // Call exists but belongs to someone else — deny
        if (count && count > 0) {
            notFound();
        }
        // Call not in DB at all — let LiveTranscript handle via provider API
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
                        <Link href="/live" aria-label="Back to live monitoring">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Live Transcript</h2>
                    </div>
                </div>

                <LiveTranscript callId={callId} provider={provider || 'retell'} />
            </div>
        </div>
    );
}
