'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Bot, Settings, Phone, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import type { Agent } from '@/types';

interface AgentCardProps {
    agent: Agent & { clients?: { name: string } | null };
    phoneNumber?: string;
    showDelete?: boolean;
    /** Base path for configure link (default: "/agents") — use "/portal/agents" in client portal */
    configBasePath?: string;
}

const providerIconStyles: Record<string, string> = {
    retell: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    vapi: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    bland: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

function formatPhoneNumber(number: string) {
    if (number.startsWith('+1') && number.length === 12) {
        const digits = number.slice(2);
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return number;
}

export function AgentCard({ agent, phoneNumber, showDelete = true, configBasePath = '/agents' }: AgentCardProps) {
    const router = useRouter();
    const [deleting, setDeleting] = useState(false);
    const [deleteFromProvider, setDeleteFromProvider] = useState(false);

    const providerStyles: Record<string, string> = {
        retell: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        vapi: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        bland: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    };

    const providerDisplayName = agent.provider === 'bland' ? 'Bland.ai' : agent.provider.charAt(0).toUpperCase() + agent.provider.slice(1);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const url = deleteFromProvider
                ? `/api/agents/${agent.id}?deleteFromProvider=true`
                : `/api/agents/${agent.id}`;
            const response = await fetch(url, {
                method: 'DELETE',
            });
            if (response.ok) {
                toast.success('Agent deleted', {
                    description: deleteFromProvider
                        ? `"${agent.name}" has been removed from your dashboard and ${providerDisplayName}`
                        : `"${agent.name}" has been removed from your dashboard. It still exists in ${providerDisplayName}.`,
                });
                router.refresh();
            } else {
                const data = await response.json().catch(() => ({}));
                toast.error('Failed to delete agent', {
                    description: data.error || 'An unexpected error occurred',
                });
            }
        } catch (error) {
            console.error('Error deleting agent:', error);
            toast.error('Failed to delete agent', {
                description: 'Please check your connection and try again',
            });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Card className={cn(
            'relative overflow-hidden transition-all duration-200',
            'hover:shadow-md',
        )}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        'p-2 rounded-lg transition-colors duration-200',
                        providerIconStyles[agent.provider]
                    )}>
                        <Bot className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {agent.clients?.name || 'Unassigned'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {agent.config?.key_source === 'platform' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700">
                            Platform
                        </Badge>
                    )}
                    <Badge className={providerStyles[agent.provider] || providerStyles.retell}>
                        {agent.provider === 'bland' ? 'Bland.ai' : agent.provider}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                {phoneNumber && (
                    <div className="flex items-center gap-2 mb-3 text-sm">
                        <Phone className="h-4 w-4 text-green-600" />
                        <span className="font-mono">{formatPhoneNumber(phoneNumber)}</span>
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <div className={cn(
                        'flex items-center gap-2 px-2 py-1 rounded-full text-sm transition-colors',
                        agent.is_active
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : 'bg-slate-100 dark:bg-slate-800'
                    )}>
                        <span
                            className={cn(
                                'h-2 w-2 rounded-full',
                                agent.is_active
                                    ? 'bg-green-500 animate-pulse'
                                    : 'bg-gray-400 dark:bg-gray-500'
                            )}
                        />
                        <span className={cn(
                            'text-sm font-medium',
                            agent.is_active
                                ? 'text-green-700 dark:text-green-400'
                                : 'text-muted-foreground'
                        )}>
                            {agent.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {showDelete && (
                            <AlertDialog onOpenChange={(open: boolean) => { if (!open) setDeleteFromProvider(false); }}>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={deleting}
                                        aria-label={`Delete agent ${agent.name}`}
                                        className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        {deleting ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        )}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to delete &quot;{agent.name}&quot;? This will remove the agent from your dashboard.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="flex items-center gap-3 py-2">
                                        <Checkbox
                                            id={`delete-provider-${agent.id}`}
                                            checked={deleteFromProvider}
                                            onCheckedChange={(checked) => setDeleteFromProvider(checked === true)}
                                        />
                                        <label
                                            htmlFor={`delete-provider-${agent.id}`}
                                            className="text-sm text-muted-foreground cursor-pointer select-none"
                                        >
                                            Also delete from {providerDisplayName}
                                        </label>
                                    </div>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDelete}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className={cn(
                                'transition-colors',
                                agent.provider === 'retell'
                                    ? 'hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20'
                                    : agent.provider === 'bland'
                                        ? 'hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20'
                                        : 'hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20'
                            )}
                        >
                            <Link href={`${configBasePath}/${agent.id}`}>
                                <Settings className="h-4 w-4 mr-2" />
                                Configure
                            </Link>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
