import { describe, it, expect } from 'vitest';
import {
    apiError,
    unauthorized,
    forbidden,
    notFound,
    validationError,
    badRequest,
    conflict,
    rateLimited,
    internalError,
    externalServiceError,
    databaseError,
    apiSuccess,
    created,
    noContent,
    validateRequest,
} from './response';

describe('API Response Helpers', () => {
    // ---- Error Responses ----

    describe('error responses return correct status codes', () => {
        it('unauthorized → 401', async () => {
            const res = unauthorized();
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.error.code).toBe('UNAUTHORIZED');
        });

        it('forbidden → 403', async () => {
            const res = forbidden();
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error.code).toBe('FORBIDDEN');
        });

        it('notFound → 404', async () => {
            const res = notFound('Agent');
            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error.message).toContain('Agent');
        });

        it('validationError → 400', async () => {
            const res = validationError('Invalid input', { name: ['too short'] });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error.code).toBe('VALIDATION_ERROR');
            expect(body.error.details?.name).toEqual(['too short']);
        });

        it('badRequest → 400', async () => {
            const res = badRequest('Missing field');
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error.code).toBe('BAD_REQUEST');
        });

        it('conflict → 409', async () => {
            const res = conflict('Already exists');
            expect(res.status).toBe(409);
            const body = await res.json();
            expect(body.error.code).toBe('CONFLICT');
        });

        it('rateLimited → 429', async () => {
            const res = rateLimited('Slow down', 60);
            expect(res.status).toBe(429);
            expect(res.headers.get('Retry-After')).toBe('60');
        });

        it('internalError → 500', async () => {
            const res = internalError();
            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error.code).toBe('INTERNAL_ERROR');
        });

        it('externalServiceError → 502', async () => {
            const res = externalServiceError('Stripe');
            expect(res.status).toBe(502);
            const body = await res.json();
            expect(body.error.message).toContain('Stripe');
        });
    });

    describe('all responses include X-Request-Id header', () => {
        it('error response has request ID', () => {
            const res = unauthorized();
            const reqId = res.headers.get('X-Request-Id');
            expect(reqId).toBeTruthy();
            expect(reqId).toMatch(/^req_/);
        });

        it('success response has request ID', () => {
            const res = apiSuccess({ ok: true });
            const reqId = res.headers.get('X-Request-Id');
            expect(reqId).toBeTruthy();
            expect(reqId).toMatch(/^req_/);
        });
    });

    // ---- databaseError ----

    describe('databaseError', () => {
        it('maps PG 23505 (unique violation) → 409 conflict', async () => {
            const res = databaseError({ code: '23505', message: 'duplicate key violates unique constraint' });
            expect(res.status).toBe(409);
            const body = await res.json();
            expect(body.error.code).toBe('CONFLICT');
        });

        it('maps PG 23503 (foreign key violation) → 400', async () => {
            const res = databaseError({ code: '23503', message: 'violates foreign key constraint' });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error.code).toBe('BAD_REQUEST');
        });

        it('maps PG 42501 (permission denied) → 403', async () => {
            const res = databaseError({ code: '42501', message: 'permission denied for table agencies' });
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error.code).toBe('FORBIDDEN');
        });

        it('maps unknown code → 500', async () => {
            const res = databaseError({ code: '99999', message: 'something weird' });
            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error.code).toBe('DATABASE_ERROR');
            // Should NOT leak the original message
            expect(body.error.message).not.toContain('something weird');
        });

        it('handles missing code gracefully', async () => {
            const res = databaseError({});
            expect(res.status).toBe(500);
        });
    });

    // ---- Success Responses ----

    describe('success responses', () => {
        it('apiSuccess wraps data in { data } with 200', async () => {
            const res = apiSuccess({ items: [1, 2, 3] });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data).toEqual({ items: [1, 2, 3] });
        });

        it('created returns 201', async () => {
            const res = created({ id: 'new-123' });
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.data.id).toBe('new-123');
        });

        it('noContent returns 204 with null body', async () => {
            const res = noContent();
            expect(res.status).toBe(204);
        });
    });

    // ---- validateRequest ----

    describe('validateRequest', () => {
        it('returns null when all validations pass', () => {
            const result = validateRequest([
                { field: 'name', value: 'John', required: true, type: 'string', minLength: 1 },
                { field: 'age', value: 25, type: 'number', min: 0 },
            ]);
            expect(result).toBeNull();
        });

        it('rejects missing required field', async () => {
            const result = validateRequest([
                { field: 'name', value: '', required: true },
            ]);
            expect(result).not.toBeNull();
            expect(result!.status).toBe(400);
            const body = await result!.json();
            expect(body.error.message).toContain('name');
        });

        it('rejects wrong type', async () => {
            const result = validateRequest([
                { field: 'count', value: 'not-a-number', type: 'number' },
            ]);
            expect(result).not.toBeNull();
            const body = await result!.json();
            expect(body.error.message).toContain('number');
        });

        it('validates email format', async () => {
            const valid = validateRequest([
                { field: 'email', value: 'test@example.com', type: 'email' },
            ]);
            expect(valid).toBeNull();

            const invalid = validateRequest([
                { field: 'email', value: 'not-an-email', type: 'email' },
            ]);
            expect(invalid).not.toBeNull();
        });

        it('validates UUID format', async () => {
            const valid = validateRequest([
                { field: 'id', value: '550e8400-e29b-41d4-a716-446655440000', type: 'uuid' },
            ]);
            expect(valid).toBeNull();

            const invalid = validateRequest([
                { field: 'id', value: 'not-a-uuid', type: 'uuid' },
            ]);
            expect(invalid).not.toBeNull();
        });

        it('validates string minLength/maxLength', async () => {
            const tooShort = validateRequest([
                { field: 'name', value: 'ab', type: 'string', minLength: 3 },
            ]);
            expect(tooShort).not.toBeNull();

            const tooLong = validateRequest([
                { field: 'name', value: 'abcdef', type: 'string', maxLength: 3 },
            ]);
            expect(tooLong).not.toBeNull();
        });

        it('validates number min/max', async () => {
            const tooLow = validateRequest([
                { field: 'age', value: -1, type: 'number', min: 0 },
            ]);
            expect(tooLow).not.toBeNull();

            const tooHigh = validateRequest([
                { field: 'age', value: 200, type: 'number', max: 150 },
            ]);
            expect(tooHigh).not.toBeNull();
        });

        it('validates regex pattern', async () => {
            const invalid = validateRequest([
                { field: 'slug', value: 'has spaces', type: 'string', pattern: /^[a-z0-9-]+$/ },
            ]);
            expect(invalid).not.toBeNull();

            const valid = validateRequest([
                { field: 'slug', value: 'valid-slug-123', type: 'string', pattern: /^[a-z0-9-]+$/ },
            ]);
            expect(valid).toBeNull();
        });

        it('runs custom validator', async () => {
            const result = validateRequest([
                {
                    field: 'password',
                    value: 'weak',
                    custom: (v) => (v as string).length < 8 ? 'Password too short' : null,
                },
            ]);
            expect(result).not.toBeNull();
            const body = await result!.json();
            expect(body.error.message).toContain('Password too short');
        });

        it('skips validation on empty optional fields', () => {
            const result = validateRequest([
                { field: 'nickname', value: undefined, type: 'string', minLength: 3 },
            ]);
            expect(result).toBeNull();
        });
    });

    // ---- apiError ----

    describe('apiError', () => {
        it('includes details when provided', async () => {
            const res = apiError('VALIDATION_ERROR', 'Bad input', { field: ['invalid'] });
            const body = await res.json();
            expect(body.error.details).toEqual({ field: ['invalid'] });
        });

        it('excludes details when not provided', async () => {
            const res = apiError('BAD_REQUEST', 'Nope');
            const body = await res.json();
            expect(body.error.details).toBeUndefined();
        });
    });
});
