'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInView } from '@/hooks/useInView';

const byokPlans = [
    {
        name: 'Starter',
        description: 'For small, growing teams.',
        price: '$99',
        period: '/mo',
        billing: 'Billed monthly',
        features: [
            '3 Clients',
            '$15/client for additional clients',
            'Unlimited Agents',
            'AI Agent Builder',
            'Call Analytics Dashboard',
            'Workflow Automation',
            'Email Support',
        ],
        cta: 'Get started',
        href: '/signup',
        recommended: false,
    },
    {
        name: 'Growth',
        description: 'For scaling businesses.',
        price: '$249',
        period: '/mo',
        billing: 'Billed monthly',
        features: [
            '5 Clients',
            '$12/client for additional clients',
            'All Starter features',
            'CRM Integrations (GHL, HubSpot)',
            'Stripe Connect Billing',
            'Custom Domain',
        ],
        cta: 'Get started',
        href: '/signup',
        recommended: true,
        badge: 'Popular',
    },
    {
        name: 'Scale',
        description: 'For high-volume agencies.',
        price: '$499',
        period: '/mo',
        billing: 'Billed monthly',
        features: [
            '10 Clients',
            '$10/client for additional clients',
            'All features',
            'White-Label Platform',
            'API Access',
            'Priority Support',
        ],
        cta: 'Get started',
        href: '/signup',
        recommended: false,
    },
];

const managedPlan = {
    name: 'Managed',
    description: 'We build and run your AI voice agents for you.',
    price: '$999',
    period: '/mo',
    features: [
        'Unlimited managed agents',
        '3,000 minutes included',
        'Custom agent design & scripting',
        'Ongoing optimization & tuning',
        'CRM + workflow setup included',
        'Dedicated account manager',
        'Monthly performance reports',
    ],
    cta: 'Get started',
    href: '/signup?plan=managed',
};

export function PricingSection() {
    const { ref: headerRef, isInView: headerVisible } = useInView({ threshold: 0.2 });
    const { ref: gridRef, isInView: gridVisible } = useInView({ threshold: 0.1 });
    const { ref: managedRef, isInView: managedVisible } = useInView({ threshold: 0.1 });

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
                        Build it yourself or let us handle it
                    </h2>
                    <p
                        className={`mt-3 text-muted-foreground animate-on-scroll stagger-3 ${headerVisible ? 'is-visible' : ''}`}
                    >
                        Self-serve plans for teams who know AI, or a fully managed option if you don&apos;t.
                    </p>
                </div>

                {/* BYOK label */}
                <p
                    className={`text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4 animate-on-scroll stagger-2 ${gridVisible ? 'is-visible' : ''}`}
                >
                    Self-serve (Bring Your Own Keys)
                </p>

                {/* BYOK Cards grid */}
                <div ref={gridRef} className="grid gap-6 md:grid-cols-3">
                    {byokPlans.map((plan, index) => (
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
                                        {'badge' in plan && plan.badge ? plan.badge : 'Popular'}
                                    </span>
                                </>
                            )}

                            <div className="relative z-10 mb-6">
                                <h3 className="text-lg font-semibold">{plan.name}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {plan.description}
                                </p>
                                <div className="mt-4">
                                    <span className="text-3xl font-bold">{plan.price}</span>
                                    <span className="text-muted-foreground text-sm ml-1">{plan.period}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{plan.billing}</p>
                            </div>

                            <div className="relative z-10 h-px bg-border mb-6" />

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
                    className={`text-center text-sm text-muted-foreground/60 mt-6 animate-on-scroll stagger-4 ${gridVisible ? 'is-visible' : ''}`}
                >
                    14-day trial on all self-serve plans.
                </p>

                {/* Divider */}
                <div className="my-16 flex items-center gap-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* Managed label */}
                <p
                    className={`text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4 animate-on-scroll stagger-1 ${managedVisible ? 'is-visible' : ''}`}
                >
                    Done for you
                </p>

                {/* Managed card — full-width */}
                <div
                    ref={managedRef}
                    className={`
                        relative rounded-xl border border-foreground/20 p-8 md:p-10
                        transition-all duration-200
                        hover:-translate-y-1 hover:shadow-lg
                        animate-on-scroll-scale
                        ${managedVisible ? 'is-visible' : ''}
                    `}
                >
                    <div
                        className="absolute -inset-px rounded-xl bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent pointer-events-none"
                        aria-hidden="true"
                    />
                    <span className="absolute -top-3 left-6 bg-foreground text-background text-xs font-medium px-3 py-0.5 rounded-full z-10">
                        Fully managed
                    </span>

                    <div className="relative z-10 md:flex md:items-start md:gap-12">
                        {/* Left — info */}
                        <div className="md:flex-1 mb-8 md:mb-0">
                            <h3 className="text-lg font-semibold">{managedPlan.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-md">
                                {managedPlan.description}
                            </p>
                            <div className="mt-4">
                                <span className="text-3xl font-bold">{managedPlan.price}</span>
                                <span className="text-muted-foreground text-sm">{managedPlan.period}</span>
                            </div>
                            <Button
                                className="mt-6 rounded-full active:scale-[0.98] transition-[transform,background-color,box-shadow,border-color] duration-200"
                                asChild
                            >
                                <Link href={managedPlan.href}>{managedPlan.cta}</Link>
                            </Button>
                        </div>

                        {/* Right — features */}
                        <ul className="relative z-10 space-y-2.5 md:columns-2 md:gap-x-8">
                            {managedPlan.features.map((feature) => (
                                <li key={feature} className="text-sm text-muted-foreground flex items-center gap-2 break-inside-avoid">
                                    <Check className="h-4 w-4 shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
