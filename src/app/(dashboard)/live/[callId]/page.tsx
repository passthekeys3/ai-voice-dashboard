import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { Header } from '@/components/dashboard/Header';
import { LiveTranscript } from '@/components/dashboard/LiveTranscript';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Live Call' };

export default async function LiveCallPage({
    params,
}: {
    params: Promise<{ callId: string }>;
}) {
    const { callId } = await params;
    const user = await requireAgencyAdmin();

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Live Call"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-6 space-y-6 overflow-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/live">
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

                <LiveTranscript callId={callId} />
            </div>
        </div>
    );
}
