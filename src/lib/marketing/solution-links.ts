/**
 * Industry solution pages, as linked from the nav, footer, homepage and sitemap.
 * Full page content lives in ./solutions.ts (kept separate so client components
 * like the navbar don't bundle it).
 */
export const SOLUTION_LINKS = [
    { slug: 'dental', label: 'Dental practices' },
    { slug: 'real-estate', label: 'Real estate' },
    { slug: 'sales', label: 'Sales teams' },
    { slug: 'customer-support', label: 'Customer support' },
] as const;

export type SolutionSlug = (typeof SOLUTION_LINKS)[number]['slug'];

export const solutionHref = (slug: SolutionSlug) => `/solutions/${slug}`;
