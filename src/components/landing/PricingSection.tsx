import Link from 'next/link';
import { Button } from '@/components/ui/button';

const plans = [
    {
        name: 'Starter',
        description: 'One team, a few agents.',
        price: '$49',
        period: '/mo',
        features: [
            'Up to 3 voice agents',
            '500 minutes included',
            'Call analytics dashboard',
            'Email support',
        ],
        cta: 'Get Started',
        recommended: false,
    },
    {
        name: 'Growth',
        description: 'Growing teams and small agencies.',
        price: '$149',
        period: '/mo',
        features: [
            'Up to 15 voice agents',
            '2,000 minutes included',
            'CRM integrations (GHL, HubSpot)',
            'White-label client portal',
        ],
        cta: 'Get Started',
        recommended: true,
    },
    {
        name: 'Agency',
        description: 'Multiple clients, full control.',
        price: '$399',
        period: '/mo',
        features: [
            'Unlimited voice agents',
            '10,000 minutes included',
            'Full white-label platform',
            'API access & dedicated support',
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
                        Simple pricing
                    </h2>
                    <p className="mt-3 text-muted-foreground">
                        One plan per stage of growth.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`rounded-xl border p-6 flex flex-col ${
                                plan.recommended
                                    ? 'border-foreground/20 border-t-2 border-t-foreground'
                                    : 'border-border'
                            }`}
                        >
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold">{plan.name}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {plan.description}
                                </p>
                                <div className="mt-4">
                                    <span className="text-3xl font-bold">{plan.price}</span>
                                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                                </div>
                            </div>

                            <ul className="space-y-2 mb-6 flex-1">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="text-sm text-muted-foreground">
                                        {feature}
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
                    14-day trial on all plans.
                </p>
            </div>
        </section>
    );
}
