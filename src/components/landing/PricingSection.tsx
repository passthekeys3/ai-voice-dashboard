'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInView } from '@/hooks/useInView';

type PlanType = 'self_service' | 'managed';

interface PlanConfig {
    name: string;
    selfServicePrice: number;
    managedPrice: number;
    selfServiceYearlyMonthly: number;
    managedYearlyMonthly: number;
    selfServiceYearlyTotal: number;
    managedYearlyTotal: number;
    includedClients: number;
    selfServiceOverage: number;
    managedOverage: number;
    selfServiceFeatures: string[];
    managedFeatures: string[];
    cta: string;
    href: string;
    recommended: boolean;
}

const PER_MINUTE_RATE = 0.15;

const plans: PlanConfig[] = [
    {
        name: 'Starter',
        selfServicePrice: 67,
        managedPrice: 97,
        selfServiceYearlyMonthly: 56,
        managedYearlyMonthly: 81,
        selfServiceYearlyTotal: 670,
        managedYearlyTotal: 970,
        includedClients: 3,
        selfServiceOverage: 15,
        managedOverage: 20,
        selfServiceFeatures: [
            '3 Clients included',
            'Unlimited agents',
            'AI Agent Builder',
            'Custom domain',
            'Call analytics',
            'Workflow automation',
            'Email support',
        ],
        managedFeatures: [
            '3 Clients included',
            'Done-for-you agent setup',
            'AI Agent Builder',
            'Custom domain',
            'Call analytics',
            'Workflow automation',
            'Priority support',
        ],
        cta: 'Get started',
        href: '/signup',
        recommended: false,
    },
    {
        name: 'Growth',
        selfServicePrice: 147,
        managedPrice: 197,
        selfServiceYearlyMonthly: 123,
        managedYearlyMonthly: 164,
        selfServiceYearlyTotal: 1470,
        managedYearlyTotal: 1970,
        includedClients: 10,
        selfServiceOverage: 12,
        managedOverage: 17,
        selfServiceFeatures: [
            '10 Clients included',
            'All Starter features',
            'CRM integrations (GHL + HubSpot)',
            'Stripe Connect client billing',
        ],
        managedFeatures: [
            '10 Clients included',
            'All Starter features',
            'Done-for-you integrations',
            'CRM integrations (GHL + HubSpot)',
            'Stripe Connect client billing',
        ],
        cta: 'Get started',
        href: '/signup',
        recommended: true,
    },
    {
        name: 'Agency',
        selfServicePrice: 297,
        managedPrice: 397,
        selfServiceYearlyMonthly: 248,
        managedYearlyMonthly: 331,
        selfServiceYearlyTotal: 2970,
        managedYearlyTotal: 3970,
        includedClients: 25,
        selfServiceOverage: 10,
        managedOverage: 15,
        selfServiceFeatures: [
            '25 Clients included',
            'All features',
            'White-label platform',
            'API access',
            'Priority support',
        ],
        managedFeatures: [
            '25 Clients included',
            'All features',
            'Done-for-you white-label setup',
            'API access',
            'Dedicated support',
        ],
        cta: 'Get started',
        href: '/signup',
        recommended: false,
    },
];

export function PricingSection() {
    const [isYearly, setIsYearly] = useState(false);
    const [planType, setPlanType] = useState<PlanType>('self_service');
    const { ref: headerRef, isInView: headerVisible } = useInView({ threshold: 0.2 });
    const { ref: gridRef, isInView: gridVisible } = useInView({ threshold: 0.1 });

    const isSelfService = planType === 'self_service';

    return (
        <section id="pricing" className="py-24 sm:py-32 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                {/* Section header */}
                <div ref={headerRef} className="text-center mb-10">
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
                </div>

                {/* Plan type toggle */}
                <div className={`flex justify-center animate-on-scroll stagger-3 ${headerVisible ? 'is-visible' : ''}`}>
                    <div className="inline-flex items-center gap-1 rounded-full border bg-muted/50 p-1">
                        <button
                            onClick={() => setPlanType('self_service')}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                                isSelfService
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Self-Service
                        </button>
                        <button
                            onClick={() => setPlanType('managed')}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                                !isSelfService
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Managed
                        </button>
                    </div>
                </div>

                {/* Plan type description */}
                <p className={`text-center text-sm text-muted-foreground max-w-lg mx-auto mt-4 mb-6 animate-on-scroll stagger-3 ${headerVisible ? 'is-visible' : ''}`}>
                    {isSelfService
                        ? 'Build and manage your own AI voice agents. Use your own API keys for flat-rate pricing, or our platform keys for $0.15/min.'
                        : 'We build and manage your AI agents for you. All calls use our platform at $0.15/min.'}
                </p>

                {/* Billing toggle */}
                <div className={`flex justify-center mb-12 animate-on-scroll stagger-3 ${headerVisible ? 'is-visible' : ''}`}>
                    <div className="inline-flex items-center gap-1 rounded-full border bg-muted/50 p-1">
                        <button
                            onClick={() => setIsYearly(false)}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                                !isYearly
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setIsYearly(true)}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                                isYearly
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Yearly
                        </button>
                        <span className="ml-1 mr-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-2 py-0.5">
                            -2 months
                        </span>
                    </div>
                </div>

                {/* Plan cards */}
                <div ref={gridRef} className="grid gap-6 md:grid-cols-3">
                    {plans.map((plan, index) => {
                        const monthlyPrice = isSelfService ? plan.selfServicePrice : plan.managedPrice;
                        const yearlyMonthly = isSelfService ? plan.selfServiceYearlyMonthly : plan.managedYearlyMonthly;
                        const yearlyTotal = isSelfService ? plan.selfServiceYearlyTotal : plan.managedYearlyTotal;
                        const displayPrice = isYearly ? yearlyMonthly : monthlyPrice;
                        const overageRate = isSelfService ? plan.selfServiceOverage : plan.managedOverage;
                        const features = isSelfService ? plan.selfServiceFeatures : plan.managedFeatures;

                        return (
                            <div
                                key={`${plan.name}-${planType}`}
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
                                            Popular
                                        </span>
                                    </>
                                )}

                                <div className="relative z-10 pb-4">
                                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                                    <div className="mt-3">
                                        <span className="text-3xl font-bold">${displayPrice}</span>
                                        <span className="text-muted-foreground text-sm ml-1">/month</span>
                                    </div>
                                    {isYearly && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            ${yearlyTotal}/year — save ${monthlyPrice * 12 - yearlyTotal}
                                        </p>
                                    )}
                                    {!isSelfService && (
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                                            + ${PER_MINUTE_RATE}/min for calls
                                        </p>
                                    )}
                                    {isSelfService && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            ${PER_MINUTE_RATE}/min with platform keys
                                        </p>
                                    )}
                                </div>

                                {/* Client limit + overage */}
                                <div className="relative z-10 mb-4 p-3 bg-muted/30 rounded-lg text-sm">
                                    <p className="font-medium">{plan.includedClients} clients included</p>
                                    <p className="text-muted-foreground">${overageRate}/additional client</p>
                                </div>

                                <div className="relative z-10 h-px bg-border mb-5" />

                                <ul className="relative z-10 space-y-2.5 mb-8 flex-1">
                                    {features.map((feature) => (
                                        <li key={feature} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
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
                        );
                    })}
                </div>

                <p
                    className={`text-center text-sm text-muted-foreground/60 mt-6 animate-on-scroll stagger-4 ${gridVisible ? 'is-visible' : ''}`}
                >
                    14-day trial on all plans · Pay yearly and save 2 months
                </p>
            </div>
        </section>
    );
}
