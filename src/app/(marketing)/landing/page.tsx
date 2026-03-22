import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { DashboardDemo } from '@/components/landing/DashboardDemo';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';

// Lazy-load below-the-fold sections to reduce initial JS bundle
const ProductSection = dynamic(() => import('@/components/landing/ProductSection').then(m => ({ default: m.ProductSection })));
const IntegrationLogosSection = dynamic(() => import('@/components/landing/IntegrationLogosSection').then(m => ({ default: m.IntegrationLogosSection })));
const StatsBar = dynamic(() => import('@/components/landing/StatsBar').then(m => ({ default: m.StatsBar })));
const SocialProofSection = dynamic(() => import('@/components/landing/SocialProofSection').then(m => ({ default: m.SocialProofSection })));
const PricingSection = dynamic(() => import('@/components/landing/PricingSection').then(m => ({ default: m.PricingSection })));
const FAQSection = dynamic(() => import('@/components/landing/FAQSection').then(m => ({ default: m.FAQSection })));
const AISummarySection = dynamic(() => import('@/components/landing/AISummarySection').then(m => ({ default: m.AISummarySection })));
const FinalCTA = dynamic(() => import('@/components/landing/FinalCTA').then(m => ({ default: m.FinalCTA })));
const Footer = dynamic(() => import('@/components/landing/Footer').then(m => ({ default: m.Footer })));

export const metadata: Metadata = {
    title: 'BuildVoiceAI — AI Voice Agent Platform for Agencies & Businesses',
    description:
        'BuildVoiceAI is a white-label AI voice agent platform for agencies. Build voice agents from natural language, deploy in 30 minutes, integrate with GoHighLevel and HubSpot. Plans from $67/month.',
    robots: { index: true, follow: true },
};

const SITE_URL = 'https://buildvoiceai.com';

const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'BuildVoiceAI',
    url: SITE_URL,
    logo: `${SITE_URL}/logo`,
    description:
        'BuildVoiceAI is a white-label AI voice agent platform that lets agencies and businesses build, deploy, and manage AI-powered phone agents from natural language descriptions.',
    sameAs: [
        'https://twitter.com/buildvoiceai',
        'https://linkedin.com/company/buildvoiceai',
    ],
    areaServed: {
        '@type': 'Place',
        name: 'Worldwide',
    },
    knowsLanguage: ['en'],
};

const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'BuildVoiceAI',
    url: SITE_URL,
    description:
        'AI Voice Agents for Agencies & Businesses — build, monitor, automate, and scale.',
    potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/blog?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
    },
};

const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'BuildVoiceAI',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description:
        'BuildVoiceAI is a white-label AI voice agent platform for agencies and businesses. Build AI phone agents from natural language descriptions in under 30 minutes. Supports Retell AI, Vapi, and Bland providers with GoHighLevel and HubSpot CRM integrations.',
    featureList: [
        'Natural language AI agent builder',
        'Multi-provider support (Retell AI, Vapi, Bland)',
        'White-label client portals with custom domains',
        'GoHighLevel and HubSpot CRM integrations',
        'Post-call workflow automation',
        'Real-time call analytics and transcripts',
        'Phone number management via Twilio',
        'Stripe Connect client billing',
    ],
    screenshot: `${SITE_URL}/opengraph-image`,
    offers: [
        {
            '@type': 'Offer',
            name: 'Self-Service Starter',
            price: '67',
            priceCurrency: 'USD',
            priceValidUntil: '2026-12-31',
            url: `${SITE_URL}/#pricing`,
            description: 'For solo operators — 3 clients included, bring your own API keys, white-label portal',
        },
        {
            '@type': 'Offer',
            name: 'Self-Service Growth',
            price: '147',
            priceCurrency: 'USD',
            priceValidUntil: '2026-12-31',
            url: `${SITE_URL}/#pricing`,
            description: 'For growing agencies — 10 clients included, CRM integrations, white-label portal',
        },
        {
            '@type': 'Offer',
            name: 'Self-Service Agency',
            price: '297',
            priceCurrency: 'USD',
            priceValidUntil: '2026-12-31',
            url: `${SITE_URL}/#pricing`,
            description: 'For established agencies — 25 clients included, full white-label platform, API access',
        },
        {
            '@type': 'Offer',
            name: 'Managed Starter',
            price: '97',
            priceCurrency: 'USD',
            priceValidUntil: '2026-12-31',
            url: `${SITE_URL}/#pricing`,
            description: 'Done-for-you setup — 3 clients included, platform-hosted API keys, $0.15/min voice usage',
        },
        {
            '@type': 'Offer',
            name: 'Managed Growth',
            price: '197',
            priceCurrency: 'USD',
            priceValidUntil: '2026-12-31',
            url: `${SITE_URL}/#pricing`,
            description: 'Done-for-you setup — 10 clients included, platform-hosted API keys, CRM integrations',
        },
        {
            '@type': 'Offer',
            name: 'Managed Agency',
            price: '397',
            priceCurrency: 'USD',
            priceValidUntil: '2026-12-31',
            url: `${SITE_URL}/#pricing`,
            description: 'Done-for-you setup — 25 clients included, full white-label platform, priority support',
        },
    ],
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'How long does it take to set up a voice agent?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Most agents are live within 30 minutes. Describe what your agent should do, pick a voice, and connect your phone number. The platform generates the conversation flow automatically.',
            },
        },
        {
            '@type': 'Question',
            name: 'Can I use my own phone numbers?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. You can bring existing numbers from Twilio or purchase new ones directly through the platform. Porting takes a few minutes.',
            },
        },
        {
            '@type': 'Question',
            name: 'Which CRMs do you integrate with?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'GoHighLevel and HubSpot are natively supported. When a call ends, the agent can update contacts, create deals, book appointments, and trigger workflows automatically. We also support Calendly and Slack.',
            },
        },
        {
            '@type': 'Question',
            name: 'How does white-labeling work?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'On the Growth and Agency plans, you get a fully branded dashboard — your logo, your colors, your domain. Your clients log into their own portal and only see their data. They never see BuildVoiceAI.',
            },
        },
        {
            '@type': 'Question',
            name: 'What do the voices sound like?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'The platform uses the latest neural voice models. Voices sound natural and conversational — not robotic. You can preview every voice before going live and choose from dozens of options across accents and tones.',
            },
        },
        {
            '@type': 'Question',
            name: 'Is my data private and secure?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'All data is encrypted at rest and in transit. Call recordings and transcripts are scoped per account with row-level security. We never share your data or use it to train models.',
            },
        },
        {
            '@type': 'Question',
            name: "What happens if the AI can't answer a question?",
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'You define fallback behavior when building your agent. It can transfer to a human, take a message, or schedule a callback. You stay in control of every edge case.',
            },
        },
        {
            '@type': 'Question',
            name: 'Can I try it before committing to a plan?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Every plan includes a 14-day free trial. You can build agents, make test calls, and explore the full platform before entering payment details.',
            },
        },
        {
            '@type': 'Question',
            name: 'What happens if I go over my included minutes?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Overages are billed at per-minute rates that vary by voice provider — typically $0.05–$0.12/min. You can see real-time cost tracking in your dashboard and set monthly spending limits to avoid surprises.',
            },
        },
        {
            '@type': 'Question',
            name: 'Is the platform HIPAA or SOC 2 compliant?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'We take compliance seriously. Call data is encrypted at rest and in transit, and access controls are enforced at the row level. For healthcare or regulated industries, contact us to discuss BAA arrangements and our compliance roadmap.',
            },
        },
    ],
};

const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Build an AI Voice Agent with BuildVoiceAI',
    description: 'Create and deploy an AI-powered phone agent in under 30 minutes with no code.',
    totalTime: 'PT30M',
    step: [
        {
            '@type': 'HowToStep',
            position: 1,
            name: 'Describe',
            text: 'Tell the AI what your agent should say, who to transfer to, and how to handle edge cases. Plain English.',
        },
        {
            '@type': 'HowToStep',
            position: 2,
            name: 'Generate',
            text: 'The platform writes the script, picks a voice, provisions a number, and configures your CRM connections.',
        },
        {
            '@type': 'HowToStep',
            position: 3,
            name: 'Deploy',
            text: 'Make a test call, tweak anything, go live. Your agent starts handling real calls in under 30 minutes.',
        },
    ],
};

const reviewsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'BuildVoiceAI',
    aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        bestRating: '5',
        ratingCount: '200',
        reviewCount: '3',
    },
    review: [
        {
            '@type': 'Review',
            author: { '@type': 'Person', name: 'Rachel Simmons' },
            reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
            reviewBody: 'We replaced our entire call center with three voice agents. Setup took an afternoon — our CRM was syncing by dinner.',
            datePublished: '2026-02-15',
        },
        {
            '@type': 'Review',
            author: { '@type': 'Person', name: 'Marcus Tran' },
            reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
            reviewBody: 'I white-labeled BuildVoiceAI for my agency clients in a day. They think we built it. The margin on this is unreal.',
            datePublished: '2026-02-20',
        },
        {
            '@type': 'Review',
            author: { '@type': 'Person', name: 'Sofia Gutierrez' },
            reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
            reviewBody: 'Our booking rate went from 30% to 68% once the AI agent started handling after-hours calls. It never misses a lead.',
            datePublished: '2026-03-01',
        },
    ],
};

const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
        { '@type': 'ListItem', position: 3, name: 'Privacy', item: `${SITE_URL}/privacy` },
        { '@type': 'ListItem', position: 4, name: 'Terms', item: `${SITE_URL}/terms` },
    ],
};

export default function LandingPage() {
    return (
        <>
            {/* JSON-LD Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsJsonLd) }}
            />

            <Navbar />
            <main className="overflow-hidden">
                <HeroSection />

                <DashboardDemo />

                <HowItWorksSection />

                <div id="features">
                    <ProductSection
                        label="Build"
                        headline="Describe your agent. Watch it come to life."
                        description="Tell the AI what your agent should say, how it should sound, and when to transfer. It writes the script, picks the voice, and handles the rest."
                        visual="builder"
                    />

                    <ProductSection
                        label="Monitor"
                        headline="See every conversation, in real time."
                        description="Call volume, success rates, costs, and duration — all in one view. Click any call to read the full transcript or listen to the recording."
                        visual="analytics"
                        reverse
                    />

                    <ProductSection
                        label="Automate"
                        headline="Connect calls to the rest of your stack."
                        description="When a call ends, update your CRM, book the appointment, and send the follow-up. Works with GoHighLevel, HubSpot, Calendly, and Slack."
                        visual="workflows"
                    />

                    <ProductSection
                        label="Scale"
                        headline="White-label the entire platform."
                        description="Your clients get their own branded dashboard — your logo, your domain, their data. You control what they can access."
                        visual="portal"
                        reverse
                    />
                </div>

                <IntegrationLogosSection />

                <div className="border-t border-border max-w-5xl mx-auto" />

                <StatsBar />
                <SocialProofSection />
                <PricingSection />
                <FAQSection />
                <AISummarySection />
                <FinalCTA />
            </main>
            <Footer />
        </>
    );
}
