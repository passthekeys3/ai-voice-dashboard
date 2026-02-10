import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

// ============================================================================
// StatCardSkeleton - Individual stat card skeleton
// Matches the structure of cards in AnalyticsCards.tsx
// ============================================================================

export function StatCardSkeleton() {
    return (
        <Card>
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

// ============================================================================
// PageHeaderSkeleton - Skeleton for page title and description
// ============================================================================

interface PageHeaderSkeletonProps {
    showDescription?: boolean;
    showActions?: boolean;
}

export function PageHeaderSkeleton({
    showDescription = true,
    showActions = false
}: PageHeaderSkeletonProps) {
    return (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                {showDescription && <Skeleton className="h-4 w-72" />}
            </div>
            {showActions && (
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-10" />
                </div>
            )}
        </div>
    );
}

// ============================================================================
// TableSkeleton - Skeleton for data tables
// Matches the structure of CallsTable.tsx
// ============================================================================

interface TableSkeletonProps {
    rows?: number;
    columns?: number;
    showHeader?: boolean;
}

export function TableSkeleton({
    rows = 5,
    columns = 7,
    showHeader = true
}: TableSkeletonProps) {
    return (
        <div className="rounded-md border">
            <Table>
                {showHeader && (
                    <TableHeader>
                        <TableRow>
                            {Array.from({ length: columns }).map((_, i) => (
                                <TableHead key={i}>
                                    <Skeleton className="h-4 w-20" />
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                )}
                <TableBody>
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <TableRow key={rowIndex}>
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <TableCell key={colIndex}>
                                    {colIndex === 0 ? (
                                        // First column - agent name (wider)
                                        <Skeleton className="h-4 w-32" />
                                    ) : colIndex === 1 ? (
                                        // Second column - status badge
                                        <Skeleton className="h-6 w-20 rounded-full" />
                                    ) : colIndex === columns - 1 ? (
                                        // Last column - actions
                                        <div className="flex items-center justify-end gap-2">
                                            <Skeleton className="h-8 w-8 rounded-md" />
                                            <Skeleton className="h-8 w-8 rounded-md" />
                                        </div>
                                    ) : (
                                        // Other columns
                                        <Skeleton className="h-4 w-16" />
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

// ============================================================================
// CardGridSkeleton - Skeleton for agent/client card grids
// Matches the structure of AgentCard.tsx
// ============================================================================

interface CardGridSkeletonProps {
    count?: number;
    columns?: 1 | 2 | 3 | 4;
}

export function CardGridSkeleton({
    count = 6,
    columns = 3
}: CardGridSkeletonProps) {
    const gridCols = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    };

    return (
        <div className={`grid gap-4 ${gridCols[columns]}`}>
            {Array.from({ length: count }).map((_, i) => (
                <AgentCardSkeleton key={i} />
            ))}
        </div>
    );
}

// Individual agent card skeleton (internal but exported for flexibility)
export function AgentCardSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-3">
                    {/* Icon placeholder */}
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="space-y-2">
                        {/* Agent name */}
                        <Skeleton className="h-5 w-32" />
                        {/* Client name */}
                        <Skeleton className="h-3 w-20" />
                    </div>
                </div>
                {/* Provider badge */}
                <Skeleton className="h-5 w-14 rounded-full" />
            </CardHeader>
            <CardContent>
                {/* Phone number */}
                <div className="flex items-center gap-2 mb-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                </div>
                {/* Status and actions row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-2 w-2 rounded-full" />
                        <Skeleton className="h-3 w-12" />
                    </div>
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-24 rounded-md" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================================
// ChartSkeleton - Skeleton for the usage chart area
// Matches the structure of UsageChart.tsx
// ============================================================================

interface ChartSkeletonProps {
    height?: number;
    showTitle?: boolean;
}

export function ChartSkeleton({
    height = 300,
    showTitle = true
}: ChartSkeletonProps) {
    return (
        <Card className="col-span-4">
            {showTitle && (
                <CardHeader>
                    <Skeleton className="h-6 w-28" />
                </CardHeader>
            )}
            <CardContent>
                <div className="relative" style={{ height }}>
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-3 w-6" />
                        ))}
                    </div>

                    {/* Chart area with bars */}
                    <div className="absolute left-10 right-0 top-0 bottom-8 flex items-end gap-2">
                        {[45, 72, 38, 85, 52, 68, 41, 79, 55, 63, 48, 76].map((barHeight, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center">
                                <Skeleton
                                    className="w-full rounded-t-sm"
                                    style={{
                                        height: `${barHeight}%`,
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    {/* X-axis labels */}
                    <div className="absolute left-10 right-0 bottom-0 h-6 flex justify-between">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-3 w-10" />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Composite Skeletons - Common dashboard patterns
// ============================================================================

// Stats row skeleton (4 stat cards)
export function StatsRowSkeleton({ count = 4 }: { count?: number }) {
    const gridCols = count === 4
        ? 'md:grid-cols-2 lg:grid-cols-4'
        : count === 3
            ? 'md:grid-cols-3'
            : 'md:grid-cols-2';

    return (
        <div className={`grid gap-4 ${gridCols}`}>
            {Array.from({ length: count }).map((_, i) => (
                <StatCardSkeleton key={i} />
            ))}
        </div>
    );
}

// Full dashboard page skeleton
export function DashboardPageSkeleton() {
    return (
        <div className="space-y-6">
            <PageHeaderSkeleton />
            <StatsRowSkeleton count={4} />
            <div className="grid gap-4 md:grid-cols-7">
                <div className="col-span-4">
                    <ChartSkeleton />
                </div>
                <div className="col-span-3">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-32" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="flex-1 space-y-1">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                    <Skeleton className="h-4 w-12" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
            <TableSkeleton rows={5} columns={7} />
        </div>
    );
}
