import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Privacy Policy - BuildVoiceAI',
    description: 'BuildVoiceAI privacy policy — how we collect, use, and protect your data.',
    alternates: { canonical: 'https://buildvoiceai.com/privacy' },
    robots: { index: true, follow: true },
};

export default function PrivacyPage() {
    return (
        <main className="max-w-2xl mx-auto py-24 px-4 sm:px-6">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mb-8">Last updated: March 17, 2026</p>

            <div className="prose prose-sm dark:prose-invert text-muted-foreground space-y-6">
                <p>
                    BuildVoiceAI (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the BuildVoiceAI
                    platform. This Privacy Policy explains how we collect, use, store, and protect your
                    information when you use our service.
                </p>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
                    <ul className="list-disc pl-4 sm:pl-5 space-y-2">
                        <li>
                            <strong>Account Information:</strong> Name, email address, and organization
                            details provided during registration.
                        </li>
                        <li>
                            <strong>Voice Call Data:</strong> Call recordings, transcripts, metadata
                            (duration, timestamps, status), and analytics generated through your
                            connected voice providers.
                        </li>
                        <li>
                            <strong>Usage Data:</strong> Pages visited, features used, and interaction
                            patterns within the dashboard to help us improve the product.
                        </li>
                        <li>
                            <strong>Payment Information:</strong> Billing details are processed securely
                            by Stripe. We never store credit card numbers, CVVs, or full bank account
                            details on our servers.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Data</h2>
                    <ul className="list-disc pl-4 sm:pl-5 space-y-2">
                        <li>Provide, maintain, and improve the BuildVoiceAI platform.</li>
                        <li>Sync and display agent, call, and phone number data from your voice providers.</li>
                        <li>Generate analytics and reports for your dashboard.</li>
                        <li>Process billing and manage your subscription.</li>
                        <li>Send transactional emails (welcome, trial reminders, payment receipts).</li>
                        <li>Respond to support requests and feedback.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">3. Data Storage &amp; Security</h2>
                    <p>
                        Your data is stored in a PostgreSQL database hosted by Supabase with encryption
                        at rest and in transit. We enforce row-level security (RLS) policies to ensure
                        strict tenant isolation — each agency&apos;s data is accessible only to authorized
                        users within that agency.
                    </p>
                    <p>
                        All connections to our service use HTTPS/TLS encryption. Access to production
                        systems is restricted and monitored.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">4. Third-Party Services</h2>
                    <p>We use the following third-party services to operate the platform:</p>
                    <ul className="list-disc pl-4 sm:pl-5 space-y-2">
                        <li><strong>Stripe</strong> — Payment processing and subscription management.</li>
                        <li><strong>Resend</strong> — Transactional email delivery.</li>
                        <li><strong>Retell AI, Vapi, Bland</strong> — Voice provider integrations (you connect your own accounts).</li>
                        <li><strong>GoHighLevel, HubSpot</strong> — CRM integrations for syncing contacts, deals, and call activity (you authorize access via OAuth).</li>
                        <li><strong>Vercel</strong> — Application hosting and serverless infrastructure.</li>
                        <li><strong>Sentry</strong> — Error monitoring and performance tracking.</li>
                    </ul>
                    <p>
                        Each third-party service processes data in accordance with their own privacy
                        policies. We only share the minimum data necessary for each service to function.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">5. AI-Powered Calls</h2>
                    <p>
                        BuildVoiceAI enables you to deploy AI-powered voice agents that make and receive
                        phone calls on your behalf. Call recordings, transcripts, and metadata are collected
                        and stored as described in this policy. You are responsible for disclosing to call
                        recipients that they are interacting with an AI agent where required by applicable
                        law (see our{' '}
                        <Link href="/terms" className="text-foreground underline">
                            Terms of Service
                        </Link>
                        {' '}for compliance obligations).
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">6. Data Retention</h2>
                    <p>
                        We retain your call data, agent configurations, and account information for as
                        long as your account is active. When you close your account or request deletion,
                        we remove your data from our production systems within 30 days. Backups may
                        retain data for up to 90 days after deletion before being purged.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">7. Your Rights</h2>
                    <p>You have the right to:</p>
                    <ul className="list-disc pl-4 sm:pl-5 space-y-2">
                        <li><strong>Access</strong> the personal data we hold about you.</li>
                        <li><strong>Correct</strong> inaccurate or incomplete information.</li>
                        <li><strong>Delete</strong> your account and associated data.</li>
                        <li><strong>Export</strong> your data in a portable format.</li>
                    </ul>
                    <p>
                        To exercise any of these rights, contact us at the email address below.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">8. Cookies</h2>
                    <p>
                        We use essential cookies for authentication and session management. We do not
                        use third-party advertising or tracking cookies.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">9. Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy from time to time. When we make changes, we
                        will update the &ldquo;Last updated&rdquo; date at the top of this page. Continued
                        use of the service after changes constitutes acceptance of the updated policy.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">10. Contact Us</h2>
                    <p>
                        If you have questions about this Privacy Policy or our data practices, contact
                        us at{' '}
                        <a href="mailto:hello@buildvoiceai.com" className="text-foreground underline">
                            hello@buildvoiceai.com
                        </a>
                        .
                    </p>
                </section>
            </div>

            <div className="mt-12">
                <Link href="/landing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    &larr; Back to home
                </Link>
            </div>
        </main>
    );
}
