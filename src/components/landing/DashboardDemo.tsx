'use client';

import { useInView } from '@/hooks/useInView';
import { DashboardDemoContent } from './DashboardDemoContent';

export function DashboardDemo() {
    const { ref, isInView } = useInView({ threshold: 0.1 });

    return (
        <section ref={ref} className="py-20 sm:py-28 px-4 sm:px-6 relative">
            {/* Ambient glow behind the frame */}
            <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/4 w-[80%] h-[60%] pointer-events-none demo-frame-glow"
                style={{
                    background:
                        'radial-gradient(ellipse 70% 50% at 50% 50%, oklch(0.55 0.15 264 / 8%), transparent 70%)',
                }}
                aria-hidden="true"
            />

            {/* Section headline */}
            <div className="text-center max-w-2xl mx-auto mb-12 relative z-10">
                <p
                    className={`text-xs font-medium text-muted-foreground uppercase tracking-widest animate-on-scroll stagger-1 ${isInView ? 'is-visible' : ''}`}
                >
                    Dashboard
                </p>
                <h2
                    className={`text-3xl sm:text-4xl font-bold tracking-tight mt-3 animate-on-scroll stagger-2 ${isInView ? 'is-visible' : ''}`}
                >
                    Your command center, at a glance
                </h2>
                <p
                    className={`text-muted-foreground mt-3 animate-on-scroll stagger-3 ${isInView ? 'is-visible' : ''}`}
                >
                    Real-time analytics, call transcripts, and agent performance — all in one view.
                </p>
            </div>

            {/* App window frame */}
            <div
                className={`relative z-10 max-w-5xl mx-auto animate-on-scroll-scale stagger-3 ${isInView ? 'is-visible' : ''}`}
            >
                <div className="rounded-xl border border-border/50 shadow-2xl shadow-black/[0.08] dark:shadow-black/[0.3] overflow-hidden">
                    {/* Traffic light dots bar */}
                    <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/80 border-b border-border/50">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                    </div>

                    {/* Dashboard content */}
                    <DashboardDemoContent isInView={isInView} />
                </div>
            </div>
        </section>
    );
}
