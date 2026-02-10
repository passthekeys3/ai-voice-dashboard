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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    PhoneIcon,
    Bot,
    Trash2,
    Loader2,
    PhoneIncoming,
    PhoneOutgoing,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PhoneNumber } from '@/types';

interface PhoneNumbersListProps {
    phoneNumbers: PhoneNumber[];
    agents: { id: string; name: string }[];
}

type AssignmentType = 'inbound' | 'outbound';

export function PhoneNumbersList({ phoneNumbers, agents }: PhoneNumbersListProps) {
    const router = useRouter();
    const [assigning, setAssigning] = useState<{ phoneId: string; type: AssignmentType } | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const handleAssign = async (phoneId: string, agentId: string | null, type: AssignmentType) => {
        setAssigning({ phoneId, type });
        try {
            const response = await fetch(`/api/phone-numbers/${phoneId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [type === 'inbound' ? 'inbound_agent_id' : 'outbound_agent_id']: agentId,
                }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to assign agent');
            }
            toast.success('Agent assigned successfully');
            router.refresh();
        } catch (err) {
            console.error('Failed to assign number:', err);
            toast.error('Failed to assign agent', {
                description: err instanceof Error ? err.message : 'Please try again',
            });
        } finally {
            setAssigning(null);
        }
    };

    const handleDelete = async (phoneId: string) => {
        if (!confirm('Are you sure you want to release this phone number? This cannot be undone.')) {
            return;
        }

        setDeleting(phoneId);
        try {
            const response = await fetch(`/api/phone-numbers/${phoneId}`, { method: 'DELETE' });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to release number');
            }
            toast.success('Phone number released successfully');
            router.refresh();
        } catch (err) {
            console.error('Failed to release number:', err);
            toast.error('Failed to release phone number', {
                description: err instanceof Error ? err.message : 'Please try again',
            });
        } finally {
            setDeleting(null);
        }
    };

    const formatPhoneNumber = (number: string) => {
        // Format +12345678901 as (234) 567-8901
        if (number.startsWith('+1') && number.length === 12) {
            const digits = number.slice(2);
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        return number;
    };

    if (phoneNumbers.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <PhoneIcon className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No phone numbers yet</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                        Purchase phone numbers to enable inbound calls to your AI agents.
                        Numbers are charged at approximately $2/month.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Your Phone Numbers</CardTitle>
                <CardDescription>
                    {phoneNumbers.length} number{phoneNumbers.length !== 1 ? 's' : ''} active
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Phone Number</TableHead>
                            <TableHead>Inbound Agent</TableHead>
                            <TableHead>Outbound Agent</TableHead>
                            <TableHead>Monthly Cost</TableHead>
                            <TableHead>Purchased</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {phoneNumbers.map((phone) => (
                            <TableRow key={phone.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-mono font-medium">
                                            {formatPhoneNumber(phone.phone_number)}
                                        </span>
                                    </div>
                                    {phone.nickname && (
                                        <div className="text-sm text-muted-foreground">
                                            {phone.nickname}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <PhoneIncoming className="h-3.5 w-3.5 text-blue-500" />
                                        <Select
                                            value={phone.inbound_agent_id || 'unassigned'}
                                            onValueChange={(value) =>
                                                handleAssign(phone.id, value === 'unassigned' ? null : value, 'inbound')
                                            }
                                            disabled={assigning?.phoneId === phone.id && assigning?.type === 'inbound'}
                                        >
                                            <SelectTrigger className="w-[160px]">
                                                {assigning?.phoneId === phone.id && assigning?.type === 'inbound' ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <SelectValue placeholder="Select agent" />
                                                )}
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">
                                                    <span className="text-muted-foreground">Unassigned</span>
                                                </SelectItem>
                                                {agents.map((agent) => (
                                                    <SelectItem key={agent.id} value={agent.id}>
                                                        <div className="flex items-center gap-2">
                                                            <Bot className="h-3 w-3" />
                                                            {agent.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <PhoneOutgoing className="h-3.5 w-3.5 text-violet-500" />
                                        <Select
                                            value={phone.outbound_agent_id || 'unassigned'}
                                            onValueChange={(value) =>
                                                handleAssign(phone.id, value === 'unassigned' ? null : value, 'outbound')
                                            }
                                            disabled={assigning?.phoneId === phone.id && assigning?.type === 'outbound'}
                                        >
                                            <SelectTrigger className="w-[160px]">
                                                {assigning?.phoneId === phone.id && assigning?.type === 'outbound' ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <SelectValue placeholder="Select agent" />
                                                )}
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">
                                                    <span className="text-muted-foreground">Unassigned</span>
                                                </SelectItem>
                                                {agents.map((agent) => (
                                                    <SelectItem key={agent.id} value={agent.id}>
                                                        <div className="flex items-center gap-2">
                                                            <Bot className="h-3 w-3" />
                                                            {agent.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        ${(phone.monthly_cost_cents / 100).toFixed(2)}/mo
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {new Date(phone.purchased_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(phone.id)}
                                        disabled={deleting === phone.id}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        aria-label={`Delete phone number ${formatPhoneNumber(phone.phone_number)}`}
                                    >
                                        {deleting === phone.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
