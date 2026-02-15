import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'BuildVoiceAI - AI Voice Agents for Agencies & Businesses',
    description:
        'Build AI voice agents from natural language descriptions. White-label platform for agencies. Manage calls, analytics, workflows, and phone numbers.',
    openGraph: {
        title: 'BuildVoiceAI - AI Voice Agents for Agencies & Businesses',
        description: 'Build AI voice agents from natural language descriptions.',
        siteName: 'BuildVoiceAI',
        type: 'website',
    },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {children}
        </div>
    );
}
