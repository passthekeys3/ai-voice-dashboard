import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ALL_SOLUTIONS } from '@/lib/marketing/solutions';

export function IndustriesSection() {
    return (
        <section className="py-24 sm:py-32 px-4 sm:px-6 bg-muted/30">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
                        Solutions
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                        Start from your industry
                    </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {ALL_SOLUTIONS.map((solution) => {
                        const Icon = solution.icon;
                        return (
                            <Link
                                key={solution.slug}
                                href={`/solutions/${solution.slug}`}
                                className="group flex flex-col rounded-xl border border-border bg-background p-5 hover:border-foreground/20 transition-colors"
                            >
                                <Icon className="h-5 w-5 text-muted-foreground mb-4" aria-hidden="true" />
                                <p className="font-semibold mb-1.5">{solution.name}</p>
                                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{solution.headline}</p>
                                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
                                    Learn more
                                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                </span>
                            </Link>
                        );
                    })}
                </div>
                <p className="text-center text-sm text-muted-foreground mt-8">
                    <Link href="/solutions" className="underline underline-offset-4 hover:text-foreground">
                        See all solutions
                    </Link>
                </p>
            </div>
        </section>
    );
}
