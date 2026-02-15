import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
    {
        name: 'Starter',
        description: 'For businesses getting started with AI voice.',
        price: '$49',
        period: '/mo',
        features: [
            'Up to 3 voice agents',
            '500 minutes included',
            'Call analytics dashboard',
            'Basic workflow automations',
            'Email support',
        ],
        cta: 'Get Started',
        recommended: false,
    },
    {
        name: 'Growth',
        description: 'For growing teams and small agencies.',
        price: '$149',
        period: '/mo',
        features: [
            'Up to 15 voice agents',
            '2,000 minutes included',
            'Advanced analytics & exports',
            'CRM integrations (GHL, HubSpot)',
            'White-label client portal',
            'Custom domain support',
            'Priority support',
        ],
        cta: 'Get Started',
        recommended: true,
    },
    {
        name: 'Agency',
        description: 'For agencies managing multiple clients.',
        price: '$399',
        period: '/mo',
        features: [
            'Unlimited voice agents',
            '10,000 minutes included',
            'Full white-label platform',
            'Unlimited client portals',
            'A/B testing & experiments',
            'API access',
            'Dedicated account manager',
        ],
        cta: 'Contact Sales',
        recommended: false,
    },
];

export function PricingSection() {
    return (
        <section id="pricing" className="py-20 sm:py-28 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-14">
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        Pricing
                    </h2>
                    <p className="mt-3 text-muted-foreground">
                        Start free, scale as you grow.
                    </p>
                </div>

                <div className="grid gap-px md:grid-cols-3 border border-border rounded-lg overflow-hidden bg-border">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className="bg-card p-6 flex flex-col"
                        >
                            <div className="mb-6">
                                <div className="flex items-baseline gap-1">
                                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                                    {plan.recommended && (
                                        <span className="text-xs text-muted-foreground ml-1">&middot; Recommended</span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {plan.description}
                                </p>
                                <div className="mt-4">
                                    <span className="text-3xl font-bold">{plan.price}</span>
                                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                                </div>
                            </div>

                            <ul className="space-y-2.5 mb-6 flex-1">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2 text-sm">
                                        <Check className="h-4 w-4 text-foreground/40 mt-0.5 flex-shrink-0" />
                                        <span className="text-muted-foreground">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <Button
                                variant={plan.recommended ? 'default' : 'outline'}
                                className="w-full"
                                asChild
                            >
                                <Link href="/signup">{plan.cta}</Link>
                            </Button>
                        </div>
                    ))}
                </div>

                <p className="text-center text-sm text-muted-foreground mt-6">
                    All plans include a 14-day free trial. No credit card required.
                </p>
            </div>
        </section>
    );
}
