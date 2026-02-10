'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

const DATE_RANGES = [
    { label: '7 Days', value: '7' },
    { label: '30 Days', value: '30' },
    { label: '90 Days', value: '90' },
    { label: 'All Time', value: 'all' },
];

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

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">Time Range:</span>
            {DATE_RANGES.map((range) => (
                <Button
                    key={range.value}
                    variant={currentDays === range.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleDaysChange(range.value)}
                >
                    {range.label}
                </Button>
            ))}
        </div>
    );
}
