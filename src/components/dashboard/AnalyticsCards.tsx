'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Clock, DollarSign, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';

interface AnalyticsCardsProps {
    totalCalls: number;
    totalMinutes: number;
    totalCost: number;
    successRate: number;
    previousPeriod?: {
        totalCalls?: number;
        totalMinutes?: number;
        totalCost?: number;
        successRate?: number;
    };
    links?: {
        totalCalls?: string;
        totalMinutes?: string;
        totalCost?: string;
        successRate?: string;
    };
    loading?: boolean;
    showCosts?: boolean;
}

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
    invertColors?: boolean;
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
            "flex items-center gap-1 text-xs font-medium",
            isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400"
        )}>
            {trend.direction === 'up' ? (
                <TrendingUp className="h-3 w-3" />
            ) : (
                <TrendingDown className="h-3 w-3" />
            )}
            <span>{trend.percent.toFixed(1)}%</span>
        </div>
    );
}

function CardSkeleton({ index = 0 }: { index?: number }) {
    return (
        <Card
            className="animate-fade-up"
            style={{ animationDelay: `${index * 75}ms`, animationFillMode: 'both' }}
        >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-5 rounded" />
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
    links,
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
            invertTrend: false,
            href: links?.totalCalls,
        },
        {
            title: 'Total Duration',
            value: formatDuration(totalMinutes * 60),
            current: totalMinutes,
            previous: previousPeriod?.totalMinutes,
            icon: Clock,
            invertTrend: false,
            href: links?.totalMinutes,
        },
        {
            title: 'Total Cost',
            value: `$${totalCost.toFixed(2)}`,
            current: totalCost,
            previous: previousPeriod?.totalCost,
            icon: DollarSign,
            invertTrend: true,
            isCostCard: true,
            href: links?.totalCost,
        },
        {
            title: 'Success Rate',
            value: `${successRate.toFixed(1)}%`,
            current: successRate,
            previous: previousPeriod?.successRate,
            icon: Activity,
            invertTrend: false,
            href: links?.successRate,
        },
    ];

    const cards = showCosts ? allCards : allCards.filter(card => !card.isCostCard);

    if (loading) {
        return (
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <CardSkeleton key={i} index={i - 1} />
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, index) => {
                const cardElement = (
                    <Card
                        key={card.title}
                        className={cn(
                            "overflow-hidden transition-all duration-200",
                            "hover:shadow-md",
                            "animate-fade-up",
                            card.href && "cursor-pointer"
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
                            <card.icon className="h-4 w-4 text-muted-foreground/60" />
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <div className="text-2xl font-semibold tracking-tight">{card.value}</div>
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

                if (card.href) {
                    return (
                        <Link key={card.title} href={card.href} className="block">
                            {cardElement}
                        </Link>
                    );
                }

                return cardElement;
            })}
        </div>
    );
}

export function AnalyticsCardsSkeleton() {
    return (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
                <CardSkeleton key={i} index={i - 1} />
            ))}
        </div>
    );
}
