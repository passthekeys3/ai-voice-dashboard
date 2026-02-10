'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    CalendarClock,
    Phone,
    Bot,
    XCircle,
    CheckCircle,
    AlertCircle,
    Clock,
    Loader2,
} from 'lucide-react';
import type { ScheduledCall } from '@/types';

interface ScheduledCallsListProps {
    upcomingCalls: ScheduledCall[];
    pastCalls: ScheduledCall[];
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    pending: { label: 'Pending', icon: Clock, color: 'text-yellow-500' },
    in_progress: { label: 'In Progress', icon: Loader2, color: 'text-blue-500' },
    completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
    failed: { label: 'Failed', icon: AlertCircle, color: 'text-red-500' },
    cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-gray-500' },
};

function formatDateTime(dateString: string) {
    const date = new Date(dateString);
    return {
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
}

function formatTimeUntil(dateString: string) {
    const now = new Date();
    const target = new Date(dateString);
    const diff = target.getTime() - now.getTime();

    if (diff < 0) return 'Overdue';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `in ${days}d ${hours % 24}h`;
    if (hours > 0) return `in ${hours}h ${minutes % 60}m`;
    return `in ${minutes}m`;
}

export function ScheduledCallsList({ upcomingCalls, pastCalls }: ScheduledCallsListProps) {
    const router = useRouter();
    const [cancelling, setCancelling] = useState<string | null>(null);

    const handleCancel = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this scheduled call?')) return;

        setCancelling(id);
        try {
            await fetch(`/api/scheduled-calls/${id}`, { method: 'DELETE' });
            router.refresh();
        } catch (err) {
            console.error('Failed to cancel call:', err);
        } finally {
            setCancelling(null);
        }
    };

    const CallsTable = ({ calls, showActions = false }: { calls: ScheduledCall[]; showActions?: boolean }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Scheduled For</TableHead>
                    <TableHead>Status</TableHead>
                    {showActions && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {calls.map((call) => {
                    const status = statusConfig[call.status] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    const dt = formatDateTime(call.scheduled_at);

                    return (
                        <TableRow key={call.id}>
                            <TableCell>
                                <div>
                                    <div className="font-medium">
                                        {call.contact_name || call.to_number}
                                    </div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {call.to_number}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Bot className="h-4 w-4 text-muted-foreground" />
                                    {call.agent?.name || 'Unknown'}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div>
                                    <div className="font-medium">{dt.date}</div>
                                    <div className="text-sm text-muted-foreground">{dt.time}</div>
                                    {call.status === 'pending' && (
                                        <Badge variant="outline" className="mt-1 text-xs">
                                            {formatTimeUntil(call.scheduled_at)}
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className={`flex items-center gap-2 ${status.color}`}>
                                    <StatusIcon className={`h-4 w-4 ${call.status === 'in_progress' ? 'animate-spin' : ''}`} />
                                    <span>{status.label}</span>
                                </div>
                                {call.error_message && (
                                    <div className="text-xs text-red-500 mt-1 truncate max-w-[200px]">
                                        {call.error_message}
                                    </div>
                                )}
                            </TableCell>
                            {showActions && (
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCancel(call.id)}
                                        disabled={cancelling === call.id || call.status !== 'pending'}
                                    >
                                        {cancelling === call.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                <XCircle className="h-4 w-4 mr-1" />
                                                Cancel
                                            </>
                                        )}
                                    </Button>
                                </TableCell>
                            )}
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );

    if (upcomingCalls.length === 0 && pastCalls.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <CalendarClock className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No scheduled calls yet</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                        Schedule outbound calls for follow-ups, reminders, or appointments.
                        Calls will be automatically initiated at the scheduled time.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Tabs defaultValue="upcoming" className="space-y-4">
            <TabsList>
                <TabsTrigger value="upcoming">
                    Upcoming ({upcomingCalls.length})
                </TabsTrigger>
                <TabsTrigger value="past">
                    Past ({pastCalls.length})
                </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Calls</CardTitle>
                        <CardDescription>
                            Calls scheduled for the future
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {upcomingCalls.length > 0 ? (
                            <CallsTable calls={upcomingCalls} showActions />
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No upcoming calls scheduled
                            </p>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="past">
                <Card>
                    <CardHeader>
                        <CardTitle>Past Calls</CardTitle>
                        <CardDescription>
                            Completed, failed, or cancelled calls
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pastCalls.length > 0 ? (
                            <CallsTable calls={pastCalls} />
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No past scheduled calls
                            </p>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
