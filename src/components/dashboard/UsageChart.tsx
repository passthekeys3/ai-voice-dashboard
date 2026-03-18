'use client';

import { useId } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UsageChartProps {
    data: { date: string; count: number }[];
}

// Neutral chart colors — avoids the "AI color palette" anti-pattern.
// Uses a single hue (slate-blue) instead of gradient rainbow.
const CHART_COLORS = {
    light: {
        stroke: '#3b82f6',    // blue-500 (single solid color)
        fill: '#3b82f6',      // blue-500
        grid: '#f1f5f9',      // slate-100
        axis: '#94a3b8',      // slate-400
    },
    dark: {
        stroke: '#60a5fa',    // blue-400
        fill: '#60a5fa',      // blue-400
        grid: '#1e293b',      // slate-800
        axis: '#64748b',      // slate-500
    },
};

// Custom tooltip component with enhanced styling
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold">
                    {payload[0].value} <span className="font-normal text-muted-foreground">calls</span>
                </p>
            </div>
        );
    }
    return null;
}

export function UsageChart({ data }: UsageChartProps) {
    const { resolvedTheme } = useTheme();
    const colors = resolvedTheme === 'dark' ? CHART_COLORS.dark : CHART_COLORS.light;
    const id = useId();
    const fillGradientId = `fillGradient-${id}`;

    // Format dates for display
    const formattedData = data.map((item) => ({
        ...item,
        displayDate: new Date(item.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        }),
    }));

    return (
        <Card className="md:col-span-4 min-w-0">
            <CardHeader>
                <CardTitle>Call Volume</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden">
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={colors.fill} stopOpacity={0.15} />
                                    <stop offset="100%" stopColor={colors.fill} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                stroke={colors.grid}
                                strokeOpacity={1}
                                vertical={false}
                                horizontalCoordinatesGenerator={undefined}
                            />
                            <XAxis
                                dataKey="displayDate"
                                stroke={colors.axis}
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: colors.axis }}
                                dy={10}
                            />
                            <YAxis
                                stroke={colors.axis}
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: colors.axis }}
                                tickFormatter={(value) => `${value}`}
                                dx={-10}
                            />
                            <Tooltip
                                content={<CustomTooltip />}
                                cursor={{
                                    stroke: colors.axis,
                                    strokeWidth: 1,
                                    strokeDasharray: '4 4',
                                    strokeOpacity: 0.5,
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke={colors.stroke}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill={`url(#${fillGradientId})`}
                                animationDuration={300}
                                animationEasing="ease-out"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
