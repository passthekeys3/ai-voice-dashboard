import type { Metadata } from 'next';

const SITE_URL = 'https://buildvoiceai.com';

export const metadata: Metadata = {
    title: 'BuildVoiceAI — AI Voice Agent Platform for Agencies & Businesses',
    description:
        'BuildVoiceAI is a white-label AI voice agent platform. Build phone agents from natural language in 30 minutes. Supports Retell AI, Vapi, Bland, and ElevenLabs with GoHighLevel and HubSpot integrations. Plans from $67/month.',
    alternates: {
        canonical: SITE_URL,
    },
    robots: { index: true, follow: true },
    openGraph: {
        title: 'BuildVoiceAI — AI Voice Agent Platform for Agencies & Businesses',
        description:
            'Build AI voice agents from natural language descriptions. White-label platform for agencies with CRM integrations and post-call automation.',
        siteName: 'BuildVoiceAI',
        type: 'website',
        url: SITE_URL,
        images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'BuildVoiceAI — AI Voice Agent Platform for Agencies & Businesses',
        description:
            'Build AI voice agents from natural language descriptions. White-label platform for agencies with CRM integrations and post-call automation.',
    },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {children}
        </div>
    );
}
