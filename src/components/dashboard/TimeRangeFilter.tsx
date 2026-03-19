'use client';

import { Button } from '@/components/ui/button';

const DATE_RANGES = [
    { label: '7 Days', value: '7' },
    { label: '30 Days', value: '30' },
    { label: '90 Days', value: '90' },
    { label: 'All Time', value: 'all' },
];

interface TimeRangeFilterProps {
    value: string;
    onChange: (value: string) => void;
}

export function TimeRangeFilter({ value, onChange }: TimeRangeFilterProps) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {DATE_RANGES.map((range) => (
                <Button
                    key={range.value}
                    variant={value === range.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => onChange(range.value)}
                >
                    {range.label}
                </Button>
            ))}
        </div>
    );
}
