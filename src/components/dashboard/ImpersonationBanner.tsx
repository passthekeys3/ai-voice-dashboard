'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

interface ImpersonationBannerProps {
    agencyName: string;
}

export function ImpersonationBanner({ agencyName }: ImpersonationBannerProps) {
    const router = useRouter();
    const [exiting, setExiting] = useState(false);

    const handleExit = async () => {
        setExiting(true);
        try {
            const res = await fetch('/api/admin/impersonate', { method: 'DELETE' });
            if (!res.ok) {
                alert('Failed to exit impersonation. Please try again.');
                setExiting(false);
                return;
            }
            router.push('/admin/accounts');
            router.refresh();
        } catch {
            alert('Failed to exit impersonation. Please try again.');
            setExiting(false);
        }
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950">
            <div className="flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                <span>
                    Admin Mode: Managing <strong>{agencyName}</strong>
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 h-7 border-amber-700 bg-amber-600/20 text-amber-950 hover:bg-amber-600/40"
                    onClick={handleExit}
                    disabled={exiting}
                >
                    {exiting ? 'Exiting...' : 'Exit'}
                </Button>
            </div>
        </div>
    );
}
