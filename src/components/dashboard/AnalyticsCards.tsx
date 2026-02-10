'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Clock, DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsCardsProps {
    totalCalls: number;
    totalMinutes: number;
    totalCost: number;
    successRate: number;
    // Optional previous period data for trend indicators
    previousPeriod?: {
        totalCalls?: number;
        totalMinutes?: number;
        totalCost?: number;
        successRate?: number;
    };
    loading?: boolean;
    showCosts?: boolean;
}

// Card theme configurations with colors and borders
const cardThemes = {
    blue: {
        border: 'border-l-4 border-l-blue-500',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        iconColor: 'text-blue-600 dark:text-blue-400',
    },
    green: {
        border: 'border-l-4 border-l-green-500',
        iconBg: 'bg-green-100 dark:bg-green-900/30',
        iconColor: 'text-green-600 dark:text-green-400',
    },
    amber: {
        border: 'border-l-4 border-l-amber-500',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        iconColor: 'text-amber-600 dark:text-amber-400',
    },
    purple: {
        border: 'border-l-4 border-l-purple-500',
        iconBg: 'bg-purple-100 dark:bg-purple-900/30',
        iconColor: 'text-purple-600 dark:text-purple-400',
    },
} as const;

type CardTheme = keyof typeof cardThemes;

function calculateTrend(current: number, previous: number | undefined): { percent: number; direction: 'up' | 'down' | 'neutral' } {
    if (previous === undefined || previous === 0) {
        return { percent: 0, direction: 'neutral' };
    }
    const percent = ((current - previous) / previous) * 100;
    if (Math.abs(percent) < 0.5) {
        return { percent: 0, direction: 'neutral' };
    }
    return {
        percent: Math.abs(percent),
        direction: percent > 0 ? 'up' : 'down',
    };
}

function TrendIndicator({
    current,
    previous,
    invertColors = false
}: {
    current: number;
    previous: number | undefined;
    invertColors?: boolean;  // For cost, down is good
}) {
    const trend = calculateTrend(current, previous);

    if (trend.direction === 'neutral') {
        return (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Minus className="h-3 w-3" />
                <span>No change</span>
            </div>
        );
    }

    const isPositive = invertColors
        ? trend.direction === 'down'
        : trend.direction === 'up';

    return (
        <div className={cn(
            "flex items-center gap-1 text-xs font-semibold",
            isPositive
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
        )}>
            {trend.direction === 'up' ? (
                <TrendingUp className="h-3 w-3 animate-bounce-subtle" />
            ) : (
                <TrendingDown className="h-3 w-3 animate-bounce-subtle" />
            )}
            <span className="tracking-wide">{trend.percent.toFixed(1)}%</span>
        </div>
    );
}

function CardSkeleton({ index = 0 }: { index?: number }) {
    return (
        <Card
            className="border-l-4 border-l-muted animate-fade-up"
            style={{ animationDelay: `${index * 75}ms`, animationFillMode: 'both' }}
        >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
            </CardHeader>
            <CardContent className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-16" />
            </CardContent>
        </Card>
    );
}

export function AnalyticsCards({
    totalCalls,
    totalMinutes,
    totalCost,
    successRate,
    previousPeriod,
    loading = false,
    showCosts = true,
}: AnalyticsCardsProps) {
    const allCards = [
        {
            title: 'Total Calls',
            value: totalCalls.toLocaleString(),
            current: totalCalls,
            previous: previousPeriod?.totalCalls,
            icon: Phone,
            theme: 'blue' as CardTheme,
            invertTrend: false,
        },
        {
            title: 'Total Minutes',
            value: totalMinutes.toFixed(1),
            current: totalMinutes,
            previous: previousPeriod?.totalMinutes,
            icon: Clock,
            theme: 'green' as CardTheme,
            invertTrend: false,
        },
        {
            title: 'Total Cost',
            value: `$${totalCost.toFixed(2)}`,
            current: totalCost,
            previous: previousPeriod?.totalCost,
            icon: DollarSign,
            theme: 'amber' as CardTheme,
            invertTrend: true, // Lower cost is better
            isCostCard: true,
        },
        {
            title: 'Success Rate',
            value: `${successRate.toFixed(1)}%`,
            current: successRate,
            previous: previousPeriod?.successRate,
            icon: TrendingUp,
            theme: 'purple' as CardTheme,
            invertTrend: false,
        },
    ];

    // Filter out cost card if showCosts is false
    const cards = showCosts ? allCards : allCards.filter(card => !card.isCostCard);

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <CardSkeleton key={i} index={i - 1} />
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, index) => {
                const theme = cardThemes[card.theme];
                return (
                    <Card
                        key={card.title}
                        className={cn(
                            // Base styles
                            "overflow-hidden",
                            // Colored left border accent
                            theme.border,
                            // Enhanced hover interactions
                            "transition-all duration-200 ease-out",
                            "hover:-translate-y-1 hover:shadow-lg",
                            // Entrance animation with stagger
                            "animate-fade-up"
                        )}
                        style={{
                            animationDelay: `${index * 75}ms`,
                            animationFillMode: 'both',
                        }}
                    >
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {card.title}
                            </CardTitle>
                            <div className={cn(
                                "p-2 rounded-lg transition-colors duration-200",
                                theme.iconBg
                            )}>
                                <card.icon className={cn("h-4 w-4", theme.iconColor)} />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <div className="text-2xl font-bold tracking-tight">{card.value}</div>
                            {previousPeriod && (
                                <TrendIndicator
                                    current={card.current}
                                    previous={card.previous}
                                    invertColors={card.invertTrend}
                                />
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

// Export skeleton for use elsewhere
export function AnalyticsCardsSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
                <CardSkeleton key={i} index={i - 1} />
            ))}
        </div>
    );
}
