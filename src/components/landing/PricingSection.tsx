'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInView } from '@/hooks/useInView';
import { getAllTierConfigs, PLATFORM_PER_MINUTE_RATE } from '@/lib/billing/tiers';

type PlanType = 'self_service' | 'managed';

// Derive pricing from the single source of truth in tiers.ts
const TIER_CONFIGS = getAllTierConfigs();

// Landing-page-specific metadata per tier
const LANDING_META: Record<string, { cta: string; href: string; recommended: boolean }> = {
    starter: { cta: 'Get started', href: '/signup', recommended: false },
    growth: { cta: 'Get started', href: '/signup', recommended: true },
    agency: { cta: 'Get started', href: '/signup', recommended: false },
};

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
                        ? `Build and manage your own AI voice agents. Use your own API keys for flat-rate pricing, or our platform keys for $${PLATFORM_PER_MINUTE_RATE}/min.`
                        : `We build and manage your AI agents for you. All calls use our platform at $${PLATFORM_PER_MINUTE_RATE}/min.`}
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
                    {TIER_CONFIGS.map(({ tier, selfService, managed }, index) => {
                        const config = isSelfService ? selfService : managed;
                        const meta = LANDING_META[tier];
                        const displayPrice = isYearly ? config.yearlyMonthly : config.monthlyPrice;

                        return (
                            <div
                                key={`${tier}-${planType}`}
                                className={`
                                    relative rounded-xl border p-8 flex flex-col
                                    transition-all duration-200
                                    hover:-translate-y-1 hover:shadow-lg
                                    animate-on-scroll-scale
                                    ${gridVisible ? 'is-visible' : ''}
                                    ${meta.recommended
                                        ? 'border-foreground/20 shadow-sm'
                                        : 'border-border'
                                    }
                                `}
                                style={{
                                    animationDelay: `${index * 100}ms`,
                                    animationFillMode: 'both',
                                }}
                            >
                                {meta.recommended && (
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
                                    <h3 className="text-lg font-semibold">{config.displayName}</h3>
                                    <div className="mt-3">
                                        <span className="text-3xl font-bold">${displayPrice}</span>
                                        <span className="text-muted-foreground text-sm ml-1">/month</span>
                                    </div>
                                    {isYearly && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            ${config.yearlyPrice}/year — save ${config.monthlyPrice * 12 - config.yearlyPrice}
                                        </p>
                                    )}
                                    {!isSelfService && (
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                                            + ${PLATFORM_PER_MINUTE_RATE}/min for calls
                                        </p>
                                    )}
                                    {isSelfService && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            ${PLATFORM_PER_MINUTE_RATE}/min with platform keys
                                        </p>
                                    )}
                                </div>

                                {/* Client limit + overage */}
                                <div className="relative z-10 mb-4 p-3 bg-muted/30 rounded-lg text-sm">
                                    <p className="font-medium">{config.limits.maxClients} clients included</p>
                                    <p className="text-muted-foreground">${config.limits.additionalClientPrice}/additional client</p>
                                </div>

                                <div className="relative z-10 h-px bg-border mb-5" />

                                <ul className="relative z-10 space-y-2.5 mb-8 flex-1">
                                    {config.features.map((feature) => (
                                        <li key={feature} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    variant={meta.recommended ? 'default' : 'outline'}
                                    className="relative z-10 w-full rounded-full active:scale-[0.98] transition-[transform,background-color,box-shadow,border-color] duration-200"
                                    asChild
                                >
                                    <Link href={meta.href}>{meta.cta}</Link>
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
