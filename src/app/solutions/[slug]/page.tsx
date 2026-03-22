import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/landing/Navbar';
import { PricingSection } from '@/components/landing/PricingSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { Footer } from '@/components/landing/Footer';
import { Phone, Clock, TrendingUp, Users, CheckCircle2 } from 'lucide-react';

const SITE_URL = 'https://buildvoiceai.com';

interface Solution {
    slug: string;
    title: string;
    headline: string;
    description: string;
    metaDescription: string;
    icon: typeof Phone;
    heroStat: { value: string; label: string };
    benefits: { title: string; description: string }[];
    useCases: string[];
    examplePrompt: string;
}

const SOLUTIONS: Record<string, Solution> = {
    dental: {
        slug: 'dental',
        title: 'AI Voice Agents for Dental Practices',
        headline: 'Never miss a patient call again',
        description: 'AI receptionists that book appointments, verify insurance, handle after-hours calls, and sync everything to your practice management system.',
        metaDescription: 'AI voice agents for dental practices — automated appointment booking, insurance verification, after-hours call handling, and CRM integration. Live in 30 minutes.',
        icon: Phone,
        heroStat: { value: '68%', label: 'booking rate increase' },
        benefits: [
            { title: '24/7 appointment booking', description: 'Patients call any time and the AI books directly into your calendar. No more missed calls during lunch or after hours.' },
            { title: 'Insurance verification', description: 'The agent asks for insurance details, verifies coverage, and notes it in the patient record before the visit.' },
            { title: 'Recall and follow-up', description: 'Automated outbound calls remind patients about cleanings, follow-ups, and outstanding treatment plans.' },
            { title: 'CRM sync', description: 'Every call updates your GoHighLevel or HubSpot contacts with notes, tags, and appointment details.' },
        ],
        useCases: ['Appointment scheduling', 'Insurance verification', 'Patient intake', 'Recall campaigns', 'After-hours handling', 'Emergency triage routing'],
        examplePrompt: 'A friendly dental receptionist that books appointments, asks about insurance, and transfers emergencies to the on-call dentist.',
    },
    'real-estate': {
        slug: 'real-estate',
        title: 'AI Voice Agents for Real Estate',
        headline: 'Qualify leads while you close deals',
        description: 'AI agents that answer property inquiries, qualify buyers, schedule showings, and update your CRM — so you never lose a lead to voicemail.',
        metaDescription: 'AI voice agents for real estate — automated lead qualification, property inquiries, showing scheduling, and CRM updates. Deploy in 30 minutes.',
        icon: TrendingUp,
        heroStat: { value: '3x', label: 'more leads qualified' },
        benefits: [
            { title: 'Instant lead response', description: 'Every inquiry gets answered immediately. The AI qualifies budget, timeline, and preferences before you ever pick up the phone.' },
            { title: 'Showing scheduler', description: 'The agent checks your availability and books property showings directly into your calendar.' },
            { title: 'Listing information', description: 'Answers questions about price, square footage, schools, and neighborhood details from your knowledge base.' },
            { title: 'Lead scoring', description: 'Tags hot, warm, and cold leads in your CRM based on conversation signals so you prioritize follow-ups.' },
        ],
        useCases: ['Property inquiries', 'Buyer qualification', 'Showing scheduling', 'Open house follow-up', 'Listing updates', 'Referral requests'],
        examplePrompt: 'A professional real estate assistant that qualifies buyers on budget and timeline, answers listing questions, and books showings.',
    },
    sales: {
        slug: 'sales',
        title: 'AI Voice Agents for Sales Teams',
        headline: 'Follow up with every lead, automatically',
        description: 'AI agents that make outbound follow-up calls, set appointments, re-engage cold leads, and log everything in your CRM.',
        metaDescription: 'AI voice agents for sales teams — automated outbound calls, appointment setting, lead re-engagement, and CRM logging. Start free trial.',
        icon: Users,
        heroStat: { value: '40hrs', label: 'saved per month' },
        benefits: [
            { title: 'Outbound campaigns', description: 'Upload a list and the AI calls each lead with a personalized script. No more manual dialing.' },
            { title: 'Appointment setting', description: 'The agent pitches your offer, handles objections, and books qualified meetings on your calendar.' },
            { title: 'Lead re-engagement', description: 'Automatically call leads that went cold — the AI re-qualifies and routes hot ones to your team.' },
            { title: 'Call analytics', description: 'See conversion rates, call duration, and sentiment analysis across all campaigns in one dashboard.' },
        ],
        useCases: ['Follow-up calls', 'Appointment setting', 'Lead qualification', 'Cold outreach', 'Event invitations', 'Survey calls'],
        examplePrompt: 'A sales agent that follows up with new leads, asks qualifying questions about their needs and budget, and books a demo call.',
    },
    'customer-support': {
        slug: 'customer-support',
        title: 'AI Voice Agents for Customer Support',
        headline: 'Resolve calls faster, escalate smarter',
        description: 'AI agents that handle tier-1 support calls, answer FAQs, create tickets, and transfer complex issues to your team.',
        metaDescription: 'AI voice agents for customer support — automated FAQ handling, ticket creation, smart escalation, and 24/7 availability. Deploy in 30 minutes.',
        icon: Clock,
        heroStat: { value: '70%', label: 'calls resolved by AI' },
        benefits: [
            { title: 'FAQ resolution', description: 'The agent answers common questions from your knowledge base — returns, billing, account status — without human involvement.' },
            { title: 'Smart escalation', description: 'When the AI detects frustration or complexity, it transfers to a human with full conversation context.' },
            { title: 'Ticket creation', description: 'Unresolved issues get logged as tickets in your CRM with the transcript, sentiment, and priority level.' },
            { title: '24/7 availability', description: 'Support calls get answered any time — nights, weekends, holidays. No more "please call back during business hours."' },
        ],
        useCases: ['FAQ handling', 'Account inquiries', 'Ticket creation', 'Callback scheduling', 'After-hours support', 'Order status checks'],
        examplePrompt: 'A customer support agent that answers billing and account questions, creates support tickets, and transfers angry callers to a manager.',
    },
};

export function generateStaticParams() {
    return Object.keys(SOLUTIONS).map((slug) => ({ slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const solution = SOLUTIONS[slug];
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

export default async function SolutionPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const solution = SOLUTIONS[slug];
    if (!solution) notFound();

    const Icon = solution.icon;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: solution.title,
        description: solution.metaDescription,
        url: `${SITE_URL}/solutions/${slug}`,
        mainEntity: {
            '@type': 'SoftwareApplication',
            name: `BuildVoiceAI for ${solution.title.replace('AI Voice Agents for ', '')}`,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            url: `${SITE_URL}/solutions/${slug}`,
            description: solution.description,
        },
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Solutions', item: `${SITE_URL}/solutions` },
                { '@type': 'ListItem', position: 3, name: solution.title, item: `${SITE_URL}/solutions/${slug}` },
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
                {/* Hero */}
                <section className="pt-32 pb-20 px-4 sm:px-6">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground mb-6">
                            <Icon className="h-4 w-4" />
                            {solution.title.replace('AI Voice Agents for ', '')}
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                            {solution.headline}
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                            {solution.description}
                        </p>
                        <div className="flex items-center justify-center gap-4">
                            <Link
                                href="/signup"
                                className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-6 py-3 text-sm font-medium hover:bg-foreground/90 transition-colors"
                            >
                                Start Free Trial
                            </Link>
                            <Link
                                href="/#pricing"
                                className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
                            >
                                View Pricing
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Key Stat */}
                <section className="pb-16 px-4 sm:px-6">
                    <div className="max-w-sm mx-auto text-center rounded-xl border border-border p-8">
                        <div className="text-4xl font-bold mb-1">{solution.heroStat.value}</div>
                        <div className="text-sm text-muted-foreground">{solution.heroStat.label}</div>
                    </div>
                </section>

                {/* Benefits */}
                <section className="py-20 px-4 sm:px-6 bg-muted/30">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-12 text-center">
                            How it works for your team
                        </h2>
                        <div className="grid gap-8 md:grid-cols-2">
                            {solution.benefits.map((benefit) => (
                                <div key={benefit.title} className="space-y-2">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                                        {benefit.title}
                                    </h3>
                                    <p className="text-muted-foreground pl-7">
                                        {benefit.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Use Cases */}
                <section className="py-20 px-4 sm:px-6">
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">
                            What your AI agent handles
                        </h2>
                        <div className="flex flex-wrap justify-center gap-3">
                            {solution.useCases.map((useCase) => (
                                <span
                                    key={useCase}
                                    className="inline-flex items-center rounded-full bg-muted px-4 py-2 text-sm font-medium"
                                >
                                    {useCase}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Example Prompt */}
                <section className="py-16 px-4 sm:px-6 bg-muted/30">
                    <div className="max-w-2xl mx-auto text-center">
                        <h2 className="text-xl font-semibold mb-4">Try this prompt to get started</h2>
                        <div className="rounded-lg border border-border bg-background p-6 text-left">
                            <p className="text-sm font-mono text-muted-foreground italic">
                                &ldquo;{solution.examplePrompt}&rdquo;
                            </p>
                        </div>
                        <Link
                            href="/signup"
                            className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-6 py-3 text-sm font-medium hover:bg-foreground/90 transition-colors mt-6"
                        >
                            Build This Agent Now
                        </Link>
                    </div>
                </section>

                {/* Pricing + FAQ */}
                <div id="pricing">
                    <PricingSection />
                </div>
                <FAQSection />
            </main>
            <Footer />
        </>
    );
}
