import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FinalCTA() {
    return (
        <section className="py-20 sm:py-28 px-4 sm:px-6">
            <div className="max-w-2xl mx-auto text-center space-y-6">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    Start building for free
                </h2>
                <p className="text-muted-foreground">
                    Deploy your first voice agent in under five minutes. No credit card required.
                </p>
                <Button size="lg" asChild>
                    <Link href="/signup">
                        Get started
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                </Button>
            </div>
        </section>
    );
}
