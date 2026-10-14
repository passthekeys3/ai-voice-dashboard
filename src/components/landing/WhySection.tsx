import { KeyRound, Layers, Infinity as InfinityIcon, CreditCard, FlaskConical, Sparkles } from 'lucide-react';

/**
 * Why agencies pick BuildVoiceAI. Concrete product facts only; no metrics or
 * testimonials until we have real ones to show.
 */
const reasons = [
    {
        icon: KeyRound,
        title: 'Your keys, your margins',
        description: 'On Self-Service plans, connect your own Retell AI, Vapi, Bland or ElevenLabs account and pay the provider directly. We don’t mark up your minutes.',
    },
    {
        icon: Layers,
        title: 'Four providers, one dashboard',
        description: 'Run Retell AI, Vapi, Bland and ElevenLabs side by side, and pick the best one for each client without rebuilding your workflows.',
    },
    {
        icon: InfinityIcon,
        title: 'Unlimited agents',
        description: 'Every plan is priced by the number of clients you serve, not by agent. Build as many agents per client as you need.',
    },
    {
        icon: CreditCard,
        title: 'Bill clients directly',
        description: 'On Growth and Agency plans, charge your clients through Stripe Connect from the same dashboard you build in.',
    },
    {
        icon: FlaskConical,
        title: 'Test before clients hear it',
        description: 'A/B test prompts on live calls, and on the Agency plan, run AI-generated test conversations against your agents before launch.',
    },
    {
        icon: Sparkles,
        title: 'Try it without signing up',
        description: 'The builder at the top of this page drafts a full agent (script, voice and settings) from your description. Start a trial when you like what you see. No credit card needed.',
    },
];

export function WhySection() {
    return (
        <section className="py-24 sm:py-32 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-16">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
                        Why BuildVoiceAI
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                        Built for agencies that run voice AI for clients
                    </h2>
                </div>
                <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
                    {reasons.map(({ icon: Icon, title, description }) => (
                        <div key={title} className="bg-background p-6 sm:p-8">
                            <Icon className="h-5 w-5 text-muted-foreground mb-4" aria-hidden="true" />
                            <h3 className="font-semibold mb-2">{title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
