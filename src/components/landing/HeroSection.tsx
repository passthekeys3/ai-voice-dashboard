'use client';

import { useInView } from '@/hooks/useInView';
import { AgentPreviewDemo } from './AgentPreviewDemo';

export function HeroSection() {
    const { ref, isInView } = useInView({ threshold: 0.1 });

    return (
        <section
            ref={ref}
            className="relative flex flex-col items-center justify-center px-4 pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden"
        >
            {/* Gradient mesh glow */}
            <div className="hero-glow absolute inset-0 pointer-events-none" aria-hidden="true" />

            {/* Subtle dot grid */}
            <div className="landing-grid-bg absolute inset-0 pointer-events-none opacity-40" aria-hidden="true" />

            <div className="relative z-10 max-w-2xl mx-auto text-center space-y-4 mb-12">
                <h1
                    className={`text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight animate-on-scroll stagger-1 ${isInView ? 'is-visible' : ''}`}
                >
                    What should your voice agent do?
                </h1>
                <p
                    className={`text-lg text-muted-foreground animate-on-scroll stagger-2 ${isInView ? 'is-visible' : ''}`}
                >
                    Describe it in plain English. We&apos;ll build the rest.
                </p>
            </div>

            <div
                className={`relative z-10 w-full max-w-2xl mx-auto animate-on-scroll-scale stagger-3 ${isInView ? 'is-visible' : ''}`}
            >
                <AgentPreviewDemo />
            </div>
        </section>
    );
}
