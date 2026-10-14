import { describe, it, expect } from 'vitest';
import { SOLUTION_LINKS } from './solution-links';
import { SOLUTIONS, ALL_SOLUTIONS } from './solutions';

describe('industry solution pages', () => {
    it('has page content for exactly the linked slugs', () => {
        expect(ALL_SOLUTIONS.map((s) => s.slug).sort()).toEqual(SOLUTION_LINKS.map((l) => l.slug).sort());
        for (const { slug } of SOLUTION_LINKS) expect(SOLUTIONS[slug].slug).toBe(slug);
    });

    it('fills every section of every page', () => {
        for (const s of ALL_SOLUTIONS) {
            expect(s.problem.length, s.slug).toBeGreaterThan(100);
            expect(s.benefits.length, s.slug).toBeGreaterThanOrEqual(4);
            expect(s.callFlow.length, s.slug).toBe(4);
            expect(s.sampleConversation.length, s.slug).toBeGreaterThanOrEqual(4);
            expect(s.setup.length, s.slug).toBeGreaterThanOrEqual(3);
            expect(s.goodToKnow.length, s.slug).toBeGreaterThanOrEqual(1);
            expect(s.faqs.length, s.slug).toBeGreaterThanOrEqual(3);
        }
    });

    it('makes no numeric results claims', () => {
        // Stats like "68% more bookings" or "3x leads" need a real source before going on the site
        const text = JSON.stringify(ALL_SOLUTIONS.map(({ icon: _icon, ...rest }) => rest));
        expect(text).not.toMatch(/\d+\s?%|\b\d+x\b/i);
    });
});
