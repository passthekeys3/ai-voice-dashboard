import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { SOLUTION_LINKS } from '@/lib/marketing/solution-links';

const SITE_URL = 'https://buildvoiceai.com';

export default function sitemap(): MetadataRoute.Sitemap {
    const posts = getAllPosts();

    const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: new Date(post.lastModified || post.date),
        changeFrequency: 'monthly',
        priority: 0.7,
    }));

    const solutionEntries: MetadataRoute.Sitemap = [
        { url: `${SITE_URL}/solutions`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.8 },
        ...SOLUTION_LINKS.map(({ slug }) => ({
            url: `${SITE_URL}/solutions/${slug}`,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        })),
    ];

    return [
        {
            url: SITE_URL,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
            images: [`${SITE_URL}/opengraph-image`],
        },
        {
            url: `${SITE_URL}/blog`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        ...solutionEntries,
        ...blogEntries,
        {
            url: `${SITE_URL}/privacy`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.3,
        },
        {
            url: `${SITE_URL}/terms`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.3,
        },
    ];
}
