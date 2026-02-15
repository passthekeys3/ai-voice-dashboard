'use client';

import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInView } from '@/hooks/useInView';

export function FinalCTA() {
    const { ref, isInView } = useInView({ threshold: 0.2 });

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <section ref={ref} className="relative py-24 sm:py-32 px-4 sm:px-6 border-t border-border overflow-hidden">
            {/* Bottom-anchored gradient glow */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse 50% 60% at 50% 100%, oklch(0.55 0.15 264 / 8%), transparent)',
                }}
                aria-hidden="true"
            />

            <div className="relative z-10 max-w-2xl mx-auto text-center space-y-8">
                <p
                    className={`text-xs font-medium text-muted-foreground uppercase tracking-widest animate-on-scroll stagger-1 ${isInView ? 'is-visible' : ''}`}
                >
                    Get started
                </p>
                <h2
                    className={`text-4xl sm:text-5xl font-bold tracking-tight animate-on-scroll stagger-2 ${isInView ? 'is-visible' : ''}`}
                >
                    Describe your first agent
                </h2>
                <p
                    className={`text-muted-foreground text-lg animate-on-scroll stagger-3 ${isInView ? 'is-visible' : ''}`}
                >
                    The builder is free. See what it creates in 30 seconds.
                </p>
                <div className={`animate-on-scroll stagger-4 ${isInView ? 'is-visible' : ''}`}>
                    <Button
                        size="lg"
                        className="rounded-full px-8 h-12 text-base active:scale-[0.98] transition-[transform,background-color,box-shadow] duration-200"
                        onClick={scrollToTop}
                    >
                        Try the builder
                        <ArrowUp className="ml-1.5 h-4 w-4" />
                    </Button>
                </div>
                <p
                    className={`text-xs text-muted-foreground/60 animate-on-scroll stagger-5 ${isInView ? 'is-visible' : ''}`}
                >
                    Free to try. No credit card required.
                </p>
            </div>
        </section>
    );
}
