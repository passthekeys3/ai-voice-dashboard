import Link from 'next/link';

const productLinks = [
    { label: 'Pricing', href: '#pricing' },
    { label: 'Agent Builder', href: '/signup' },
];

const companyLinks = [
    { label: 'Log in', href: '/login' },
    { label: 'Sign up', href: '/signup' },
];

export function Footer() {
    return (
        <footer className="border-t border-border">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    <div className="space-y-2">
                        <Link href="/" className="text-base font-semibold tracking-tight">
                            BuildVoiceAI
                        </Link>
                        <p className="text-sm text-muted-foreground">
                            AI voice agents for businesses and agencies.
                        </p>
                    </div>

                    <div>
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

                    <div>
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

                <div className="mt-12 pt-8 border-t border-border text-sm text-muted-foreground">
                    &copy; {new Date().getFullYear()} BuildVoiceAI
                </div>
            </div>
        </footer>
    );
}
