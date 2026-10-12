import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const createUser = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        auth: { admin: { createUser, deleteUser: vi.fn() } },
        from: () => ({
            insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'agency-1' }, error: null }) }) }),
            update: () => ({ eq: async () => ({ error: null }) }),
            upsert: async () => ({ error: null }),
        }),
    }),
}));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn() }));

function signupRequest(promoCode?: string) {
    return new NextRequest('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'owner@example.com',
            password: 'Passw0rdOK',
            fullName: 'Test Owner',
            agencyName: 'Test Agency',
            promoCode,
            _t: 30,
        }),
    });
}

describe('POST /api/auth/signup promo codes', () => {
    beforeEach(() => {
        vi.resetModules();
        createUser.mockReset();
        createUser.mockResolvedValue({ data: { user: null }, error: null });
        process.env.BETA_PROMO_CODE = 'BETA2026';
    });

    afterEach(() => {
        delete process.env.BETA_PROMO_CODE;
        delete process.env.BETA_TRIAL_END_DATE;
    });

    it('rejects a beta code whose end date has passed, before creating the user', async () => {
        process.env.BETA_TRIAL_END_DATE = '2020-01-01';
        const { POST } = await import('./route');

        const res = await POST(signupRequest('beta2026'));

        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/expired/i);
        expect(createUser).not.toHaveBeenCalled();
    });

    it('rejects a beta code with an unparseable end date', async () => {
        process.env.BETA_TRIAL_END_DATE = 'not-a-date';
        const { POST } = await import('./route');

        const res = await POST(signupRequest('BETA2026'));

        expect(res.status).toBe(400);
        expect(createUser).not.toHaveBeenCalled();
    });

    it('accepts a beta code whose end date is in the future', async () => {
        process.env.BETA_TRIAL_END_DATE = '2099-12-31';
        const { POST } = await import('./route');

        await POST(signupRequest('BETA2026'));

        expect(createUser).toHaveBeenCalledOnce();
    });

    it('still rejects an unknown code as invalid', async () => {
        process.env.BETA_TRIAL_END_DATE = '2099-12-31';
        const { POST } = await import('./route');

        const res = await POST(signupRequest('NOPE'));

        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('Invalid promo code');
        expect(createUser).not.toHaveBeenCalled();
    });
});
