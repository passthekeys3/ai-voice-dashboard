'use client';

import Link from 'next/link';
import { useInView } from '@/hooks/useInView';

const productLinks = [
    { label: 'Pricing', href: '#pricing' },
    { label: 'Agent Builder', href: '/signup' },
];

const companyLinks = [
    { label: 'Log in', href: '/login' },
    { label: 'Sign up', href: '/signup' },
];

export function Footer() {
    const { ref, isInView } = useInView({ threshold: 0.1 });

    return (
        <footer ref={ref} className="border-t border-border">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    <div className={`space-y-2 animate-on-scroll stagger-1 ${isInView ? 'is-visible' : ''}`}>
                        <Link href="/" className="text-base font-semibold tracking-tight">
                            BuildVoiceAI
                        </Link>
                        <p className="text-sm text-muted-foreground">
                            AI voice agents for businesses and agencies.
                        </p>
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
                            Company
                        </p>
                        <ul className="space-y-2">
                            {companyLinks.map((link) => (
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
                    className={`mt-12 pt-8 border-t border-border text-sm text-muted-foreground animate-on-scroll stagger-4 ${isInView ? 'is-visible' : ''}`}
                >
                    &copy; {new Date().getFullYear()} BuildVoiceAI
                </div>
            </div>
        </footer>
    );
}
