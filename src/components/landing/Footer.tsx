import Link from 'next/link';

const productLinks = [
    { label: 'Pricing', href: '#pricing' },
    { label: 'Agent Builder', href: '/signup' },
];

export function Footer() {
    return (
        <footer className="border-t border-border">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <Link href="/" className="text-base font-semibold tracking-tight">
                            BuildVoiceAI
                        </Link>
                        <p className="text-sm text-muted-foreground">
                            AI voice agents for businesses and agencies.
                        </p>
                    </div>

                    <div className="flex gap-6">
                        {productLinks.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-border text-sm text-muted-foreground">
                    &copy; {new Date().getFullYear()} BuildVoiceAI
                </div>
            </div>
        </footer>
    );
}
