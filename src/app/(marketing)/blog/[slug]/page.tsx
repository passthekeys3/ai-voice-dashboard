import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllSlugs, getPostBySlug, getRelatedPosts, extractFAQs } from '@/lib/blog';
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
        robots: { index: true, follow: true },
        openGraph: {
            title: post.title,
            description: post.description,
            url,
            siteName: 'BuildVoiceAI',
            type: 'article',
            publishedTime: post.date,
            authors: [post.author],
            images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
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

    const relatedPosts = getRelatedPosts(slug, post.tags);
    const faqs = extractFAQs(post.content);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.lastModified || post.date,
        image: `${SITE_URL}/opengraph-image`,
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

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
            { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}/blog/${slug}` },
        ],
    };

    const faqJsonLd = faqs.length > 0 ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    } : null;

    return (
        <>
            <Navbar />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {faqJsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
                />
            )}

            <main className="pt-28 pb-20 px-4 sm:px-6">
                <PostLayout meta={post} relatedPosts={relatedPosts}>
                    <MDXRemote source={post.content} />
                </PostLayout>
            </main>

            <Footer />
        </>
    );
}
