import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/', '/landing', '/blog', '/privacy', '/terms', '/solutions'],
                disallow: [
                    '/agents',
                    '/calls',
                    '/analytics',
                    '/settings',
                    '/clients',
                    '/portal',
                    '/api/',
                    '/onboarding',
                    '/billing',
                    '/experiments',
                    '/testing',
                    '/workflows',
                    '/live',
                    '/phone-numbers',
                    '/scheduled-calls',
                    '/insights',
                    '/agent-builder',
                    '/integrations',
                ],
            },
        ],
        sitemap: 'https://buildvoiceai.com/sitemap.xml',
        host: 'https://buildvoiceai.com',
    };
}

// Note: llms.txt and llms-full.txt are served from /public for AI discoverability
// https://buildvoiceai.com/llms.txt (summary)
// https://buildvoiceai.com/llms-full.txt (comprehensive reference)
