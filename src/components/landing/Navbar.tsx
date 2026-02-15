'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
];

export function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (href.startsWith('#')) {
            e.preventDefault();
            const el = document.querySelector(href);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                setMobileOpen(false);
            }
        }
    };

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                scrolled
                    ? 'bg-background/80 backdrop-blur-lg backdrop-saturate-150 border-b border-border/50 shadow-sm shadow-black/[0.03]'
                    : 'bg-transparent border-b border-transparent'
            }`}
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="flex h-16 items-center justify-between">
                    <Link href="/" className="text-[15px] font-bold tracking-tight">
                        BuildVoiceAI
                    </Link>

                    <div className="hidden md:flex items-center gap-6">
                        {navLinks.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                onClick={(e) => handleNavClick(e, link.href)}
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {link.label}
                            </a>
                        ))}

                        <div className="w-px h-4 bg-border" />

                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/login">Log in</Link>
                        </Button>
                        <Button size="sm" className="rounded-full active:scale-[0.98] transition-[transform,background-color,box-shadow] duration-200" asChild>
                            <Link href="/signup">Get Started</Link>
                        </Button>
                    </div>

                    <button
                        className="md:hidden p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle menu"
                    >
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>

                {mobileOpen && (
                    <div className="md:hidden pb-6 border-t border-border/50 mt-3 pt-6">
                        <div className="flex flex-col gap-3">
                            {navLinks.map((link) => (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    onClick={(e) => handleNavClick(e, link.href)}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                                >
                                    {link.label}
                                </a>
                            ))}
                            <div className="flex gap-2 mt-2">
                                <Button variant="ghost" size="sm" asChild className="flex-1">
                                    <Link href="/login">Log in</Link>
                                </Button>
                                <Button size="sm" className="flex-1 rounded-full active:scale-[0.98]" asChild>
                                    <Link href="/signup">Get Started</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
