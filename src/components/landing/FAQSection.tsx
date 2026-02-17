'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useInView } from '@/hooks/useInView';

const faqs = [
    {
        question: 'How long does it take to set up a voice agent?',
        answer: 'Most agents are live within 30 minutes. Describe what your agent should do, pick a voice, and connect your phone number. The platform generates the conversation flow automatically.',
    },
    {
        question: 'Can I use my own phone numbers?',
        answer: 'Yes. You can bring existing numbers from Twilio or purchase new ones directly through the platform. Porting takes a few minutes.',
    },
    {
        question: 'Which CRMs do you integrate with?',
        answer: 'GoHighLevel and HubSpot are natively supported. When a call ends, the agent can update contacts, create deals, book appointments, and trigger workflows automatically. We also support Calendly and Slack.',
    },
    {
        question: 'How does white-labeling work?',
        answer: 'On the Growth and Agency plans, you get a fully branded dashboard — your logo, your colors, your domain. Your clients log into their own portal and only see their data. They never see BuildVoiceAI.',
    },
    {
        question: 'What do the voices sound like?',
        answer: 'The platform uses the latest neural voice models. Voices sound natural and conversational — not robotic. You can preview every voice before going live and choose from dozens of options across accents and tones.',
    },
    {
        question: 'Is my data private and secure?',
        answer: 'All data is encrypted at rest and in transit. Call recordings and transcripts are scoped per account with row-level security. We never share your data or use it to train models.',
    },
    {
        question: 'What happens if the AI can\'t answer a question?',
        answer: 'You define fallback behavior when building your agent. It can transfer to a human, take a message, or schedule a callback. You stay in control of every edge case.',
    },
    {
        question: 'Can I try it before committing to a plan?',
        answer: 'Every plan includes a 14-day free trial. You can build agents, make test calls, and explore the full platform before entering payment details.',
    },
    {
        question: 'What happens if I go over my included minutes?',
        answer: 'Overages are billed at per-minute rates that vary by voice provider — typically $0.05–$0.12/min. You can see real-time cost tracking in your dashboard and set monthly spending limits to avoid surprises.',
    },
    {
        question: 'Is the platform HIPAA or SOC 2 compliant?',
        answer: 'We take compliance seriously. Call data is encrypted at rest and in transit, and access controls are enforced at the row level. For healthcare or regulated industries, contact us to discuss BAA arrangements and our compliance roadmap.',
    },
];

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
