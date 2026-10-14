'use client';

import Link from 'next/link';
import { Twitter } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { Logo } from '@/components/Logo';
import { SOLUTION_LINKS, solutionHref } from '@/lib/marketing/solution-links';

const productLinks = [
    { label: 'How it works', href: '/#how-it-works' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'Log in', href: '/login' },
    { label: 'Sign up', href: '/signup' },
];

const solutionLinks = [
    ...SOLUTION_LINKS.map(({ slug, label }) => ({ label, href: solutionHref(slug) })),
    { label: 'All solutions', href: '/solutions' },
];

const resourceLinks = [
    { label: 'Blog', href: '/blog' },
    { label: 'Documentation', href: 'https://docs.buildvoiceai.com', external: true },
    { label: 'Getting Started', href: 'https://docs.buildvoiceai.com/docs/getting-started', external: true },
    { label: 'API Reference', href: 'https://docs.buildvoiceai.com/docs/reference', external: true },
];

const legalLinks = [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
];

export function Footer() {
    const { ref, isInView } = useInView({ threshold: 0.1 });

    return (
        <footer ref={ref} className="border-t border-border">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8">
                    <div className={`space-y-2 animate-on-scroll stagger-1 ${isInView ? 'is-visible' : ''}`}>
                        <Link href="/" className="flex items-center">
                            <Logo variant="full" size="md" />
                        </Link>
                        <p className="text-sm text-muted-foreground">
                            AI voice agents for businesses and agencies.
                        </p>
                        <div className="flex items-center gap-3 pt-2">
                            <a
                                href="https://x.com/buildvoiceai"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Follow BuildVoiceAI on X"
                            >
                                <Twitter className="h-4 w-4" />
                            </a>
                        </div>
                    </div>

                    <div className={`animate-on-scroll stagger-2 ${isInView ? 'is-visible' : ''}`}>
                        <p className="text-xs font-medium text-foreground uppercase tracking-widest mb-3">
                            Product
                        </p>
                        <ul className="space-y-2">
                            {productLinks.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className={`animate-on-scroll stagger-3 ${isInView ? 'is-visible' : ''}`}>
                        <p className="text-xs font-medium text-foreground uppercase tracking-widest mb-3">
                            Resources
                        </p>
                        <ul className="space-y-2">
                            {resourceLinks.map((link) => (
                                <li key={link.label}>
                                    {link.external ? (
                                        <a
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {link.label}
                                        </a>
                                    ) : (
                                        <Link
                                            href={link.href}
                                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className={`animate-on-scroll stagger-4 ${isInView ? 'is-visible' : ''}`}>
                        <p className="text-xs font-medium text-foreground uppercase tracking-widest mb-3">
                            Solutions
                        </p>
                        <ul className="space-y-2">
                            {solutionLinks.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className={`animate-on-scroll stagger-5 ${isInView ? 'is-visible' : ''}`}>
                        <p className="text-xs font-medium text-foreground uppercase tracking-widest mb-3">
                            Legal
                        </p>
                        <ul className="space-y-2">
                            {legalLinks.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div
                    className={`mt-12 pt-8 border-t border-border text-sm text-muted-foreground animate-on-scroll stagger-6 ${isInView ? 'is-visible' : ''}`}
                >
                    &copy; {new Date().getFullYear()} BuildVoiceAI
                </div>
            </div>
        </footer>
    );
}
