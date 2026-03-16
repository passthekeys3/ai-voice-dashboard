'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserCircle, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: string;
}

interface ClientUsersListProps {
    clientId: string;
    clientName: string;
    users: UserProfile[];
}

export function ClientUsersList({ clientId, clientName, users }: ClientUsersListProps) {
    const router = useRouter();
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
    const [confirmUser, setConfirmUser] = useState<UserProfile | null>(null);

    const handleDeleteUser = async (userId: string) => {
        setDeletingUserId(userId);
        try {
            const response = await fetch(`/api/clients/${clientId}/users/${userId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || 'Failed to remove user');
            }

            toast.success('User removed successfully');
            setConfirmUser(null);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to remove user');
        } finally {
            setDeletingUserId(null);
        }
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Users with Access</CardTitle>
                </CardHeader>
                <CardContent>
                    {users.length > 0 ? (
                        <div className="space-y-3">
                            {users.map((profile) => (
                                <div
                                    key={profile.id}
                                    className="flex items-center justify-between gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <UserCircle className="h-8 w-8 text-slate-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{profile.full_name}</p>
                                            <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge variant="outline">
                                            {profile.role === 'client_admin' ? 'Admin' : 'Member'}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setConfirmUser(profile)}
                                            disabled={!!deletingUserId}
                                            title="Remove user"
                                        >
                                            {deletingUserId === profile.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                            <p className="text-muted-foreground">No users have access yet</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Invite users to give them access to this client&apos;s dashboard
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Remove User Confirmation */}
            <AlertDialog open={!!confirmUser} onOpenChange={(open: boolean) => { if (!open) setConfirmUser(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove User</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove <strong>{confirmUser?.full_name}</strong> ({confirmUser?.email}) from {clientName}?
                            This will permanently delete their account and they will lose all access.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={!!deletingUserId}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e: React.MouseEvent) => {
                                e.preventDefault();
                                if (confirmUser) handleDeleteUser(confirmUser.id);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={!!deletingUserId}
                        >
                            {deletingUserId ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                'Remove User'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

/* ── Delete Client Button ──────────────────────────────────────── */

interface DeleteClientButtonProps {
    clientId: string;
    clientName: string;
    userCount: number;
}

export function DeleteClientButton({ clientId, clientName, userCount }: DeleteClientButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const response = await fetch(`/api/clients/${clientId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || 'Failed to delete client');
            }

            toast.success(`${clientName} has been deleted`);
            setOpen(false);
            router.push('/clients');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete client');
            setDeleting(false);
        }
    };

    return (
        <>
            <Card className="border-red-200 dark:border-red-900">
                <CardHeader>
                    <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Delete this client</p>
                            <p className="text-sm text-muted-foreground">
                                Permanently delete {clientName}, all call history, usage data, and {userCount} user account{userCount !== 1 ? 's' : ''}.
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={() => setOpen(true)}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Client
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={open} onOpenChange={(isOpen: boolean) => { if (!deleting) setOpen(isOpen); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {clientName}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this client along with:
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 px-2">
                        <li>All call history and recordings</li>
                        <li>All usage and billing data</li>
                        <li>{userCount} user account{userCount !== 1 ? 's' : ''} (permanently deleted)</li>
                        <li>All integration overrides</li>
                    </ul>
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-2">
                        This action cannot be undone. Agents assigned to this client will be unassigned but not deleted.
                    </p>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e: React.MouseEvent) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleting}
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Client'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
