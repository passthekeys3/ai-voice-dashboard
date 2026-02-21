import type { Metadata } from 'next';

import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getUserPermissions } from '@/lib/permissions';
import { Header } from '@/components/dashboard/Header';
import { CallPlayer } from '@/components/dashboard/CallPlayer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Call Details' };

export default async function CallDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await requireAuth();
    const supabase = await createClient();
    const isAdmin = isAgencyAdmin(user);
    const permissions = getUserPermissions(user);
    const showCosts = isAdmin || permissions.show_costs;

    const { data: call, error } = await supabase
        .from('calls')
        .select('*, agents(name, provider, agency_id)')
        .eq('id', id)
        .single();

    if (error || !call) {
        notFound();
    }

    // Verify agency access
    if (call.agents?.agency_id !== user.agency.id) {
        notFound();
    }

    // Client users can only view their calls
    if (!isAdmin && call.client_id !== user.client?.id) {
        notFound();
    }

    const statusStyles: Record<string, string> = {
        completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        queued: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Call Details"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/calls">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <Phone className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">Call Details</h2>
                            <p className="text-muted-foreground">
                                {call.agents?.name || 'Unknown Agent'}
                            </p>
                        </div>
                    </div>
                    <Badge className={statusStyles[call.status] || statusStyles.queued}>
                        {call.status.replace('_', ' ')}
                    </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Call Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Direction</p>
                                    <p className="font-medium capitalize">{call.direction}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Duration</p>
                                    <p className="font-medium">{formatDuration(call.duration_seconds)}</p>
                                </div>
                                {showCosts && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Cost</p>
                                        <p className="font-medium">${(call.cost_cents / 100).toFixed(2)}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-muted-foreground">Provider</p>
                                    <p className="font-medium capitalize">{call.provider}</p>
                                </div>
                                {call.from_number && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">From</p>
                                        <p className="font-medium">{call.from_number}</p>
                                    </div>
                                )}
                                {call.to_number && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">To</p>
                                        <p className="font-medium">{call.to_number}</p>
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Started</p>
                                <p className="font-medium">
                                    {new Date(call.started_at).toLocaleString()}
                                </p>
                            </div>
                            {call.sentiment && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Sentiment</p>
                                    <p className="font-medium capitalize">{call.sentiment}</p>
                                </div>
                            )}
                            {call.call_score != null && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Call Score</p>
                                    <p className={`font-medium ${
                                        call.call_score >= 70 ? 'text-green-600 dark:text-green-400'
                                        : call.call_score >= 40 ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}>
                                        {call.call_score}/100
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <CallPlayer
                        audioUrl={call.audio_url}
                        transcript={call.transcript}
                        summary={call.summary}
                    />
                </div>
            </div>
        </div>
    );
}
