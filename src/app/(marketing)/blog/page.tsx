import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/blog';
import { PostCard } from '@/components/blog/PostCard';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';

const SITE_URL = 'https://buildvoiceai.com';

export const metadata: Metadata = {
    title: 'Blog - BuildVoiceAI',
    description:
        'Insights, guides, and strategies for building and scaling AI voice agent businesses. Learn about voice AI providers, automation workflows, and agency growth.',
    alternates: {
        canonical: `${SITE_URL}/blog`,
    },
    robots: { index: true, follow: true },
    openGraph: {
        title: 'Blog - BuildVoiceAI',
        description: 'Insights, guides, and strategies for building AI voice agent businesses.',
        url: `${SITE_URL}/blog`,
        siteName: 'BuildVoiceAI',
        type: 'website',
        images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Blog - BuildVoiceAI',
        description: 'Insights, guides, and strategies for building AI voice agent businesses.',
    },
};

export default function BlogPage() {
    const posts = getAllPosts();

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'BuildVoiceAI Blog',
        url: `${SITE_URL}/blog`,
        description: 'Insights and guides for AI voice agent businesses.',
        publisher: {
            '@type': 'Organization',
            name: 'BuildVoiceAI',
            url: SITE_URL,
        },
        blogPost: posts.map((post) => ({
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            url: `${SITE_URL}/blog/${post.slug}`,
            author: { '@type': 'Person', name: post.author },
        })),
    };

    return (
        <>
            <Navbar />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <main className="pt-28 pb-20 px-4 sm:px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-14">
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
                            Blog
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Guides, strategies, and insights for building and scaling your AI voice agent business.
                        </p>
                    </div>

                    {posts.length === 0 ? (
                        <p className="text-center text-muted-foreground">
                            No posts yet. Check back soon!
                        </p>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {posts.map((post) => (
                                <PostCard key={post.slug} post={post} />
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </>
    );
}
