import type { Metadata } from 'next';

const SITE_URL = 'https://buildvoiceai.com';

export const metadata: Metadata = {
    title: 'BuildVoiceAI - AI Voice Agents for Agencies & Businesses',
    description:
        'Build AI voice agents from natural language descriptions. White-label platform for agencies. Manage calls, analytics, workflows, and phone numbers.',
    alternates: {
        canonical: SITE_URL,
    },
    openGraph: {
        title: 'BuildVoiceAI - AI Voice Agents for Agencies & Businesses',
        description: 'Build AI voice agents from natural language descriptions. White-label platform for agencies.',
        siteName: 'BuildVoiceAI',
        type: 'website',
        url: SITE_URL,
        images: [
            {
                url: `${SITE_URL}/og-image.png`,
                width: 1200,
                height: 630,
                alt: 'BuildVoiceAI - AI Voice Agents Platform',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'BuildVoiceAI - AI Voice Agents for Agencies & Businesses',
        description: 'Build AI voice agents from natural language descriptions. White-label platform for agencies.',
        images: [`${SITE_URL}/og-image.png`],
    },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {children}
        </div>
    );
}
