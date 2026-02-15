'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInView } from '@/hooks/useInView';

const plans = [
    {
        name: 'Starter',
        description: 'For businesses getting started with AI voice.',
        price: '$49',
        period: '/month',
        features: [
            'Up to 3 voice agents',
            '500 minutes included',
            'Call analytics dashboard',
            'Basic workflow automations',
            'Email support',
        ],
        cta: 'Get Started',
        highlighted: false,
    },
    {
        name: 'Growth',
        description: 'For growing teams and small agencies.',
        price: '$149',
        period: '/month',
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
        highlighted: true,
    },
    {
        name: 'Agency',
        description: 'For agencies managing multiple clients.',
        price: '$399',
        period: '/month',
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
        highlighted: false,
    },
];

export function PricingSection() {
    const { ref, isInView } = useInView();

    return (
        <section id="pricing" className="py-24 px-4 sm:px-6 bg-muted/30">
            <div ref={ref} className="max-w-6xl mx-auto">
                <div className={`text-center mb-16 transition-all duration-700 ${isInView ? 'animate-fade-up' : 'opacity-0'}`}>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        Simple, transparent pricing
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                        Start free, scale as you grow. No hidden fees.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-3 items-start">
                    {plans.map((plan, index) => (
                        <Card
                            key={plan.name}
                            className={`relative transition-all duration-700 ${
                                plan.highlighted
                                    ? 'border-violet-500 shadow-lg shadow-violet-500/10 scale-[1.02]'
                                    : ''
                            } ${isInView ? 'animate-fade-up' : 'opacity-0'}`}
                            style={{ animationDelay: isInView ? `${index * 100}ms` : undefined }}
                        >
                            {plan.highlighted && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-violet-600 text-white hover:bg-violet-600">
                                        Most Popular
                                    </Badge>
                                </div>
                            )}
                            <CardContent className="p-6 pt-8">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {plan.description}
                                    </p>
                                    <div className="mt-4">
                                        <span className="text-4xl font-bold">{plan.price}</span>
                                        <span className="text-muted-foreground">{plan.period}</span>
                                    </div>
                                </div>

                                <ul className="space-y-3 mb-6">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    className={`w-full ${
                                        plan.highlighted
                                            ? 'bg-violet-600 hover:bg-violet-700 text-white'
                                            : ''
                                    }`}
                                    variant={plan.highlighted ? 'default' : 'outline'}
                                    asChild
                                >
                                    <Link href="/signup">{plan.cta}</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <p className="text-center text-sm text-muted-foreground mt-8">
                    All plans include a 14-day free trial. No credit card required.
                </p>
            </div>
        </section>
    );
}
