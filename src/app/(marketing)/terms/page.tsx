import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Terms of Service - BuildVoiceAI',
    description: 'BuildVoiceAI terms of service — the rules governing use of our platform.',
};

export default function TermsPage() {
    return (
        <main className="max-w-2xl mx-auto py-24 px-4 sm:px-6">
            <h1 className="text-3xl font-bold tracking-tight mb-8">Terms of Service</h1>
            <div className="prose prose-sm dark:prose-invert text-muted-foreground space-y-4">
                <p>
                    These terms of service are currently being finalized. By using BuildVoiceAI, you
                    agree to the following general terms:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>You will use the platform only for lawful purposes.</li>
                    <li>You are responsible for maintaining the security of your account credentials.</li>
                    <li>Voice agents must comply with applicable telemarketing and consent laws in your jurisdiction.</li>
                    <li>We reserve the right to suspend accounts that violate these terms.</li>
                </ul>
                <p>
                    Full terms will be published here shortly. For questions, contact us at{' '}
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
