import Link from 'next/link';
import { ArrowLeft, Clock, Calendar } from 'lucide-react';
import type { PostMeta } from '@/lib/blog';

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export function PostLayout({
    meta,
    children,
}: {
    meta: PostMeta;
    children: React.ReactNode;
}) {
    return (
        <article className="max-w-2xl mx-auto">
            <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to blog
            </Link>

            <header className="mb-10">
                <div className="flex flex-wrap gap-2 mb-4">
                    {meta.tags.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                            {tag}
                        </span>
                    ))}
                </div>

                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
                    {meta.title}
                </h1>

                <p className="text-lg text-muted-foreground mb-6">
                    {meta.description}
                </p>

                <div className="flex items-center gap-4 text-sm text-muted-foreground border-t border-border pt-4">
                    <span className="font-medium text-foreground">{meta.author}</span>
                    <span className="text-border">|</span>
                    <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <time dateTime={meta.date}>{formatDate(meta.date)}</time>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {meta.readingTime}
                    </span>
                </div>
            </header>

            <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-pre:bg-muted">
                {children}
            </div>

            <footer className="mt-12 pt-8 border-t border-border">
                <div className="flex items-center justify-between">
                    <Link
                        href="/blog"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        All posts
                    </Link>
                    <a
                        href="https://app.buildvoiceai.com/signup"
                        className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        Try BuildVoiceAI free
                    </a>
                </div>
            </footer>
        </article>
    );
}
