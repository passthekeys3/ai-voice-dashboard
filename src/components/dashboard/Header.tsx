'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Search } from 'lucide-react';
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
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';

interface SearchResult {
    type: 'agent' | 'client' | 'call';
    id: string;
    title: string;
    subtitle?: string;
    href: string;
}

interface HeaderProps {
    title?: string;
    userName: string;
    userEmail: string;
    userAvatar?: string;
    onSync?: () => Promise<void>;
}

export function Header({ userName, userEmail, userAvatar, onSync }: HeaderProps) {
    const [syncing, setSyncing] = useState(false);
    const { theme, setTheme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

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

    // CMD+K shortcut
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === 'Escape') {
                setShowResults(false);
                inputRef.current?.blur();
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Debounced search
    const search = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const supabase = createClient();
            const results: SearchResult[] = [];

            // Search agents
            const { data: agents } = await supabase
                .from('agents')
                .select('id, name, provider')
                .ilike('name', `%${query}%`)
                .limit(5);

            if (agents) {
                results.push(...agents.map(a => ({
                    type: 'agent' as const,
                    id: a.id,
                    title: a.name,
                    subtitle: a.provider,
                    href: `/agents/${a.id}`,
                })));
            }

            // Search clients
            const { data: clients } = await supabase
                .from('clients')
                .select('id, name, email')
                .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
                .limit(5);

            if (clients) {
                results.push(...clients.map(c => ({
                    type: 'client' as const,
                    id: c.id,
                    title: c.name,
                    subtitle: c.email,
                    href: `/clients/${c.id}`,
                })));
            }

            // Search calls by external ID or phone
            const { data: calls } = await supabase
                .from('calls')
                .select('id, external_id, from_number, to_number, agents(name)')
                .or(`external_id.ilike.%${query}%,from_number.ilike.%${query}%,to_number.ilike.%${query}%`)
                .order('started_at', { ascending: false })
                .limit(5);

            if (calls) {
                results.push(...calls.map(c => ({
                    type: 'call' as const,
                    id: c.id,
                    title: c.external_id || c.id,
                    subtitle: (c.agents as unknown as { name: string } | null)?.name || c.from_number || undefined,
                    href: `/calls/${c.id}`,
                })));
            }

            setSearchResults(results);
        } finally {
            setIsSearching(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => search(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery, search]);

    const handleResultClick = (href: string) => {
        setShowResults(false);
        setSearchQuery('');
        router.push(href);
    };

    const typeLabel = (type: string) => {
        switch (type) {
            case 'agent': return 'Agent';
            case 'client': return 'Client';
            case 'call': return 'Call';
            default: return type;
        }
    };

    const initials = userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <header className="flex h-14 flex-shrink-0 items-center justify-between bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6">
            {/* Search bar */}
            <div ref={searchRef} className="relative flex-1 max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search agents, clients, calls..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowResults(true);
                        }}
                        onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                        className="h-9 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-9 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600 focus:border-transparent transition-colors"
                    />
                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 text-[10px] font-medium text-muted-foreground">
                        ⌘K
                    </kbd>
                </div>

                {/* Search results dropdown */}
                {showResults && searchQuery.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-lg z-50 max-h-80 overflow-y-auto">
                        {isSearching ? (
                            <div className="px-4 py-3 text-sm text-muted-foreground">Searching...</div>
                        ) : searchResults.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-muted-foreground">No results found</div>
                        ) : (
                            searchResults.map((result) => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onClick={() => handleResultClick(result.href)}
                                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center justify-between gap-3 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">{result.title}</div>
                                        {result.subtitle && (
                                            <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-medium text-muted-foreground bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex-shrink-0">
                                        {typeLabel(result.type)}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 ml-4">
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

                {/* Help menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            aria-label="Help"
                        >
                            <HelpCircle className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                            <Link href="/onboarding" className="flex items-center gap-2">
                                <RefreshCw className="h-3.5 w-3.5" />
                                Setup Guide
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <a href="https://docs.buildvoiceai.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <BookOpen className="h-3.5 w-3.5" />
                                Documentation
                            </a>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

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
                        <Button variant="ghost" className="relative h-9 w-9 rounded-full transition-all duration-200 hover:ring-2 hover:ring-slate-200 dark:hover:ring-slate-700 hover:ring-offset-2 dark:hover:ring-offset-slate-950">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={userAvatar} alt={userName} />
                                <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs">
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
