'use client';

import { useInView } from '@/hooks/useInView';

const steps = [
    {
        label: 'Describe',
        description:
            'Tell the AI what your agent should say, who to transfer to, and how to handle edge cases. Plain English.',
        accent: 'border-blue-500 text-blue-600 dark:text-blue-400',
    },
    {
        label: 'Generate',
        description:
            'The platform writes the script, picks a voice, provisions a number, and configures your CRM connections.',
        accent: 'border-green-500 text-green-600 dark:text-green-400',
    },
    {
        label: 'Deploy',
        description:
            'Make a test call, tweak anything, go live. Your agent starts handling real calls in under 30 minutes.',
        accent: 'border-amber-500 text-amber-600 dark:text-amber-400',
    },
];

export function HowItWorksSection() {
    const { ref: headerRef, isInView: headerVisible } = useInView({ threshold: 0.2 });
    const { ref: stepsRef, isInView: stepsVisible } = useInView({ threshold: 0.1 });

    return (
        <section className="py-20 sm:py-28 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div ref={headerRef} className="mb-12">
                    <p
                        className={`text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 animate-on-scroll stagger-1 ${headerVisible ? 'is-visible' : ''}`}
                    >
                        How it works
                    </p>
                    <h2
                        className={`text-3xl sm:text-4xl font-bold tracking-tight animate-on-scroll stagger-2 ${headerVisible ? 'is-visible' : ''}`}
                    >
                        Three steps. No code.
                    </h2>
                </div>

                {/* Steps */}
                <div ref={stepsRef} className="space-y-6">
                    {steps.map((step, index) => (
                        <div
                            key={step.label}
                            className={`border-l-2 ${step.accent.split(' ')[0]} pl-6 py-4 animate-on-scroll stagger-${index + 1} ${stepsVisible ? 'is-visible' : ''}`}
                        >
                            <p
                                className={`text-sm font-semibold uppercase tracking-wide mb-1.5 ${step.accent.split(' ').slice(1).join(' ')}`}
                            >
                                {step.label}
                            </p>
                            <p className="text-base text-muted-foreground leading-relaxed">
                                {step.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
