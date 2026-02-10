'use client';

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UsageChartProps {
    data: { date: string; count: number }[];
}

// Custom tooltip component with enhanced styling
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-xl border border-border/50 bg-background/95 backdrop-blur-sm p-3 shadow-lg dark:bg-background/90">
                <div className="grid gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                        {label}
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                            {payload[0].value}
                        </span>
                        <span className="text-xs text-muted-foreground">calls</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
}

export function UsageChart({ data }: UsageChartProps) {
    // Format dates for display
    const formattedData = data.map((item) => ({
        ...item,
        displayDate: new Date(item.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        }),
    }));

    return (
        <Card className="md:col-span-4">
            <CardHeader>
                <CardTitle>Call Volume</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                {/* Purple to blue gradient for the area fill */}
                                <linearGradient id="colorCallsGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="hsl(var(--chart-1, 262 83% 58%))" stopOpacity={0.4} />
                                    <stop offset="50%" stopColor="hsl(var(--chart-2, 221 83% 53%))" stopOpacity={0.2} />
                                    <stop offset="100%" stopColor="hsl(var(--chart-2, 221 83% 53%))" stopOpacity={0.05} />
                                </linearGradient>
                                {/* Stroke gradient for the line */}
                                <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="hsl(var(--chart-1, 262 83% 58%))" />
                                    <stop offset="100%" stopColor="hsl(var(--chart-2, 221 83% 53%))" />
                                </linearGradient>
                            </defs>
                            {/* Subtle grid with theme-aware colors */}
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="hsl(var(--border))"
                                strokeOpacity={0.3}
                                vertical={false}
                            />
                            <XAxis
                                dataKey="displayDate"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                dy={10}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                tickFormatter={(value) => `${value}`}
                                dx={-10}
                            />
                            <Tooltip
                                content={<CustomTooltip />}
                                cursor={{
                                    stroke: 'hsl(var(--muted-foreground))',
                                    strokeWidth: 1,
                                    strokeDasharray: '4 4',
                                    strokeOpacity: 0.5,
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="url(#strokeGradient)"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#colorCallsGradient)"
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
