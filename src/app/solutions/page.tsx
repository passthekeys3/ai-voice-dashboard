import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { ALL_SOLUTIONS } from '@/lib/marketing/solutions';

const SITE_URL = 'https://buildvoiceai.com';
const TITLE = 'AI Voice Agents by Industry - BuildVoiceAI';
const DESCRIPTION =
    'AI phone agents for dental practices, real estate, sales teams and customer support. See what each agent handles, how calls flow into your CRM, and how to get started.';

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: `${SITE_URL}/solutions` },
    robots: { index: true, follow: true },
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        url: `${SITE_URL}/solutions`,
        siteName: 'BuildVoiceAI',
        type: 'website',
        images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function SolutionsPage() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: TITLE,
        description: DESCRIPTION,
        url: `${SITE_URL}/solutions`,
        hasPart: ALL_SOLUTIONS.map((s) => ({
            '@type': 'WebPage',
            name: s.title,
            url: `${SITE_URL}/solutions/${s.slug}`,
        })),
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Solutions', item: `${SITE_URL}/solutions` },
            ],
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <Navbar />
            <main className="overflow-hidden">
                <section className="pt-32 pb-12 px-4 sm:px-6">
                    <div className="max-w-3xl mx-auto text-center">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Solutions</p>
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 text-balance">
                            Voice agents for the calls your business gets
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Start from a template built for your industry, or describe any agent in plain English.
                        </p>
                    </div>
                </section>

                <section className="pb-20 px-4 sm:px-6">
                    <div className="max-w-5xl mx-auto grid gap-5 sm:grid-cols-2">
                        {ALL_SOLUTIONS.map((solution) => {
                            const Icon = solution.icon;
                            return (
                                <Link
                                    key={solution.slug}
                                    href={`/solutions/${solution.slug}`}
                                    className="group flex flex-col rounded-2xl border border-border p-6 hover:bg-muted/40 transition-colors"
                                >
                                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
                                        <Icon className="h-4 w-4" />
                                        {solution.name}
                                    </div>
                                    <h2 className="text-xl font-semibold tracking-tight mb-2">{solution.headline}</h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                                        {solution.description}
                                    </p>
                                    <ul className="flex flex-wrap gap-2 mb-5">
                                        {solution.useCases.slice(0, 4).map((useCase) => (
                                            <li key={useCase} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                                                {useCase}
                                            </li>
                                        ))}
                                    </ul>
                                    <span className="inline-flex items-center gap-1 text-sm font-medium">
                                        See how it works
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </section>

                <section className="py-20 px-4 sm:px-6 border-t border-border">
                    <div className="max-w-2xl mx-auto text-center">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Don’t see your industry?</h2>
                        <p className="text-muted-foreground mb-8">
                            The builder works for any kind of call. Describe what your agent should do and it writes the script,
                            picks a voice and sets up the agent for you.
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground text-background px-6 py-3 text-sm font-medium hover:bg-foreground/90 transition-colors"
                        >
                            Try the builder
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
