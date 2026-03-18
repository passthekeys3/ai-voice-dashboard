import { describe, it, expect } from 'vitest';
import {
    resolveTemplate,
    evaluateConditions,
    escapeHtml,
    safeParseInt,
    isRetryableError,
} from './executor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCallData(overrides: Record<string, unknown> = {}) {
    return {
        call_id: 'call_123',
        agent_id: 'agent_456',
        agent_name: 'Sales Bot',
        status: 'completed',
        direction: 'outbound',
        duration_seconds: 272,
        cost_cents: 15,
        from_number: '+15551234567',
        to_number: '+15559876543',
        transcript: 'Hello, this is a test call.',
        recording_url: 'https://example.com/rec.mp3',
        summary: 'Discussed pricing.',
        sentiment: 'positive',
        started_at: '2026-01-15T10:00:00Z',
        ended_at: '2026-01-15T10:04:32Z',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// resolveTemplate
// ---------------------------------------------------------------------------

describe('resolveTemplate', () => {
    const callData = makeCallData();

    it('replaces {{call_id}} with actual call ID', () => {
        expect(resolveTemplate('ID: {{call_id}}', callData)).toBe('ID: call_123');
    });

    it('replaces {{agent_name}} with agent name', () => {
        expect(resolveTemplate('Agent: {{agent_name}}', callData)).toBe('Agent: Sales Bot');
    });

    it('replaces multiple variables in one template', () => {
        const tpl = '{{agent_name}} called {{to_number}} ({{direction}})';
        expect(resolveTemplate(tpl, callData)).toBe('Sales Bot called +15559876543 (outbound)');
    });

    it('replaces {{duration_seconds}} and {{duration_minutes}}', () => {
        expect(resolveTemplate('{{duration_seconds}}s', callData)).toBe('272s');
        // 272 / 60 rounds to 5
        expect(resolveTemplate('{{duration_minutes}}m', callData)).toBe('5m');
    });

    it('replaces {{summary}}, {{sentiment}}, {{transcript}}', () => {
        expect(resolveTemplate('{{summary}}', callData)).toBe('Discussed pricing.');
        expect(resolveTemplate('{{sentiment}}', callData)).toBe('positive');
        expect(resolveTemplate('{{transcript}}', callData)).toBe('Hello, this is a test call.');
    });

    it('replaces {{recording_url}}, {{started_at}}, {{ended_at}}', () => {
        expect(resolveTemplate('{{recording_url}}', callData)).toBe('https://example.com/rec.mp3');
        expect(resolveTemplate('{{started_at}}', callData)).toBe('2026-01-15T10:00:00Z');
        expect(resolveTemplate('{{ended_at}}', callData)).toBe('2026-01-15T10:04:32Z');
    });

    it('leaves unknown variables as-is (not in the known map)', () => {
        expect(resolveTemplate('{{unknown_var}}', callData)).toBe('{{unknown_var}}');
    });

    it('replaces known variable with empty string when value is missing', () => {
        const sparse = makeCallData({ summary: undefined, agent_name: undefined });
        expect(resolveTemplate('Summary: {{summary}}', sparse)).toBe('Summary: ');
        expect(resolveTemplate('Agent: {{agent_name}}', sparse)).toBe('Agent: ');
    });

    it('handles template with no variables', () => {
        expect(resolveTemplate('plain text', callData)).toBe('plain text');
    });

    it('handles empty template string', () => {
        expect(resolveTemplate('', callData)).toBe('');
    });

    it('handles the same variable repeated multiple times', () => {
        expect(resolveTemplate('{{call_id}}-{{call_id}}', callData)).toBe('call_123-call_123');
    });
});

// ---------------------------------------------------------------------------
// evaluateConditions
// ---------------------------------------------------------------------------

describe('evaluateConditions', () => {
    const callData = makeCallData();

    it('returns true when conditions array is empty', () => {
        expect(evaluateConditions([], callData)).toBe(true);
    });

    it('returns true when conditions is undefined/null', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(evaluateConditions(undefined as any, callData)).toBe(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(evaluateConditions(null as any, callData)).toBe(true);
    });

    // -- Equality operators --

    it('== matches equal values', () => {
        expect(evaluateConditions([{ field: 'status', operator: '==', value: 'completed' }], callData)).toBe(true);
    });

    it('== rejects non-equal values', () => {
        expect(evaluateConditions([{ field: 'status', operator: '==', value: 'failed' }], callData)).toBe(false);
    });

    it('!= matches non-equal values', () => {
        expect(evaluateConditions([{ field: 'status', operator: '!=', value: 'failed' }], callData)).toBe(true);
    });

    it('!= rejects equal values', () => {
        expect(evaluateConditions([{ field: 'status', operator: '!=', value: 'completed' }], callData)).toBe(false);
    });

    // -- Numeric comparison operators --

    it('> compares numerically', () => {
        expect(evaluateConditions([{ field: 'duration_seconds', operator: '>', value: '100' }], callData)).toBe(true);
        expect(evaluateConditions([{ field: 'duration_seconds', operator: '>', value: '300' }], callData)).toBe(false);
    });

    it('< compares numerically', () => {
        expect(evaluateConditions([{ field: 'duration_seconds', operator: '<', value: '300' }], callData)).toBe(true);
        expect(evaluateConditions([{ field: 'duration_seconds', operator: '<', value: '100' }], callData)).toBe(false);
    });

    it('>= compares numerically', () => {
        expect(evaluateConditions([{ field: 'duration_seconds', operator: '>=', value: '272' }], callData)).toBe(true);
        expect(evaluateConditions([{ field: 'duration_seconds', operator: '>=', value: '273' }], callData)).toBe(false);
    });

    it('<= compares numerically', () => {
        expect(evaluateConditions([{ field: 'duration_seconds', operator: '<=', value: '272' }], callData)).toBe(true);
        expect(evaluateConditions([{ field: 'duration_seconds', operator: '<=', value: '271' }], callData)).toBe(false);
    });

    it('numeric operators return false for non-numeric values', () => {
        expect(evaluateConditions([{ field: 'status', operator: '>', value: '100' }], callData)).toBe(false);
    });

    it('numeric operators return false when field is null/undefined', () => {
        const sparse = makeCallData({ duration_seconds: 0 });
        expect(evaluateConditions([{ field: 'missing_field', operator: '>', value: '0' }], sparse)).toBe(false);
    });

    // -- String operators --

    it('contains matches substring', () => {
        expect(evaluateConditions([{ field: 'summary', operator: 'contains', value: 'pricing' }], callData)).toBe(true);
    });

    it('contains rejects when substring is absent', () => {
        expect(evaluateConditions([{ field: 'summary', operator: 'contains', value: 'refund' }], callData)).toBe(false);
    });

    it('contains returns false when field is null', () => {
        const sparse = makeCallData({ summary: undefined });
        expect(evaluateConditions([{ field: 'summary', operator: 'contains', value: 'any' }], sparse)).toBe(false);
    });

    it('not_contains matches when substring is absent', () => {
        expect(evaluateConditions([{ field: 'summary', operator: 'not_contains', value: 'refund' }], callData)).toBe(true);
    });

    it('not_contains rejects when substring is present', () => {
        expect(evaluateConditions([{ field: 'summary', operator: 'not_contains', value: 'pricing' }], callData)).toBe(false);
    });

    it('not_contains returns true when field is null', () => {
        const sparse = makeCallData({ summary: undefined });
        expect(evaluateConditions([{ field: 'summary', operator: 'not_contains', value: 'any' }], sparse)).toBe(true);
    });

    // -- Multiple conditions (AND logic — .every()) --

    it('all conditions must match (AND)', () => {
        const conditions = [
            { field: 'status', operator: '==' as const, value: 'completed' },
            { field: 'direction', operator: '==' as const, value: 'outbound' },
        ];
        expect(evaluateConditions(conditions, callData)).toBe(true);
    });

    it('fails if any condition does not match (AND)', () => {
        const conditions = [
            { field: 'status', operator: '==' as const, value: 'completed' },
            { field: 'direction', operator: '==' as const, value: 'inbound' },
        ];
        expect(evaluateConditions(conditions, callData)).toBe(false);
    });

    // -- Unknown operator --

    it('returns false for unknown operator', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(evaluateConditions([{ field: 'status', operator: 'regex' as any, value: '.*' }], callData)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------

describe('escapeHtml', () => {
    it('escapes < and >', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes &', () => {
        expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('escapes double quotes', () => {
        expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('escapes single quotes', () => {
        expect(escapeHtml("it's")).toBe("it&#39;s");
    });

    it('escapes all special characters in one string', () => {
        expect(escapeHtml('<div class="x">&\'</div>')).toBe(
            '&lt;div class=&quot;x&quot;&gt;&amp;&#39;&lt;/div&gt;'
        );
    });

    it('returns empty string unchanged', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('returns string with no special characters unchanged', () => {
        expect(escapeHtml('hello world 123')).toBe('hello world 123');
    });
});

// ---------------------------------------------------------------------------
// safeParseInt
// ---------------------------------------------------------------------------

describe('safeParseInt', () => {
    it('parses valid integer strings', () => {
        expect(safeParseInt('42', 0)).toBe(42);
        expect(safeParseInt('0', 10)).toBe(0);
        expect(safeParseInt('-5', 0)).toBe(-5);
    });

    it('returns default for undefined', () => {
        expect(safeParseInt(undefined, 10)).toBe(10);
    });

    it('returns default for empty string', () => {
        expect(safeParseInt('', 10)).toBe(10);
    });

    it('returns default for non-numeric strings', () => {
        expect(safeParseInt('abc', 5)).toBe(5);
        expect(safeParseInt('not-a-number', 0)).toBe(0);
    });

    it('parses integers with trailing non-numeric characters', () => {
        // parseInt("42px") returns 42 — this is standard JS behavior
        expect(safeParseInt('42px', 0)).toBe(42);
    });

    it('handles large numbers', () => {
        expect(safeParseInt('999999', 0)).toBe(999999);
    });
});

// ---------------------------------------------------------------------------
// isRetryableError
// ---------------------------------------------------------------------------

describe('isRetryableError', () => {
    // Network errors
    it('treats ECONNREFUSED as retryable', () => {
        expect(isRetryableError('connect ECONNREFUSED 127.0.0.1:3000')).toBe(true);
    });

    it('treats ECONNRESET as retryable', () => {
        expect(isRetryableError('read ECONNRESET')).toBe(true);
    });

    it('treats ETIMEDOUT as retryable', () => {
        expect(isRetryableError('connect ETIMEDOUT')).toBe(true);
    });

    it('treats ENOTFOUND as retryable', () => {
        expect(isRetryableError('getaddrinfo ENOTFOUND example.com')).toBe(true);
    });

    it('treats "fetch failed" as retryable', () => {
        expect(isRetryableError('TypeError: fetch failed')).toBe(true);
    });

    it('treats "network error" as retryable', () => {
        expect(isRetryableError('Network Error: connection dropped')).toBe(true);
    });

    it('treats "request timeout" as retryable', () => {
        expect(isRetryableError('Request timeout after 15000ms')).toBe(true);
    });

    // Server errors (5xx)
    it('treats status 500 as retryable', () => {
        expect(isRetryableError('API returned status 500')).toBe(true);
    });

    it('treats status 502 as retryable', () => {
        expect(isRetryableError('returned 502 Bad Gateway')).toBe(true);
    });

    it('treats status 503 as retryable', () => {
        expect(isRetryableError('status 503 Service Unavailable')).toBe(true);
    });

    it('treats status 504 as retryable', () => {
        expect(isRetryableError('returned 504 Gateway Timeout')).toBe(true);
    });

    // Rate limiting
    it('treats status 429 as retryable', () => {
        expect(isRetryableError('status 429 Too Many Requests')).toBe(true);
    });

    // Non-retryable
    it('treats 400 Bad Request as NOT retryable', () => {
        expect(isRetryableError('status 400 Bad Request')).toBe(false);
    });

    it('treats 401 Unauthorized as NOT retryable', () => {
        expect(isRetryableError('status 401 Unauthorized')).toBe(false);
    });

    it('treats 403 Forbidden as NOT retryable', () => {
        expect(isRetryableError('returned 403 Forbidden')).toBe(false);
    });

    it('treats 404 Not Found as NOT retryable', () => {
        expect(isRetryableError('status 404 Not Found')).toBe(false);
    });

    it('treats 422 Unprocessable Entity as NOT retryable', () => {
        expect(isRetryableError('returned 422 Unprocessable Entity')).toBe(false);
    });

    it('treats generic validation error as NOT retryable', () => {
        expect(isRetryableError('Missing required field: email')).toBe(false);
    });

    // Case insensitivity
    it('matches patterns case-insensitively', () => {
        expect(isRetryableError('FETCH FAILED')).toBe(true);
        expect(isRetryableError('Network Error')).toBe(true);
    });
});
