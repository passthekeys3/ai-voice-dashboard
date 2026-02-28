'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

export function DeleteAccountSection() {
    const [confirmation, setConfirmation] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [open, setOpen] = useState(false);

    const isConfirmed = confirmation === 'DELETE';

    const handleDelete = async () => {
        if (!isConfirmed) return;

        setDeleting(true);
        try {
            const response = await fetch('/api/account', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmation: 'DELETE' }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || 'Failed to delete account');
            }

            toast.success('Account deleted');
            // Session is now invalid — redirect to login
            window.location.href = '/login';
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'An error occurred');
            setDeleting(false);
        }
    };

    return (
        <Card className="border-red-200 dark:border-red-900/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                </CardTitle>
                <CardDescription>
                    Permanently delete your account and all associated data. This action cannot be undone.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <AlertDialog open={open} onOpenChange={(isOpen: boolean) => {
                    setOpen(isOpen);
                    if (!isOpen) {
                        setConfirmation('');
                        setDeleting(false);
                    }
                }}>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                            Delete Account
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                    <p>
                                        This will permanently delete your entire agency account including:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li>All agents, phone numbers, and configurations</li>
                                        <li>All call recordings, transcripts, and analytics</li>
                                        <li>All client sub-accounts and their data</li>
                                        <li>All workflows, experiments, and scheduled calls</li>
                                        <li>Your Stripe subscription (canceled immediately)</li>
                                    </ul>
                                    <p className="font-medium text-foreground">
                                        Type <span className="font-mono text-red-600 dark:text-red-400">DELETE</span> to confirm:
                                    </p>
                                    <Input
                                        value={confirmation}
                                        onChange={(e) => setConfirmation(e.target.value)}
                                        placeholder="Type DELETE to confirm"
                                        className="font-mono"
                                        autoComplete="off"
                                        disabled={deleting}
                                    />
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                disabled={!isConfirmed || deleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {deleting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete Account'
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
