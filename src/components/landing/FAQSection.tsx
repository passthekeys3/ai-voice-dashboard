'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useInView } from '@/hooks/useInView';
import { faqs } from './faq-data';

function FAQItem({
    faq,
    index,
    isOpen,
    onToggle,
    isInView,
}: {
    faq: { question: string; answer: string };
    index: number;
    isOpen: boolean;
    onToggle: () => void;
    isInView: boolean;
}) {
    return (
        <div
            className={`border-b border-border animate-on-scroll stagger-${Math.min(index + 1, 8)} ${isInView ? 'is-visible' : ''}`}
        >
            <Collapsible open={isOpen} onOpenChange={onToggle}>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-5 text-left text-sm font-medium hover:text-foreground/80 transition-colors cursor-pointer">
                    {faq.question}
                    <ChevronDown
                        className={`h-4 w-4 shrink-0 ml-4 text-muted-foreground transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                        }`}
                    />
                </CollapsibleTrigger>
                <CollapsibleContent className="pb-5 text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const { ref: headerRef, isInView: headerVisible } = useInView({ threshold: 0.2 });
    const { ref: gridRef, isInView: gridVisible } = useInView({ threshold: 0.1 });

    const half = Math.ceil(faqs.length / 2);

    return (
        <section id="faq" className="py-24 sm:py-32 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                {/* Section header */}
                <div ref={headerRef} className="text-center mb-16">
                    <p
                        className={`text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 animate-on-scroll stagger-1 ${headerVisible ? 'is-visible' : ''}`}
                    >
                        FAQ
                    </p>
                    <h2
                        className={`text-3xl sm:text-4xl font-bold tracking-tight animate-on-scroll stagger-2 ${headerVisible ? 'is-visible' : ''}`}
                    >
                        Common questions
                    </h2>
                </div>

                {/* 2-column FAQ grid */}
                <div ref={gridRef} className="grid gap-x-12 gap-y-0 md:grid-cols-2">
                    {/* Left column */}
                    <div>
                        {faqs.slice(0, half).map((faq, i) => (
                            <FAQItem
                                key={i}
                                faq={faq}
                                index={i}
                                isOpen={openIndex === i}
                                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                                isInView={gridVisible}
                            />
                        ))}
                    </div>
                    {/* Right column */}
                    <div>
                        {faqs.slice(half).map((faq, i) => (
                            <FAQItem
                                key={i + half}
                                faq={faq}
                                index={i + half}
                                isOpen={openIndex === i + half}
                                onToggle={() => setOpenIndex(openIndex === i + half ? null : i + half)}
                                isInView={gridVisible}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
