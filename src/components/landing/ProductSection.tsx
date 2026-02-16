'use client';

import { useInView } from '@/hooks/useInView';
import { BuilderMockup } from './mockups/BuilderMockup';
import { AnalyticsMockup } from './mockups/AnalyticsMockup';
import { WorkflowsMockup } from './mockups/WorkflowsMockup';
import { PortalMockup } from './mockups/PortalMockup';

interface ProductSectionProps {
    label: string;
    headline: string;
    description: string;
    visual: 'builder' | 'analytics' | 'workflows' | 'portal';
    reverse?: boolean;
}

const visualAccent: Record<string, string> = {
    builder: 'from-blue-500/20 to-blue-500/0',
    analytics: 'from-green-500/20 to-green-500/0',
    workflows: 'from-amber-500/20 to-amber-500/0',
    portal: 'from-purple-500/20 to-purple-500/0',
};

function ProductVisual({ visual, isInView }: { visual: string; isInView: boolean }) {
    const accent = visualAccent[visual] || 'from-blue-500/20 to-blue-500/0';

    return (
        <div className="relative group">
            {/* Gradient glow on hover */}
            <div
                className={`absolute -inset-px rounded-xl bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm`}
                aria-hidden="true"
            />
            <div className="relative rounded-xl border border-border overflow-hidden bg-muted/30">
                {visual === 'builder' && <BuilderMockup isInView={isInView} />}
                {visual === 'analytics' && <AnalyticsMockup isInView={isInView} />}
                {visual === 'workflows' && <WorkflowsMockup isInView={isInView} />}
                {visual === 'portal' && <PortalMockup isInView={isInView} />}
            </div>
        </div>
    );
}

export function ProductSection({ label, headline, description, visual, reverse }: ProductSectionProps) {
    const { ref, isInView } = useInView({ threshold: 0.15 });

    const textAnim = reverse ? 'animate-on-scroll-right' : 'animate-on-scroll-left';
    const visualAnim = reverse ? 'animate-on-scroll-left' : 'animate-on-scroll-right';

    return (
        <section ref={ref} className="py-20 sm:py-28 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto grid gap-12 lg:gap-16 items-center lg:grid-cols-2">
                {/* Text */}
                <div className={`space-y-4 ${reverse ? 'lg:order-2' : ''}`}>
                    <p
                        className={`text-xs font-medium text-muted-foreground uppercase tracking-widest ${textAnim} stagger-1 ${isInView ? 'is-visible' : ''}`}
                    >
                        {label}
                    </p>
                    <h2
                        className={`text-3xl sm:text-4xl font-bold tracking-tight ${textAnim} stagger-2 ${isInView ? 'is-visible' : ''}`}
                    >
                        {headline}
                    </h2>
                    <p
                        className={`text-muted-foreground leading-relaxed max-w-md ${textAnim} stagger-3 ${isInView ? 'is-visible' : ''}`}
                    >
                        {description}
                    </p>
                </div>

                {/* Visual */}
                <div
                    className={`${reverse ? 'lg:order-1' : ''} ${visualAnim} stagger-2 ${isInView ? 'is-visible' : ''}`}
                >
                    <ProductVisual visual={visual} isInView={isInView} />
                </div>
            </div>
        </section>
    );
}
