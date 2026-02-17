import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { DashboardDemo } from '@/components/landing/DashboardDemo';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { ProductSection } from '@/components/landing/ProductSection';
import { IntegrationLogosSection } from '@/components/landing/IntegrationLogosSection';
import { StatsBar } from '@/components/landing/StatsBar';
import { SocialProofSection } from '@/components/landing/SocialProofSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { AISummarySection } from '@/components/landing/AISummarySection';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';

const SITE_URL = 'https://buildvoiceai.com';

const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'BuildVoiceAI',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description:
        'Build AI voice agents from natural language descriptions. White-label platform for agencies.',
    sameAs: [],
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
        'Build AI voice agents from natural language descriptions. White-label platform for agencies. Manage calls, analytics, workflows, and phone numbers.',
    offers: [
        {
            '@type': 'Offer',
            name: 'Starter',
            price: '49',
            priceCurrency: 'USD',
            priceValidUntil: '2026-12-31',
            url: `${SITE_URL}/#pricing`,
            description: 'For solo operators — up to 3 voice agents, 500 minutes included per month',
        },
        {
            '@type': 'Offer',
            name: 'Growth',
            price: '149',
            priceCurrency: 'USD',
            priceValidUntil: '2026-12-31',
            url: `${SITE_URL}/#pricing`,
            description: 'For growing agencies — up to 15 voice agents, 2,000 minutes, CRM integrations, white-label portal',
        },
        {
            '@type': 'Offer',
            name: 'Agency',
            price: '399',
            priceCurrency: 'USD',
            priceValidUntil: '2026-12-31',
            url: `${SITE_URL}/#pricing`,
            description: 'For established agencies — unlimited voice agents, 10,000 minutes, full white-label platform, API access',
        },
    ],
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'What is BuildVoiceAI?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'BuildVoiceAI is a platform that lets you create AI-powered phone agents using plain English. You describe what the agent should do — answer questions, book appointments, qualify leads — and the platform builds, deploys, and manages it for you.',
            },
        },
        {
            '@type': 'Question',
            name: 'Who is this for?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Marketing agencies, call centers, and service businesses that want to automate phone interactions without building from scratch. Whether you handle 50 or 50,000 calls a month, the platform scales with you.',
            },
        },
        {
            '@type': 'Question',
            name: 'How does the AI agent builder work?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'You type a natural-language description of what your agent should do. The system generates the conversation flow, selects a voice, and configures the phone number. You can test it immediately and refine from there.',
            },
        },
        {
            '@type': 'Question',
            name: 'Can I white-label this for my clients?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. Growth and Agency plans include white-label client portals. Your clients see your brand, your domain, and only the data you choose to share — calls, analytics, and recordings scoped to their account.',
            },
        },
        {
            '@type': 'Question',
            name: 'Which voice providers do you support?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'We integrate with Retell AI, Vapi, and Bland. You can pick the provider that fits your use case, or run A/B experiments across providers to find the best performer.',
            },
        },
        {
            '@type': 'Question',
            name: 'What CRM integrations are available?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'GoHighLevel and HubSpot are supported natively. Post-call workflows can update contacts, create deals, send follow-ups, and trigger automations in your CRM automatically.',
            },
        },
        {
            '@type': 'Question',
            name: 'How does billing work?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Plans are billed monthly. Each plan includes a set number of agents, phone numbers, and calls. Overages are charged at per-minute rates depending on the voice provider used. You can upgrade, downgrade, or cancel anytime.',
            },
        },
        {
            '@type': 'Question',
            name: 'Is there a free trial?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. The Starter plan includes a free trial period so you can test the platform with real calls before committing.',
            },
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
