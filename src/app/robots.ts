import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/', '/landing', '/login', '/signup'],
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
                ],
            },
        ],
        sitemap: 'https://buildvoiceai.com/sitemap.xml',
    };
}
