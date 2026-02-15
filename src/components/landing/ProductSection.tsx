'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductSectionProps {
    label: string;
    headline: string;
    description: string;
    visual: 'builder' | 'analytics' | 'workflows' | 'portal';
    reverse?: boolean;
}

const screenshotMeta: Record<string, { src: string; alt: string; label: string }> = {
    builder: {
        src: '/screenshots/builder.png',
        alt: 'Agent builder interface showing conversational AI configuration',
        label: 'Agent Builder',
    },
    analytics: {
        src: '/screenshots/analytics.png',
        alt: 'Analytics dashboard with call volume charts and KPI cards',
        label: 'Analytics',
    },
    workflows: {
        src: '/screenshots/workflows.png',
        alt: 'Workflow automation editor with CRM integration actions',
        label: 'Workflows',
    },
    portal: {
        src: '/screenshots/portal.png',
        alt: 'White-labeled client portal with custom branding',
        label: 'Client Portal',
    },
};

function ScreenshotFrame({ visual }: { visual: string }) {
    const meta = screenshotMeta[visual];
    const [hasError, setHasError] = useState(false);

    return (
        <div className="rounded-xl border border-border overflow-hidden aspect-[16/10] relative bg-muted/30">
            {!hasError ? (
                <Image
                    src={meta.src}
                    alt={meta.alt}
                    fill
                    className="object-cover"
                    onError={() => setHasError(true)}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground/40">
                        {meta.label}
                    </span>
                </div>
            )}
        </div>
    );
}

export function ProductSection({ label, headline, description, visual, reverse }: ProductSectionProps) {
    return (
        <section className="py-20 sm:py-28 px-4 sm:px-6">
            <div className={`max-w-5xl mx-auto grid gap-12 lg:gap-16 items-center lg:grid-cols-2`}>
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
                    <ScreenshotFrame visual={visual} />
                </div>
            </div>
        </section>
    );
}
