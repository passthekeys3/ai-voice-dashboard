import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllSlugs, getPostBySlug } from '@/lib/blog';
import { PostLayout } from '@/components/blog/PostLayout';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';

const SITE_URL = 'https://buildvoiceai.com';

export function generateStaticParams() {
    return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const post = getPostBySlug(slug);
    if (!post) return {};

    const url = `${SITE_URL}/blog/${slug}`;

    return {
        title: `${post.title} - BuildVoiceAI`,
        description: post.description,
        alternates: { canonical: url },
        openGraph: {
            title: post.title,
            description: post.description,
            url,
            siteName: 'BuildVoiceAI',
            type: 'article',
            publishedTime: post.date,
            authors: [post.author],
        },
        twitter: {
            card: 'summary_large_image',
            title: post.title,
            description: post.description,
        },
    };
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = getPostBySlug(slug);
    if (!post) notFound();

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        author: {
            '@type': 'Person',
            name: post.author,
        },
        publisher: {
            '@type': 'Organization',
            name: 'BuildVoiceAI',
            url: SITE_URL,
        },
        url: `${SITE_URL}/blog/${slug}`,
    };

    return (
        <>
            <Navbar />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <main className="pt-28 pb-20 px-4 sm:px-6">
                <PostLayout meta={post}>
                    <MDXRemote source={post.content} />
                </PostLayout>
            </main>

            <Footer />
        </>
    );
}
