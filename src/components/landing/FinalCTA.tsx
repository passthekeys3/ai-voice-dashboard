'use client';

import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FinalCTA() {
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <section className="py-24 sm:py-32 px-4 sm:px-6 border-t border-border">
            <div className="max-w-2xl mx-auto text-center space-y-8">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    Get started
                </p>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
                    Describe your first agent
                </h2>
                <p className="text-muted-foreground text-lg">
                    The builder is free. See what it creates in 30 seconds.
                </p>
                <Button size="lg" className="rounded-full px-8 h-12 text-base" onClick={scrollToTop}>
                    Try the builder
                    <ArrowUp className="ml-1.5 h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground/60">
                    Free to try. No credit card required.
                </p>
            </div>
        </section>
    );
}
