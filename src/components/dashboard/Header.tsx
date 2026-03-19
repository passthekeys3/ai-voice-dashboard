'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { RefreshCw, Sun, Moon, Settings, LogOut, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';

interface HeaderProps {
    title?: string;
    userName: string;
    userEmail: string;
    userAvatar?: string;
    onSync?: () => Promise<void>;
    actions?: React.ReactNode;
}

export function Header({ title = 'Dashboard', userName, userEmail, userAvatar, onSync, actions }: HeaderProps) {
    const [syncing, setSyncing] = useState(false);
    const { theme, setTheme } = useTheme();

    const handleSync = async () => {
        if (onSync) {
            setSyncing(true);
            try {
                await onSync();
            } finally {
                setSyncing(false);
            }
        }
    };

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const initials = userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <header className="flex h-16 flex-shrink-0 items-center justify-between bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6">
            <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold">{title}</h1>
                {actions}
            </div>

            <div className="flex items-center gap-2">
                {onSync && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={syncing}
                        className="h-9 min-w-9 px-2 sm:px-3 transition-all duration-200 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-sm"
                        aria-label={syncing ? 'Syncing' : 'Sync data'}
                    >
                        <RefreshCw className={`h-4 w-4 sm:mr-2 transition-transform duration-200 ${syncing ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Data'}</span>
                    </Button>
                )}

                {/* Docs link */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Documentation"
                    asChild
                >
                    <a href="https://docs.buildvoiceai.com" target="_blank" rel="noopener noreferrer">
                        <HelpCircle className="h-4 w-4" />
                    </a>
                </Button>

                {/* Dark mode toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="h-9 w-9 transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Toggle theme"
                >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-full transition-all duration-200 hover:ring-2 hover:ring-slate-200 dark:hover:ring-slate-700 hover:ring-offset-2 dark:hover:ring-offset-slate-950">
                            <Avatar className="h-10 w-10 transition-transform duration-200 hover:scale-105">
                                <AvatarImage src={userAvatar} alt={userName} />
                                <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48 sm:w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium">{userName}</p>
                                <p className="text-xs text-muted-foreground">{userEmail}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/settings" className="flex items-center cursor-pointer">
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <a href="https://docs.buildvoiceai.com" target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer">
                                <BookOpen className="mr-2 h-4 w-4" />
                                Documentation
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-red-600 dark:text-red-400 cursor-pointer"
                            onClick={handleLogout}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
