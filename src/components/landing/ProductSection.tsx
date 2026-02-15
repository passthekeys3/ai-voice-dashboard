'use client';

import { useInView } from '@/hooks/useInView';

interface ProductSectionProps {
    label: string;
    headline: string;
    description: string;
    visual: 'builder' | 'analytics' | 'workflows' | 'portal';
    reverse?: boolean;
}

function AppFrame({ visual }: { visual: ProductSectionProps['visual'] }) {
    return (
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
            {/* Minimal top bar */}
            <div className="h-8 border-b border-border bg-muted/30 flex items-center px-3 gap-2">
                <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-border" />
                    <div className="h-2 w-2 rounded-full bg-border" />
                    <div className="h-2 w-2 rounded-full bg-border" />
                </div>
                <div className="h-3 w-24 bg-border/50 rounded ml-2" />
            </div>

            {/* Content area */}
            <div className="flex min-h-[280px]">
                {/* Sidebar placeholder */}
                <div className="hidden sm:block w-44 border-r border-border bg-muted/20 p-3 space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-3 rounded ${i === (visual === 'builder' ? 0 : visual === 'analytics' ? 1 : visual === 'workflows' ? 2 : 3) ? 'w-full bg-foreground/10' : 'w-3/4 bg-border/40'}`}
                        />
                    ))}
                </div>

                {/* Main content */}
                <div className="flex-1 p-4">
                    {visual === 'builder' && <BuilderVisual />}
                    {visual === 'analytics' && <AnalyticsVisual />}
                    {visual === 'workflows' && <WorkflowsVisual />}
                    {visual === 'portal' && <PortalVisual />}
                </div>
            </div>
        </div>
    );
}

function BuilderVisual() {
    return (
        <div className="space-y-3">
            <div className="h-4 w-32 bg-foreground/8 rounded" />
            <div className="space-y-2">
                <div className="bg-muted/50 rounded-md p-2.5 max-w-[75%] ml-auto">
                    <div className="h-2.5 w-full bg-foreground/8 rounded" />
                    <div className="h-2.5 w-2/3 bg-foreground/8 rounded mt-1.5" />
                </div>
                <div className="bg-muted/30 rounded-md p-2.5 max-w-[80%]">
                    <div className="h-2.5 w-full bg-foreground/6 rounded" />
                    <div className="h-2.5 w-full bg-foreground/6 rounded mt-1.5" />
                    <div className="h-2.5 w-1/2 bg-foreground/6 rounded mt-1.5" />
                </div>
            </div>
            <div className="flex gap-2 mt-3">
                <div className="h-6 w-20 rounded bg-foreground/8" />
                <div className="h-6 w-20 rounded bg-foreground/8" />
            </div>
        </div>
    );
}

function AnalyticsVisual() {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                {['1,247', '94%', '4:32'].map((val) => (
                    <div key={val} className="rounded-md border border-border p-2">
                        <div className="h-2 w-12 bg-foreground/6 rounded mb-1.5" />
                        <div className="text-xs font-medium text-foreground/40">{val}</div>
                    </div>
                ))}
            </div>
            <div className="rounded-md border border-border p-3 h-32 flex items-end gap-1">
                {Array.from({ length: 14 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex-1 bg-foreground/8 rounded-t"
                        style={{ height: `${15 + Math.sin(i * 0.8) * 35 + i * 3}%` }}
                    />
                ))}
            </div>
        </div>
    );
}

function WorkflowsVisual() {
    return (
        <div className="space-y-2">
            <div className="h-4 w-28 bg-foreground/8 rounded" />
            {['When call ends', 'Create CRM contact', 'Book appointment', 'Send notification'].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[8px] ${i === 0 ? 'border-foreground/20 bg-foreground/5' : 'border-border'}`}>
                        {i + 1}
                    </div>
                    <div className="flex-1 border border-border rounded-md px-3 py-1.5">
                        <span className="text-xs text-muted-foreground">{step}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function PortalVisual() {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded bg-foreground/8" />
                <div className="h-3 w-24 bg-foreground/8 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-2">
                {['Calls', 'Agents', 'Analytics', 'Billing'].map((label) => (
                    <div key={label} className="rounded-md border border-border p-2.5">
                        <div className="text-[10px] text-muted-foreground/60 mb-1">{label}</div>
                        <div className="h-2.5 w-3/4 bg-foreground/6 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ProductSection({ label, headline, description, visual, reverse }: ProductSectionProps) {
    const { ref, isInView } = useInView();

    return (
        <section ref={ref} className="py-20 sm:py-28 px-4 sm:px-6">
            <div className={`max-w-5xl mx-auto grid gap-12 lg:gap-16 items-center lg:grid-cols-2 ${
                isInView ? 'opacity-100' : 'opacity-0'
            } transition-opacity duration-700`}>
                {/* Text */}
                <div className={`space-y-4 ${reverse ? 'lg:order-2' : ''}`}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                        {label}
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        {headline}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed max-w-md">
                        {description}
                    </p>
                </div>

                {/* Visual */}
                <div className={reverse ? 'lg:order-1' : ''}>
                    <AppFrame visual={visual} />
                </div>
            </div>
        </section>
    );
}
