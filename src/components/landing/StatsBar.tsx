'use client';

import { useInView } from '@/hooks/useInView';

const stats = [
    { value: '500K+', label: 'Calls handled' },
    { value: '200+', label: 'Agencies onboarded' },
    { value: '94%', label: 'Avg success rate' },
    { value: '30 min', label: 'Avg time to go live' },
];

export function StatsBar() {
    const { ref, isInView } = useInView({ threshold: 0.2 });

    return (
        <section ref={ref} className="py-16 sm:py-20 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12">
                    {stats.map((stat, index) => (
                        <div
                            key={stat.label}
                            className={`text-center animate-on-scroll stagger-${index + 1} ${isInView ? 'is-visible' : ''}`}
                        >
                            <p className="text-3xl sm:text-4xl font-bold tracking-tight">
                                {stat.value}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
