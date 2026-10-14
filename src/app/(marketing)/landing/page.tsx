import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { DashboardDemo } from '@/components/landing/DashboardDemo';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { WhySection } from '@/components/landing/WhySection';
import { IndustriesSection } from '@/components/landing/IndustriesSection';
import { faqs } from '@/components/landing/faq-data';
import { getAllTierConfigs } from '@/lib/billing/tiers';

// Lazy-load below-the-fold sections to reduce initial JS bundle
const ProductSection = dynamic(() => import('@/components/landing/ProductSection').then(m => ({ default: m.ProductSection })));
const IntegrationLogosSection = dynamic(() => import('@/components/landing/IntegrationLogosSection').then(m => ({ default: m.IntegrationLogosSection })));
const PricingSection = dynamic(() => import('@/components/landing/PricingSection').then(m => ({ default: m.PricingSection })));
const FAQSection = dynamic(() => import('@/components/landing/FAQSection').then(m => ({ default: m.FAQSection })));
const AISummarySection = dynamic(() => import('@/components/landing/AISummarySection').then(m => ({ default: m.AISummarySection })));
const FinalCTA = dynamic(() => import('@/components/landing/FinalCTA').then(m => ({ default: m.FinalCTA })));
const Footer = dynamic(() => import('@/components/landing/Footer').then(m => ({ default: m.Footer })));

export const metadata: Metadata = {
    title: 'BuildVoiceAI — AI Voice Agent Platform for Agencies & Businesses',
    description:
        'BuildVoiceAI is a white-label AI voice agent platform for agencies. Build voice agents from natural language, white-label them for clients, and integrate with GoHighLevel and HubSpot. Plans from $67/month.',
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
    sameAs: ['https://x.com/buildvoiceai'],
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
};

const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'BuildVoiceAI',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description:
        'BuildVoiceAI is a white-label AI voice agent platform for agencies and businesses. Build AI phone agents from natural language descriptions, no code required. Supports Retell AI, Vapi, Bland, and ElevenLabs providers with GoHighLevel and HubSpot CRM integrations.',
    featureList: [
        'Natural language AI agent builder',
        'Multi-provider support (Retell AI, Vapi, Bland, ElevenLabs)',
        'White-label client portals with custom domains',
        'GoHighLevel and HubSpot CRM integrations',
        'Post-call workflow automation',
        'Real-time call analytics and transcripts',
        'Phone number purchasing and management',
        'Stripe Connect client billing',
    ],
    screenshot: `${SITE_URL}/opengraph-image`,
    offers: getAllTierConfigs()
        .flatMap(({ selfService, managed }) => [selfService, managed])
        .map((plan) => ({
            '@type': 'Offer',
            name: plan.name,
            price: String(plan.monthlyPrice),
            priceCurrency: 'USD',
            url: `${SITE_URL}/#pricing`,
            description: plan.features.join(', '),
        })),
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
};

const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Build an AI Voice Agent with BuildVoiceAI',
    description: 'Create and deploy an AI-powered phone agent with no code.',
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
            text: 'Make a test call, tweak anything, go live. Your agent starts handling real calls.',
        },
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
                dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
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

                <WhySection />
                <IndustriesSection />
                <PricingSection />
                <FAQSection />
                <AISummarySection />
                <FinalCTA />
            </main>
            <Footer />
        </>
    );
}
