'use client';

import { useEffect, useState, useCallback } from 'react';
import { CallsTable } from '@/components/dashboard/CallsTable';
import { SearchInput } from '@/components/ui/search-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, RefreshCw, CalendarDays } from 'lucide-react';
import type { Call } from '@/types';

interface CallsPageClientProps {
    initialCalls: (Call & { agents: { name: string; provider: string } })[];
    showCosts: boolean;
    showTranscripts: boolean;
    allowPlayback: boolean;
}

interface PaginationMeta {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
}

const ITEMS_PER_PAGE = 25;

export function CallsPageClient({
    initialCalls,
    showCosts,
    showTranscripts,
    allowPlayback,
}: CallsPageClientProps) {
    const [calls, setCalls] = useState<(Call & { agents: { name: string; provider: string } })[]>(initialCalls);
    const [pagination, setPagination] = useState<PaginationMeta>({
        total: initialCalls.length >= ITEMS_PER_PAGE ? ITEMS_PER_PAGE + 1 : initialCalls.length,
        page: 1,
        perPage: ITEMS_PER_PAGE,
        totalPages: 1,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [hasLoadedFromApi, setHasLoadedFromApi] = useState(false);

    const fetchCalls = useCallback(async (page: number, search?: string, from?: string, to?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const offset = (page - 1) * ITEMS_PER_PAGE;
            const params = new URLSearchParams({
                limit: ITEMS_PER_PAGE.toString(),
                offset: offset.toString(),
            });
            if (search) {
                params.set('search', search);
            }
            if (from) {
                params.set('date_from', from);
            }
            if (to) {
                params.set('date_to', to);
            }

            const res = await fetch(`/api/calls?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch calls');

            const json = await res.json();
            setCalls(json.data || []);
            setPagination(json.meta || { total: 0, page: 1, perPage: ITEMS_PER_PAGE, totalPages: 1 });
            setHasLoadedFromApi(true);
        } catch (err) {
            console.error('Error fetching calls:', err);
            setError('Failed to load calls. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch first page from API to get accurate pagination metadata
    useEffect(() => {
        fetchCalls(1);
    }, [fetchCalls]);

    // Fetch on page change, search, or date filter change
    useEffect(() => {
        if (!hasLoadedFromApi) return;
        fetchCalls(currentPage, searchQuery, dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, searchQuery, dateFrom, dateTo]);

    const handleSearch = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };

    const handleDateFrom = (value: string) => {
        setDateFrom(value);
        setCurrentPage(1);
    };

    const handleDateTo = (value: string) => {
        setDateTo(value);
        setCurrentPage(1);
    };

    const goToPage = (page: number) => {
        if (page < 1 || page > pagination.totalPages) return;
        setCurrentPage(page);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <CardTitle>All Calls</CardTitle>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => handleDateFrom(e.target.value)}
                                className="w-[140px] h-9 text-sm"
                                aria-label="From date"
                            />
                            <span className="text-muted-foreground text-sm">to</span>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => handleDateTo(e.target.value)}
                                className="w-[140px] h-9 text-sm"
                                aria-label="To date"
                            />
                        </div>
                        <SearchInput
                            placeholder="Search by phone, agent, status, or transcript..."
                            value={searchQuery}
                            onChange={handleSearch}
                            className="w-full sm:w-64"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {error ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-red-50 dark:bg-red-950 p-3 mb-3">
                            <AlertCircle className="h-6 w-6 text-red-500" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{error}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchCalls(currentPage, searchQuery, dateFrom, dateTo)}
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                        </Button>
                    </div>
                ) : (
                <CallsTable
                    calls={calls}
                    isLoading={isLoading}
                    showCosts={showCosts}
                    showTranscripts={showTranscripts}
                    allowPlayback={allowPlayback}
                />
                )}

                {/* Pagination controls */}
                {pagination.totalPages > 1 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t mt-4">
                        <p className="text-sm text-muted-foreground text-center sm:text-left">
                            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, pagination.total)} of {pagination.total} calls
                        </p>
                        <div className="flex items-center justify-center sm:justify-start gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 sm:h-8 sm:w-8"
                                onClick={() => goToPage(1)}
                                disabled={currentPage === 1}
                                aria-label="First page"
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 sm:h-8 sm:w-8"
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm px-3 font-medium">
                                Page {currentPage} of {pagination.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 sm:h-8 sm:w-8"
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage === pagination.totalPages}
                                aria-label="Next page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 sm:h-8 sm:w-8"
                                onClick={() => goToPage(pagination.totalPages)}
                                disabled={currentPage === pagination.totalPages}
                                aria-label="Last page"
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
