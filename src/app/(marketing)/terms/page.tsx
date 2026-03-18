import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Terms of Service - BuildVoiceAI',
    description: 'BuildVoiceAI terms of service — the rules governing use of our platform.',
};

export default function TermsPage() {
    return (
        <main className="max-w-2xl mx-auto py-24 px-4 sm:px-6">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
            <p className="text-sm text-muted-foreground mb-8">Last updated: March 17, 2026</p>

            <div className="prose prose-sm dark:prose-invert text-muted-foreground space-y-6">
                <p>
                    These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the BuildVoiceAI platform
                    operated by BuildVoiceAI (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By
                    creating an account or using our service, you agree to be bound by these Terms.
                </p>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">1. Account Registration</h2>
                    <p>
                        You must provide accurate and complete information when creating an account.
                        You are responsible for maintaining the security of your account credentials
                        and for all activity that occurs under your account. You must notify us
                        immediately of any unauthorized use.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">2. Acceptable Use</h2>
                    <p>You agree to use BuildVoiceAI only for lawful purposes. You must not:</p>
                    <ul className="list-disc pl-4 sm:pl-5 space-y-2">
                        <li>Use the platform for spam, harassment, or fraudulent activity.</li>
                        <li>Attempt to gain unauthorized access to other accounts or our systems.</li>
                        <li>Reverse-engineer, decompile, or disassemble any part of the service.</li>
                        <li>Use the platform in any way that violates applicable laws or regulations.</li>
                        <li>Exceed reasonable usage limits or abuse API endpoints.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">3. Voice AI Compliance</h2>
                    <p>
                        You are solely responsible for ensuring that your use of AI voice agents
                        complies with all applicable laws, including but not limited to:
                    </p>
                    <ul className="list-disc pl-4 sm:pl-5 space-y-2">
                        <li>
                            <strong>Consent laws:</strong> Obtaining proper consent before making
                            automated calls, in accordance with the Telephone Consumer Protection Act
                            (TCPA), GDPR, and similar regulations in your jurisdiction.
                        </li>
                        <li>
                            <strong>Disclosure requirements:</strong> Clearly disclosing to call
                            recipients that they are speaking with an AI-powered agent where required
                            by law.
                        </li>
                        <li>
                            <strong>Do-not-call compliance:</strong> Honoring applicable do-not-call
                            registries and opt-out requests.
                        </li>
                        <li>
                            <strong>Recording consent:</strong> Obtaining required consent for call
                            recording in accordance with local one-party or two-party consent laws.
                        </li>
                        <li>
                            <strong>CRM integration authorization:</strong> When you connect a
                            third-party CRM (such as GoHighLevel or HubSpot), you authorize
                            BuildVoiceAI to read and write contacts, deals, and call activity in
                            your CRM account on your behalf. You are responsible for ensuring this
                            data sync complies with your own data handling obligations.
                        </li>
                    </ul>
                    <p>
                        BuildVoiceAI provides the tools — compliance with telemarketing and privacy
                        regulations is your responsibility.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">4. Intellectual Property</h2>
                    <p>
                        The BuildVoiceAI platform, including its design, code, and documentation, is
                        our intellectual property. You retain ownership of all data you upload or
                        generate through the platform, including call recordings, transcripts, agent
                        configurations, and client information.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">5. Payment &amp; Billing</h2>
                    <ul className="list-disc pl-4 sm:pl-5 space-y-2">
                        <li>Paid plans are billed on a recurring subscription basis.</li>
                        <li>Subscriptions automatically renew unless canceled before the next billing cycle.</li>
                        <li>You may cancel your subscription at any time from the billing settings page. Cancellation takes effect at the end of the current billing period.</li>
                        <li>Refunds are handled on a case-by-case basis. Contact us to discuss.</li>
                        <li>We reserve the right to change pricing with 30 days&apos; notice.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">6. Data &amp; Privacy</h2>
                    <p>
                        Your use of BuildVoiceAI is also governed by our{' '}
                        <Link href="/privacy" className="text-foreground underline">
                            Privacy Policy
                        </Link>
                        , which describes how we collect, use, and protect your data. By using the
                        platform, you consent to our data practices as described in the Privacy Policy.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">7. Service Availability</h2>
                    <p>
                        We strive to maintain high availability but do not guarantee uninterrupted
                        service. BuildVoiceAI is currently in beta, and we may perform maintenance,
                        updates, or changes that temporarily affect availability. We will make
                        reasonable efforts to notify you of planned downtime.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
                    <p>
                        To the maximum extent permitted by law, BuildVoiceAI shall not be liable for
                        any indirect, incidental, special, consequential, or punitive damages arising
                        from your use of the platform. Our total liability for any claim shall not
                        exceed the amount you paid us in the 12 months preceding the claim.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">9. Termination</h2>
                    <p>
                        Either party may terminate this agreement at any time. You may delete your
                        account from the settings page. We reserve the right to suspend or terminate
                        accounts that violate these Terms, with or without notice. Upon termination,
                        your data will be handled in accordance with our Privacy Policy.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">10. Changes to These Terms</h2>
                    <p>
                        We may update these Terms from time to time. When we make changes, we will
                        update the &ldquo;Last updated&rdquo; date at the top of this page. Continued
                        use of the service after changes constitutes acceptance of the updated Terms.
                        For material changes, we will make reasonable efforts to notify you via email
                        or in-app notification.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground">11. Contact Us</h2>
                    <p>
                        If you have questions about these Terms, contact us at{' '}
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
