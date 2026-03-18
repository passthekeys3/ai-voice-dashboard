import Link from 'next/link';
import type { PostMeta } from '@/lib/blog';

const TAG_COLORS: Record<string, string> = {
    guides: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    agencies: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    comparison: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    'use-cases': 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    technical: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
    workflows: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
};

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export function PostCard({ post }: { post: PostMeta }) {
    return (
        <Link
            href={`/blog/${post.slug}`}
            className="group block rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
        >
            <div className="flex flex-wrap gap-2 mb-3">
                {post.tags.map((tag) => (
                    <span
                        key={tag}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TAG_COLORS[tag] || 'bg-muted text-muted-foreground'}`}
                    >
                        {tag}
                    </span>
                ))}
            </div>

            <h2 className="text-base sm:text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2 break-words">
                {post.title}
            </h2>

            <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                {post.description}
            </p>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span>{post.readingTime}</span>
            </div>
        </Link>
    );
}
