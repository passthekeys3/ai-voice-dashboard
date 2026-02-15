'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInView } from '@/hooks/useInView';

export function FinalCTA() {
    const { ref, isInView } = useInView();

    return (
        <section className="py-24 px-4 sm:px-6">
            <div
                ref={ref}
                className={`max-w-4xl mx-auto text-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 p-12 sm:p-16 shadow-xl shadow-violet-500/20 transition-all duration-700 ${
                    isInView ? 'animate-scale-in' : 'opacity-0'
                }`}
            >
                <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    Ready to build your first voice agent?
                </h2>
                <p className="mt-4 text-lg text-violet-100 max-w-xl mx-auto">
                    Join hundreds of businesses using BuildVoiceAI to automate calls, qualify leads,
                    and delight customers.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                    <Button
                        size="lg"
                        className="bg-white text-violet-700 hover:bg-violet-50 font-semibold shadow-lg"
                        asChild
                    >
                        <Link href="/signup">
                            Get started free
                            <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Link>
                    </Button>
                    <Button
                        size="lg"
                        variant="outline"
                        className="border-white/30 text-white hover:bg-white/10 hover:text-white"
                        asChild
                    >
                        <Link href="#features">Learn more</Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}
