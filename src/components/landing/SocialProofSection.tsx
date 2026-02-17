'use client';

import { Quote } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

const avatarColors = [
    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
];

const testimonials = [
    {
        quote: 'We replaced our entire call center with three voice agents. Setup took an afternoon — our CRM was syncing by dinner.',
        name: 'Rachel Simmons',
        role: 'Founder',
        company: 'Evergreen Home Services',
        metric: '40 hrs/month saved',
    },
    {
        quote: 'I white-labeled BuildVoiceAI for my agency clients in a day. They think we built it. The margin on this is unreal.',
        name: 'Marcus Tran',
        role: 'CEO',
        company: 'Leapfrog Digital',
        metric: '12 clients onboarded',
    },
    {
        quote: 'Our booking rate went from 30% to 68% once the AI agent started handling after-hours calls. It never misses a lead.',
        name: 'Sofia Gutierrez',
        role: 'Operations Director',
        company: 'Apex Dental Group',
        metric: '68% booking rate',
    },
];

function getInitials(name: string) {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('');
}

export function SocialProofSection() {
    const { ref: headerRef, isInView: headerVisible } = useInView({ threshold: 0.2 });
    const { ref: gridRef, isInView: gridVisible } = useInView({ threshold: 0.1 });

    return (
        <section className="py-24 sm:py-32 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                {/* Section header */}
                <div ref={headerRef} className="text-center mb-16">
                    <p
                        className={`text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 animate-on-scroll stagger-1 ${headerVisible ? 'is-visible' : ''}`}
                    >
                        Trusted by 200+ agencies
                    </p>
                    <h2
                        className={`text-3xl sm:text-4xl font-bold tracking-tight animate-on-scroll stagger-2 ${headerVisible ? 'is-visible' : ''}`}
                    >
                        Teams that switched never looked back
                    </h2>
                </div>

                {/* Testimonial cards */}
                <div ref={gridRef} className="grid gap-6 md:grid-cols-3">
                    {testimonials.map((t, index) => (
                        <div
                            key={t.name}
                            className={`
                                relative rounded-xl border border-border p-8 flex flex-col
                                transition-all duration-200
                                hover:-translate-y-1 hover:shadow-lg
                                animate-on-scroll-scale
                                ${gridVisible ? 'is-visible' : ''}
                            `}
                            style={{
                                animationDelay: `${index * 100}ms`,
                                animationFillMode: 'both',
                            }}
                        >
                            {/* Metric badge */}
                            {t.metric && (
                                <div className="mb-4">
                                    <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold text-foreground">
                                        {t.metric}
                                    </span>
                                </div>
                            )}

                            <Quote className="h-5 w-5 text-muted-foreground/40 mb-4 shrink-0" />

                            <blockquote className="text-[15px] leading-relaxed text-foreground mb-6 flex-1">
                                &ldquo;{t.quote}&rdquo;
                            </blockquote>

                            <div className="border-t border-border pt-4 flex items-center gap-3">
                                <div
                                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${avatarColors[index % avatarColors.length]}`}
                                >
                                    {getInitials(t.name)}
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{t.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {t.role}, {t.company}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
