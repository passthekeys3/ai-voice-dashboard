'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, CalendarClock } from 'lucide-react';

interface ScheduleCallButtonProps {
    agents: { id: string; name: string }[];
}

export function ScheduleCallButton({ agents }: ScheduleCallButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [agentId, setAgentId] = useState('');
    const [toNumber, setToNumber] = useState('');
    const [contactName, setContactName] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [notes, setNotes] = useState('');

    const resetForm = () => {
        setAgentId('');
        setToNumber('');
        setContactName('');
        setScheduledDate('');
        setScheduledTime('');
        setNotes('');
        setError(null);
    };

    const handleSubmit = async () => {
        if (!agentId) {
            setError('Please select an agent');
            return;
        }
        if (!toNumber) {
            setError('Please enter a phone number');
            return;
        }
        if (!scheduledDate || !scheduledTime) {
            setError('Please select date and time');
            return;
        }

        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
        if (scheduledAt < new Date()) {
            setError('Scheduled time must be in the future');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const response = await fetch('/api/scheduled-calls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_id: agentId,
                    to_number: toNumber,
                    contact_name: contactName || undefined,
                    scheduled_at: scheduledAt.toISOString(),
                    notes: notes || undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to schedule call');
            }

            setOpen(false);
            resetForm();
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setSaving(false);
        }
    };

    // Set default date/time to 1 hour from now
    const setDefaultDateTime = () => {
        const date = new Date();
        date.setHours(date.getHours() + 1);
        date.setMinutes(0);
        setScheduledDate(date.toISOString().split('T')[0]);
        setScheduledTime(date.toTimeString().slice(0, 5));
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen: boolean) => {
            setOpen(isOpen);
            if (isOpen) setDefaultDateTime();
            else resetForm();
        }}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Schedule Call
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarClock className="h-5 w-5" />
                        Schedule an Outbound Call
                    </DialogTitle>
                    <DialogDescription>
                        The call will be automatically initiated at the scheduled time.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Agent *</Label>
                        <Select value={agentId} onValueChange={setAgentId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select an agent" />
                            </SelectTrigger>
                            <SelectContent>
                                {agents.map((agent) => (
                                    <SelectItem key={agent.id} value={agent.id}>
                                        {agent.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-4 grid-cols-2">
                        <div className="space-y-2">
                            <Label>Phone Number *</Label>
                            <Input
                                type="tel"
                                value={toNumber}
                                onChange={(e) => setToNumber(e.target.value)}
                                placeholder="+1 555 123 4567"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Contact Name</Label>
                            <Input
                                value={contactName}
                                onChange={(e) => setContactName(e.target.value)}
                                placeholder="John Smith"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 grid-cols-2">
                        <div className="space-y-2">
                            <Label>Date *</Label>
                            <Input
                                type="date"
                                value={scheduledDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Time *</Label>
                            <Input
                                type="time"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Notes (Optional)</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Context for this call..."
                            rows={2}
                        />
                        <p className="text-xs text-muted-foreground">
                            Notes will be included in the call metadata
                        </p>
                    </div>

                    {error && (
                        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Scheduling...
                            </>
                        ) : (
                            'Schedule Call'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
