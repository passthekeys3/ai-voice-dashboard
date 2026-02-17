'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInView } from '@/hooks/useInView';

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
        cta: 'Get started',
        href: '/signup',
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
        cta: 'Get started',
        href: '/signup',
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
        cta: 'Contact sales',
        href: 'mailto:hello@buildvoiceai.com',
        recommended: false,
    },
];

export function PricingSection() {
    const { ref: headerRef, isInView: headerVisible } = useInView({ threshold: 0.2 });
    const { ref: gridRef, isInView: gridVisible } = useInView({ threshold: 0.1 });

    return (
        <section id="pricing" className="py-24 sm:py-32 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                {/* Section header */}
                <div ref={headerRef} className="text-center mb-16">
                    <p
                        className={`text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 animate-on-scroll stagger-1 ${headerVisible ? 'is-visible' : ''}`}
                    >
                        Pricing
                    </p>
                    <h2
                        className={`text-3xl sm:text-4xl font-bold tracking-tight animate-on-scroll stagger-2 ${headerVisible ? 'is-visible' : ''}`}
                    >
                        Simple pricing
                    </h2>
                    <p
                        className={`mt-3 text-muted-foreground animate-on-scroll stagger-3 ${headerVisible ? 'is-visible' : ''}`}
                    >
                        One plan per stage of growth.
                    </p>
                </div>

                {/* Cards grid */}
                <div ref={gridRef} className="grid gap-6 md:grid-cols-3">
                    {plans.map((plan, index) => (
                        <div
                            key={plan.name}
                            className={`
                                relative rounded-xl border p-8 flex flex-col
                                transition-all duration-200
                                hover:-translate-y-1 hover:shadow-lg
                                animate-on-scroll-scale
                                ${gridVisible ? 'is-visible' : ''}
                                ${plan.recommended
                                    ? 'border-foreground/20 shadow-sm'
                                    : 'border-border'
                                }
                            `}
                            style={{
                                animationDelay: `${index * 100}ms`,
                                animationFillMode: 'both',
                            }}
                        >
                            {plan.recommended && (
                                <>
                                    <div
                                        className="absolute -inset-px rounded-xl bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent pointer-events-none"
                                        aria-hidden="true"
                                    />
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-medium px-3 py-0.5 rounded-full z-10">
                                        Recommended
                                    </span>
                                </>
                            )}

                            <div className="relative z-10 mb-8">
                                <h3 className="text-lg font-semibold">{plan.name}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {plan.description}
                                </p>
                                <div className="mt-4">
                                    <span className="text-3xl font-bold">{plan.price}</span>
                                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                                </div>
                            </div>

                            <ul className="relative z-10 space-y-2.5 mb-8 flex-1">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Check className="h-4 w-4 shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <Button
                                variant={plan.recommended ? 'default' : 'outline'}
                                className="relative z-10 w-full rounded-full active:scale-[0.98] transition-[transform,background-color,box-shadow,border-color] duration-200"
                                asChild
                            >
                                <Link href={plan.href}>{plan.cta}</Link>
                            </Button>
                        </div>
                    ))}
                </div>

                <p
                    className={`text-center text-sm text-muted-foreground/60 mt-10 animate-on-scroll stagger-4 ${gridVisible ? 'is-visible' : ''}`}
                >
                    14-day trial on all plans.
                </p>
            </div>
        </section>
    );
}
