import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            // AI search crawlers — explicitly allowed for AEO/GEO
            {
                userAgent: 'GPTBot',
                allow: ['/', '/landing', '/blog', '/privacy', '/terms', '/solutions'],
                disallow: ['/api/', '/portal', '/onboarding'],
            },
            {
                userAgent: 'ChatGPT-User',
                allow: ['/', '/landing', '/blog', '/privacy', '/terms', '/solutions'],
                disallow: ['/api/', '/portal', '/onboarding'],
            },
            {
                userAgent: 'Claude-Web',
                allow: ['/', '/landing', '/blog', '/privacy', '/terms', '/solutions'],
                disallow: ['/api/', '/portal', '/onboarding'],
            },
            {
                userAgent: 'PerplexityBot',
                allow: ['/', '/landing', '/blog', '/privacy', '/terms', '/solutions'],
                disallow: ['/api/', '/portal', '/onboarding'],
            },
            {
                userAgent: 'Google-Extended',
                allow: ['/', '/landing', '/blog', '/privacy', '/terms', '/solutions'],
                disallow: ['/api/', '/portal', '/onboarding'],
            },
            // Default rule for all other crawlers (Googlebot, Bingbot, etc.)
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
