'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { TimeRangeFilter } from './TimeRangeFilter';

export function AnalyticsFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentDays = searchParams.get('days') || '30';

    const handleDaysChange = (days: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (days === '30') {
            params.delete('days');
        } else {
            params.set('days', days);
        }
        router.push(`/analytics?${params.toString()}`);
    };

    return <TimeRangeFilter value={currentDays} onChange={handleDaysChange} />;
}
