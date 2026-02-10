'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Bot,
    Phone,
    BarChart3,
    Users,
    Settings,
    LogOut,
    CreditCard,
    Zap,
    FlaskConical,
    TestTube2,
    Lightbulb,
    CalendarClock,
    Radio,
    PhoneForwarded,
    Menu,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetClose,
} from '@/components/ui/sheet';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

interface Branding {
    logo_url?: string;
    primary_color?: string;
    accent_color?: string;
    company_name?: string;
}

interface ClientPermissions {
    show_costs?: boolean;
    show_transcripts?: boolean;
    show_analytics?: boolean;
    allow_playback?: boolean;
}

interface SidebarProps {
    isAgencyAdmin: boolean;
    agencyName: string;
    branding?: Branding;
    permissions?: ClientPermissions;
}

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Agents', href: '/agents', icon: Bot },
    { name: 'Calls', href: '/calls', icon: Phone },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Billing', href: '/billing', icon: CreditCard },
];

const adminNavigation = [
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'Numbers', href: '/phone-numbers', icon: PhoneForwarded },
    { name: 'Live', href: '/live', icon: Radio },
    { name: 'Scheduled', href: '/scheduled-calls', icon: CalendarClock },
    { name: 'Insights', href: '/insights', icon: Lightbulb },
    { name: 'Experiments', href: '/experiments', icon: FlaskConical },
    { name: 'Testing', href: '/testing', icon: TestTube2 },
    { name: 'Workflows', href: '/workflows', icon: Zap },
    { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarContentProps {
    isAgencyAdmin: boolean;
    displayName: string;
    branding?: Branding;
    sidebarColor: string;
    onNavigate?: () => void;
    permissions?: ClientPermissions;
}

function SidebarContent({
    isAgencyAdmin,
    displayName,
    branding,
    sidebarColor,
    onNavigate,
    permissions,
}: SidebarContentProps) {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    // Filter navigation based on permissions for non-admin users
    const filteredNavigation = isAgencyAdmin
        ? navigation
        : navigation.filter((item) => {
            // Hide Analytics if permission is disabled
            if (item.href === '/analytics' && permissions?.show_analytics === false) {
                return false;
            }
            // Hide Billing/costs if permission is disabled
            if (item.href === '/billing' && permissions?.show_costs === false) {
                return false;
            }
            return true;
        });

    const allNavigation = isAgencyAdmin
        ? [...filteredNavigation, ...adminNavigation]
        : filteredNavigation;

    return (
        <div
            className="flex h-full w-full flex-col text-white relative overflow-hidden"
            style={{ backgroundColor: sidebarColor }}
        >
            {/* Gradient overlay for texture */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/10 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
            {/* Logo */}
            <div className="relative z-10 flex h-16 items-center px-6 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
                {branding?.logo_url ? (
                    <Image
                        src={branding.logo_url}
                        alt={displayName}
                        width={180}
                        height={32}
                        className="max-w-[180px] object-contain drop-shadow-sm"
                        unoptimized
                    />
                ) : (
                    <span className="text-xl font-bold truncate bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent drop-shadow-sm">{displayName}</span>
                )}
            </div>

            {/* Navigation */}
            <nav className="relative z-10 flex-1 space-y-1 px-3 py-4 overflow-y-auto">
                {allNavigation.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            onClick={onNavigate}
                            className={cn(
                                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                                isActive
                                    ? 'bg-white/15 text-white shadow-sm'
                                    : 'text-white/70 hover:bg-white/10 hover:text-white hover:translate-x-0.5'
                            )}
                        >
                            {/* Active indicator */}
                            <span
                                className={cn(
                                    'absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-all duration-200',
                                    isActive
                                        ? 'h-6 bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                                        : 'h-0 bg-white/50 group-hover:h-4'
                                )}
                            />
                            <item.icon className={cn(
                                'h-5 w-5 transition-all duration-200',
                                isActive
                                    ? 'text-white'
                                    : 'text-white/60 group-hover:text-white group-hover:scale-110'
                            )} />
                            <span className="transition-colors duration-200">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <div className="relative z-10 border-t border-white/10 p-3 bg-gradient-to-t from-black/10 to-transparent">
                <Button
                    variant="ghost"
                    className="group w-full justify-start text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                    onClick={handleLogout}
                >
                    <LogOut className="mr-3 h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                    Log out
                </Button>
            </div>
        </div>
    );
}

export function Sidebar({ isAgencyAdmin, agencyName, branding, permissions }: SidebarProps) {
    const [mobileOpen, setMobileOpen] = useState(false);

    const displayName = branding?.company_name || agencyName;
    const sidebarColor = branding?.primary_color || '#0f172a';

    return (
        <>
            {/* Mobile Header */}
            <div
                className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-4 px-4 border-b"
                style={{ backgroundColor: sidebarColor }}
            >
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open menu"
                >
                    <Menu className="h-6 w-6" />
                </Button>
                <div className="flex items-center">
                    {branding?.logo_url ? (
                        <Image
                            src={branding.logo_url}
                            alt={displayName}
                            width={140}
                            height={28}
                            className="max-w-[140px] object-contain"
                            unoptimized
                        />
                    ) : (
                        <span className="text-lg font-bold text-white truncate">
                            {displayName}
                        </span>
                    )}
                </div>
            </div>

            {/* Mobile Sheet Sidebar */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent
                    side="left"
                    className="p-0 w-64 border-0 [&>button]:hidden"
                    style={{ backgroundColor: sidebarColor }}
                >
                    <VisuallyHidden.Root>
                        <SheetTitle>Navigation Menu</SheetTitle>
                    </VisuallyHidden.Root>
                    {/* Custom close button for dark background */}
                    <SheetClose className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/20 z-10">
                        <X className="h-5 w-5 text-white" />
                        <span className="sr-only">Close</span>
                    </SheetClose>
                    <SidebarContent
                        isAgencyAdmin={isAgencyAdmin}
                        displayName={displayName}
                        branding={branding}
                        sidebarColor={sidebarColor}
                        onNavigate={() => setMobileOpen(false)}
                        permissions={permissions}
                    />
                </SheetContent>
            </Sheet>

            {/* Desktop Sidebar */}
            <div className="hidden md:block w-64 flex-shrink-0">
                <SidebarContent
                    isAgencyAdmin={isAgencyAdmin}
                    displayName={displayName}
                    branding={branding}
                    sidebarColor={sidebarColor}
                    permissions={permissions}
                />
            </div>
        </>
    );
}
