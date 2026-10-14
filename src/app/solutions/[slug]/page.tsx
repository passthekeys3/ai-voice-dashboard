import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { PricingSection } from '@/components/landing/PricingSection';
import { Footer } from '@/components/landing/Footer';
import { ALL_SOLUTIONS, SOLUTIONS } from '@/lib/marketing/solutions';
import type { SolutionSlug } from '@/lib/marketing/solution-links';

const SITE_URL = 'https://buildvoiceai.com';

function getSolution(slug: string) {
    return Object.hasOwn(SOLUTIONS, slug) ? SOLUTIONS[slug as SolutionSlug] : undefined;
}

export function generateStaticParams() {
    return ALL_SOLUTIONS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const solution = getSolution(slug);
    if (!solution) return {};

    return {
        title: `${solution.title} - BuildVoiceAI`,
        description: solution.metaDescription,
        alternates: { canonical: `${SITE_URL}/solutions/${slug}` },
        robots: { index: true, follow: true },
        openGraph: {
            title: solution.title,
            description: solution.metaDescription,
            url: `${SITE_URL}/solutions/${slug}`,
            siteName: 'BuildVoiceAI',
            type: 'website',
            images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
        },
        twitter: {
            card: 'summary_large_image',
            title: solution.title,
            description: solution.metaDescription,
        },
    };
}

function SectionHeading({ label, title }: { label: string; title: string }) {
    return (
        <div className="text-center mb-12">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">{label}</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h2>
        </div>
    );
}

export default async function SolutionPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const solution = getSolution(slug);
    if (!solution) notFound();

    const Icon = solution.icon;
    const pageUrl = `${SITE_URL}/solutions/${slug}`;
    const otherSolutions = ALL_SOLUTIONS.filter((s) => s.slug !== solution.slug);

    const jsonLd = [
        {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: solution.title,
            description: solution.metaDescription,
            url: pageUrl,
            mainEntity: {
                '@type': 'SoftwareApplication',
                name: `BuildVoiceAI for ${solution.name}`,
                applicationCategory: 'BusinessApplication',
                operatingSystem: 'Web',
                url: pageUrl,
                description: solution.description,
            },
            breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                    { '@type': 'ListItem', position: 2, name: 'Solutions', item: `${SITE_URL}/solutions` },
                    { '@type': 'ListItem', position: 3, name: solution.name, item: pageUrl },
                ],
            },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: solution.faqs.map(({ question, answer }) => ({
                '@type': 'Question',
                name: question,
                acceptedAnswer: { '@type': 'Answer', text: answer },
            })),
        },
    ];

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <Navbar />
            <main className="overflow-hidden">
                {/* Hero */}
                <section className="pt-32 pb-16 px-4 sm:px-6">
                    <div className="max-w-3xl mx-auto text-center">
                        <Link
                            href="/solutions"
                            className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground mb-6 hover:text-foreground transition-colors"
                        >
                            <Icon className="h-4 w-4" />
                            {solution.name}
                        </Link>
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 text-balance">
                            {solution.headline}
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                            {solution.description}
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link
                                href="/signup"
                                className="inline-flex w-full sm:w-auto items-center justify-center rounded-full bg-foreground text-background px-6 py-3 text-sm font-medium hover:bg-foreground/90 transition-colors"
                            >
                                Start free trial
                            </Link>
                            <Link
                                href="#pricing"
                                className="inline-flex w-full sm:w-auto items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
                            >
                                View pricing
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Problem */}
                <section className="pb-20 px-4 sm:px-6">
                    <p className="max-w-2xl mx-auto text-center text-base sm:text-lg leading-relaxed text-foreground/80">
                        {solution.problem}
                    </p>
                </section>

                {/* Benefits */}
                <section className="py-20 px-4 sm:px-6 bg-muted/30">
                    <div className="max-w-5xl mx-auto">
                        <SectionHeading label="What it does" title={`Built for ${solution.name.toLowerCase()}`} />
                        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                            {solution.benefits.map((benefit) => (
                                <div key={benefit.title} className="space-y-2">
                                    <h3 className="font-semibold flex items-start gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                        {benefit.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed pl-7">
                                        {benefit.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Call flow */}
                <section className="py-20 px-4 sm:px-6">
                    <div className="max-w-5xl mx-auto">
                        <SectionHeading label="How it works" title="From ring to follow-up" />
                        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {solution.callFlow.map((step, i) => (
                                <li key={step.title} className="rounded-xl border border-border p-5">
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold mb-3">
                                        {i + 1}
                                    </span>
                                    <h3 className="font-semibold mb-1.5">{step.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* Example conversation */}
                <section className="py-20 px-4 sm:px-6 bg-muted/30">
                    <div className="max-w-2xl mx-auto">
                        <SectionHeading label="Example conversation" title="What a call can sound like" />
                        <div className="rounded-2xl border border-border bg-background p-4 sm:p-6 space-y-3">
                            {solution.sampleConversation.map((line, i) => (
                                <div
                                    key={i}
                                    className={`flex ${line.speaker === 'caller' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                            line.speaker === 'caller'
                                                ? 'bg-foreground text-background rounded-br-sm'
                                                : 'bg-muted rounded-bl-sm'
                                        }`}
                                    >
                                        <span className="sr-only">{line.speaker === 'caller' ? 'Caller: ' : 'AI agent: '}</span>
                                        {line.text}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-3">
                            Illustrative example. Your agent follows the instructions and knowledge base you give it.
                        </p>
                    </div>
                </section>

                {/* Use cases + prompt */}
                <section className="py-20 px-4 sm:px-6">
                    <div className="max-w-3xl mx-auto text-center">
                        <SectionHeading label="Use cases" title="Calls your agent can take" />
                        <div className="flex flex-wrap justify-center gap-2.5 mb-12">
                            {solution.useCases.map((useCase) => (
                                <span
                                    key={useCase}
                                    className="inline-flex items-center rounded-full bg-muted px-4 py-2 text-sm font-medium"
                                >
                                    {useCase}
                                </span>
                            ))}
                        </div>
                        <div className="rounded-xl border border-border bg-muted/30 p-6 text-left">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
                                Start with this description
                            </p>
                            <p className="text-sm sm:text-base leading-relaxed">&ldquo;{solution.examplePrompt}&rdquo;</p>
                        </div>
                        <Link
                            href="/signup"
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground text-background px-6 py-3 text-sm font-medium hover:bg-foreground/90 transition-colors mt-6"
                        >
                            Build this agent
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </section>

                {/* Setup + good to know */}
                <section className="py-20 px-4 sm:px-6 bg-muted/30">
                    <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-2">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight mb-5">What you need to go live</h2>
                            <ul className="space-y-3">
                                {solution.setup.map((item) => (
                                    <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight mb-5">Good to know</h2>
                            <ul className="space-y-3">
                                {solution.goodToKnow.map((item) => (
                                    <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Industry FAQ */}
                <section className="py-20 px-4 sm:px-6">
                    <div className="max-w-3xl mx-auto">
                        <SectionHeading label="FAQ" title={`Questions from ${solution.name.toLowerCase()}`} />
                        <div className="divide-y divide-border border-y border-border">
                            {solution.faqs.map((faq) => (
                                <details key={faq.question} className="group py-5">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                                        {faq.question}
                                        <span className="text-muted-foreground transition-transform group-open:rotate-45 text-lg leading-none" aria-hidden="true">+</span>
                                    </summary>
                                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                                </details>
                            ))}
                        </div>
                        <p className="text-sm text-muted-foreground text-center mt-6">
                            More questions? See the{' '}
                            <Link href="/#faq" className="underline underline-offset-4 hover:text-foreground">general FAQ</Link>.
                        </p>
                    </div>
                </section>

                {/* Other industries */}
                <section className="py-16 px-4 sm:px-6 border-t border-border">
                    <div className="max-w-5xl mx-auto">
                        <h2 className="text-lg font-semibold mb-6 text-center">Other industries</h2>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {otherSolutions.map((other) => {
                                const OtherIcon = other.icon;
                                return (
                                    <Link
                                        key={other.slug}
                                        href={`/solutions/${other.slug}`}
                                        className="group rounded-xl border border-border p-5 hover:bg-muted/50 transition-colors"
                                    >
                                        <OtherIcon className="h-5 w-5 text-muted-foreground mb-3" />
                                        <p className="font-medium mb-1 flex items-center gap-1">
                                            {other.name}
                                            <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                        </p>
                                        <p className="text-sm text-muted-foreground">{other.headline}</p>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <PricingSection />
            </main>
            <Footer />
        </>
    );
}
