'use client';

import { MessageSquare, Settings, Rocket } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

const steps = [
    {
        number: '1',
        icon: MessageSquare,
        title: 'Describe',
        description:
            'Tell us what your voice agent should do in plain English. Our AI understands industry context and best practices.',
    },
    {
        number: '2',
        icon: Settings,
        title: 'Customize',
        description:
            'Fine-tune the system prompt, pick a voice that matches your brand, and connect your CRM and calendar integrations.',
    },
    {
        number: '3',
        icon: Rocket,
        title: 'Deploy',
        description:
            'Assign a phone number and your agent starts handling calls immediately. Monitor performance from the dashboard.',
    },
];

export function HowItWorksSection() {
    const { ref, isInView } = useInView();

    return (
        <section id="how-it-works" className="py-24 px-4 sm:px-6 bg-muted/30">
            <div ref={ref} className="max-w-5xl mx-auto">
                <div className={`text-center mb-16 transition-all duration-700 ${isInView ? 'animate-fade-up' : 'opacity-0'}`}>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        Three steps to your first voice agent
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                        Go from idea to live phone agent in under five minutes.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-3 relative">
                    {/* Connecting line (desktop only) */}
                    <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px border-t-2 border-dashed border-violet-200 dark:border-violet-800" />

                    {steps.map((step, index) => (
                        <div
                            key={step.title}
                            className={`relative text-center transition-all duration-700 ${
                                isInView ? 'animate-fade-up' : 'opacity-0'
                            }`}
                            style={{ animationDelay: isInView ? `${index * 150}ms` : undefined }}
                        >
                            {/* Step number circle */}
                            <div className="relative z-10 mx-auto mb-6 h-14 w-14 rounded-full bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                <step.icon className="h-6 w-6 text-white" />
                            </div>

                            <div className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">
                                Step {step.number}
                            </div>
                            <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                                {step.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
