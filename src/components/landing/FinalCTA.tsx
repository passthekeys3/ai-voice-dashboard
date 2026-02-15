'use client';

import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FinalCTA() {
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <section className="py-20 sm:py-28 px-4 sm:px-6">
            <div className="max-w-2xl mx-auto text-center space-y-6">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    Describe your first agent
                </h2>
                <p className="text-muted-foreground">
                    The builder is free. See what it creates in 30 seconds.
                </p>
                <Button size="lg" onClick={scrollToTop}>
                    Try the builder
                    <ArrowUp className="ml-1.5 h-4 w-4" />
                </Button>
            </div>
        </section>
    );
}
