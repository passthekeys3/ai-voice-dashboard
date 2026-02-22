'use client';

import { useState, useCallback } from 'react';
import { PhoneNumbersList } from './PhoneNumbersList';
import { SyncPhoneNumbersButton } from './SyncPhoneNumbersButton';
import { BuyPhoneNumberButton } from './BuyPhoneNumberButton';
import type { PhoneNumber } from '@/types';

interface PhoneNumbersPageClientProps {
    initialPhoneNumbers: PhoneNumber[];
    agents: { id: string; name: string }[];
}

export function PhoneNumbersPageClient({ initialPhoneNumbers, agents }: PhoneNumbersPageClientProps) {
    const [phoneNumbers, setPhoneNumbers] = useState(initialPhoneNumbers);

    const refetch = useCallback(async () => {
        try {
            const res = await fetch('/api/phone-numbers');
            if (res.ok) {
                const data = await res.json();
                setPhoneNumbers(data.data || []);
            }
        } catch {
            // Silently fail — the toast from the action will still show
        }
    }, []);

    return (
        <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Phone Numbers</h2>
                    <p className="text-muted-foreground">
                        Purchase and manage phone numbers for your AI agents
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <SyncPhoneNumbersButton onSyncComplete={refetch} />
                    <BuyPhoneNumberButton agents={agents} onPurchaseComplete={refetch} />
                </div>
            </div>

            <PhoneNumbersList
                phoneNumbers={phoneNumbers}
                agents={agents}
                onDataChange={refetch}
            />
        </>
    );
}
