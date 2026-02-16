'use client';

import { useInView } from '@/hooks/useInView';

const prompt = 'Tell me about BuildVoiceAI, an AI voice agent platform for businesses and agencies';

const llms = [
    {
        name: 'ChatGPT',
        href: `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
        svg: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
            </svg>
        ),
    },
    {
        name: 'Gemini',
        href: `https://gemini.google.com/app?q=${encodeURIComponent(prompt)}`,
        svg: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                <path d="M12 0C6.267 3.2 2.133 8.053 0 12c2.133 3.947 6.267 8.8 12 12 5.733-3.2 9.867-8.053 12-12C21.867 8.053 17.733 3.2 12 0zm0 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
            </svg>
        ),
    },
    {
        name: 'Claude',
        href: `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
        svg: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                <path d="M4.603 15.357a2.21 2.21 0 0 1-.645-1.576c0-.617.236-1.166.645-1.576L11.47 5.34a2.21 2.21 0 0 1 1.576-.645c.617 0 1.166.236 1.576.645l6.867 6.867a2.21 2.21 0 0 1 .645 1.576c0 .617-.236 1.166-.645 1.576l-6.867 6.867a2.223 2.223 0 0 1-3.152 0L4.603 15.36zm8.443-9.372L5.25 13.78a1.34 1.34 0 0 0 0 1.897l6.867 6.867c.262.262.59.381.93.381s.668-.12.93-.381l6.866-6.867a1.34 1.34 0 0 0 0-1.897l-6.867-6.867a1.313 1.313 0 0 0-.93-.38c-.34 0-.668.118-.93.38z" />
            </svg>
        ),
    },
    {
        name: 'Perplexity',
        href: `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`,
        svg: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                <path d="M12 1L4 5v6.5L1 14l3 2.5V22h4.5L12 19l3.5 3H20v-5.5l3-2.5-3-2.5V5l-8-4zm0 2.236L18 7v4.764L12 15 6 11.764V7l6-3.764zM6 13.472l5 3.125V21h-2.236L6 18.236v-4.764zm12 0v4.764L15.236 21H13v-4.403l5-3.125z" />
            </svg>
        ),
    },
    {
        name: 'Grok',
        href: `https://grok.com/?q=${encodeURIComponent(prompt)}`,
        svg: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                <path d="M3 3l7.5 9L3 21h2l6.5-7.8L18 21h3l-7.5-9L21 3h-2l-6.5 7.8L6 3H3z" />
            </svg>
        ),
    },
];

export function AISummarySection() {
    const { ref, isInView } = useInView({ threshold: 0.2 });

    return (
        <section ref={ref} className="py-16 sm:py-20 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto text-center">
                <h2
                    className={`text-2xl sm:text-3xl font-bold tracking-tight mb-10 animate-on-scroll stagger-1 ${isInView ? 'is-visible' : ''}`}
                >
                    Request an AI summary of BuildVoiceAI
                </h2>
                <div
                    className={`flex items-center justify-center gap-10 sm:gap-14 animate-on-scroll stagger-2 ${isInView ? 'is-visible' : ''}`}
                >
                    {llms.map((llm) => (
                        <a
                            key={llm.name}
                            href={llm.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground/80 hover:text-foreground hover:scale-110 transition-all duration-200"
                            title={`Ask ${llm.name}`}
                        >
                            {llm.svg}
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );
}
