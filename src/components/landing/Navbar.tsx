'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/Logo';
import { SOLUTION_LINKS, solutionHref } from '@/lib/marketing/solution-links';

// Section links point at the homepage so they work from every page;
// on the homepage itself they smooth-scroll instead.
const navLinks = [
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Blog', href: '/blog' },
    { label: 'Docs', href: 'https://docs.buildvoiceai.com', external: true },
];

const linkClass = 'text-sm text-muted-foreground hover:text-foreground transition-colors';

export function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        const hash = href.split('#')[1];
        const el = hash ? document.getElementById(hash) : null;
        if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth' });
        }
        setMobileOpen(false);
    };

    const renderLink = (link: (typeof navLinks)[number], className: string) => (
        <a
            key={link.href}
            href={link.href}
            onClick={(e) => !link.external && handleNavClick(e, link.href)}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={className}
        >
            {link.label}
        </a>
    );

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                scrolled || mobileOpen
                    ? 'bg-background/80 backdrop-blur-lg backdrop-saturate-150 border-b border-border/50 shadow-sm shadow-black/[0.03]'
                    : 'bg-transparent border-b border-transparent'
            }`}
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="flex h-16 items-center justify-between">
                    <Link href="/" className="flex items-center">
                        <Logo variant="full" size="sm" />
                    </Link>

                    <div className="hidden lg:flex items-center gap-6">
                        {navLinks.slice(0, 2).map((link) => renderLink(link, linkClass))}

                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger className={`${linkClass} inline-flex items-center gap-1 outline-none`}>
                                Solutions
                                <ChevronDown className="h-3.5 w-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-52">
                                {SOLUTION_LINKS.map((solution) => (
                                    <DropdownMenuItem key={solution.slug} asChild>
                                        <Link href={solutionHref(solution.slug)}>{solution.label}</Link>
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/solutions">All solutions</Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {navLinks.slice(2).map((link) => renderLink(link, linkClass))}

                        <div className="w-px h-4 bg-border" />

                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/login">Log in</Link>
                        </Button>
                        <Button size="sm" className="rounded-full active:scale-[0.98] transition-[transform,background-color,box-shadow] duration-200" asChild>
                            <Link href="/signup">Get started</Link>
                        </Button>
                    </div>

                    <button
                        className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle menu"
                        aria-expanded={mobileOpen}
                    >
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>

                {mobileOpen && (
                    <div className="lg:hidden pb-6 border-t border-border/50 mt-3 pt-6 max-h-[calc(100dvh-5rem)] overflow-y-auto">
                        <div className="flex flex-col gap-3">
                            {navLinks.slice(0, 2).map((link) => renderLink(link, `${linkClass} py-1`))}
                            <div className="py-1">
                                <Link href="/solutions" onClick={() => setMobileOpen(false)} className={linkClass}>
                                    Solutions
                                </Link>
                                <div className="mt-2 ml-3 flex flex-col gap-2 border-l border-border pl-3">
                                    {SOLUTION_LINKS.map((solution) => (
                                        <Link
                                            key={solution.slug}
                                            href={solutionHref(solution.slug)}
                                            onClick={() => setMobileOpen(false)}
                                            className={linkClass}
                                        >
                                            {solution.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                            {navLinks.slice(2).map((link) => renderLink(link, `${linkClass} py-1`))}
                            <div className="flex gap-2 mt-2">
                                <Button variant="ghost" size="sm" asChild className="flex-1">
                                    <Link href="/login">Log in</Link>
                                </Button>
                                <Button size="sm" className="flex-1 rounded-full active:scale-[0.98]" asChild>
                                    <Link href="/signup">Get started</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
