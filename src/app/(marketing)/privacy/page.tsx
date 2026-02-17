import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Privacy Policy - BuildVoiceAI',
    description: 'BuildVoiceAI privacy policy — how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
    return (
        <main className="max-w-2xl mx-auto py-24 px-4 sm:px-6">
            <h1 className="text-3xl font-bold tracking-tight mb-8">Privacy Policy</h1>
            <div className="prose prose-sm dark:prose-invert text-muted-foreground space-y-4">
                <p>
                    This privacy policy is currently being finalized. We are committed to protecting
                    your personal information and being transparent about how we handle your data.
                </p>
                <p>
                    In the meantime, here is what you should know:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>All data is encrypted at rest and in transit.</li>
                    <li>Call recordings and transcripts are scoped per account with row-level security.</li>
                    <li>We never share your data with third parties or use it to train AI models.</li>
                    <li>You can request data deletion at any time by contacting us.</li>
                </ul>
                <p>
                    For questions about our privacy practices, contact us at{' '}
                    <a href="mailto:hello@buildvoiceai.com" className="text-foreground underline">
                        hello@buildvoiceai.com
                    </a>
                    .
                </p>
            </div>
            <div className="mt-12">
                <Link href="/landing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    &larr; Back to home
                </Link>
            </div>
        </main>
    );
}
