'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { UserPlus, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface InviteClientUserDialogProps {
    clientId: string;
    clientName: string;
}

export function InviteClientUserDialog({ clientId, clientName }: InviteClientUserDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<'client_admin' | 'client_member'>('client_admin');

    const resetForm = () => {
        setEmail('');
        setFullName('');
        setRole('client_admin');
        setError(null);
    };

    const handleInvite = async () => {
        if (!email.trim()) {
            setError('Please enter an email address');
            return;
        }
        if (!fullName.trim()) {
            setError('Please enter the user\'s name');
            return;
        }

        setSending(true);
        setError(null);

        try {
            const response = await fetch(`/api/clients/${clientId}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    full_name: fullName.trim(),
                    role,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'Failed to invite user');
            }

            setOpen(false);
            resetForm();
            toast.success(`Invitation sent to ${email}`);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) {
                resetForm();
            }
        }}>
            <DialogTrigger asChild>
                <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite User
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Invite User to {clientName}
                    </DialogTitle>
                    <DialogDescription>
                        Send an invitation to give someone access to this client&apos;s dashboard.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Full Name */}
                    <div className="space-y-2">
                        <Label htmlFor="invite-name">Full Name *</Label>
                        <Input
                            id="invite-name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="e.g., John Smith"
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label htmlFor="invite-email">Email Address *</Label>
                        <Input
                            id="invite-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g., john@acmeplumbing.com"
                        />
                    </div>

                    {/* Role */}
                    <div className="space-y-2">
                        <Label htmlFor="invite-role">Role</Label>
                        <Select value={role} onValueChange={(v) => setRole(v as 'client_admin' | 'client_member')}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="client_admin">
                                    <div>
                                        <span className="font-medium">Admin</span>
                                        <p className="text-xs text-muted-foreground">Full access to client dashboard</p>
                                    </div>
                                </SelectItem>
                                <SelectItem value="client_member">
                                    <div>
                                        <span className="font-medium">Member</span>
                                        <p className="text-xs text-muted-foreground">View-only access</p>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
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
                    <Button onClick={handleInvite} disabled={sending}>
                        {sending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Invite
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
