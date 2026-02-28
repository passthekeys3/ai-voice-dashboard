'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from './Skeletons';

const UsageChart = dynamic(
    () => import('./UsageChart').then(mod => ({ default: mod.UsageChart })),
    {
        ssr: false,
        loading: () => <ChartSkeleton />,
    }
);

export { UsageChart };
