import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkflowAction } from '@/types';
import { handleCalendlyCreateBookingLink } from './calendly';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOOKING_URL = 'https://calendly.com/d/abc-123/follow-up';
const calendlyConfig = {
    apiToken: 'cal_token',
    userUri: 'https://api.calendly.com/users/U1',
    defaultEventTypeUri: 'https://api.calendly.com/event_types/E1',
};

function makeCallData(overrides: Record<string, unknown> = {}) {
    return {
        call_id: 'call_123',
        agent_id: 'agent_456',
        agent_name: 'Sales Bot',
        status: 'completed',
        direction: 'inbound',
        duration_seconds: 120,
        cost_cents: 10,
        from_number: '+15551234567',
        to_number: '+15559876543',
        ...overrides,
    };
}

function makeAction(config: Record<string, string> = {}): WorkflowAction {
    return { type: 'calendly_create_booking_link', config } as WorkflowAction;
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---------------------------------------------------------------------------
// handleCalendlyCreateBookingLink
// ---------------------------------------------------------------------------

describe('handleCalendlyCreateBookingLink', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
        mockFetch.mockReset();
        vi.stubGlobal('fetch', mockFetch);
        vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC_test');
        vi.stubEnv('TWILIO_AUTH_TOKEN', 'twilio_secret');
        vi.stubEnv('TWILIO_PHONE_NUMBER', '+15550000000');
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('creates a link and texts it to the caller', async () => {
        mockFetch
            .mockResolvedValueOnce(jsonResponse({ resource: { booking_url: BOOKING_URL, owner: '', owner_type: 'EventType' } }))
            .mockResolvedValueOnce(jsonResponse({ sid: 'SM1' }, 201));

        const result = await handleCalendlyCreateBookingLink(
            makeAction({ max_event_count: '2', message: 'Hi from {{agent_name}}, book here: {{booking_url}}' }),
            makeCallData(),
            calendlyConfig,
        );

        expect(result).toEqual({ success: true });
        expect(mockFetch).toHaveBeenCalledTimes(2);

        const [calendlyUrl, calendlyOpts] = mockFetch.mock.calls[0];
        expect(calendlyUrl).toBe('https://api.calendly.com/scheduling_links');
        expect(JSON.parse(calendlyOpts.body)).toEqual({
            owner: calendlyConfig.defaultEventTypeUri,
            owner_type: 'EventType',
            max_event_count: 2,
        });

        const [twilioUrl, twilioOpts] = mockFetch.mock.calls[1];
        expect(twilioUrl).toBe('https://api.twilio.com/2010-04-01/Accounts/AC_test/Messages.json');
        const params = new URLSearchParams(twilioOpts.body);
        expect(params.get('To')).toBe('+15551234567');
        expect(params.get('From')).toBe('+15550000000');
        expect(params.get('Body')).toBe(`Hi from Sales Bot, book here: ${BOOKING_URL}`);
    });

    it('uses the default message and appends the link when the template omits {{booking_url}}', async () => {
        mockFetch
            .mockResolvedValueOnce(jsonResponse({ resource: { booking_url: BOOKING_URL } }))
            .mockResolvedValueOnce(jsonResponse({ sid: 'SM1' }, 201))
            .mockResolvedValueOnce(jsonResponse({ resource: { booking_url: BOOKING_URL } }))
            .mockResolvedValueOnce(jsonResponse({ sid: 'SM2' }, 201));

        await handleCalendlyCreateBookingLink(makeAction(), makeCallData(), calendlyConfig);
        await handleCalendlyCreateBookingLink(makeAction({ message: 'Pick a time:' }), makeCallData(), calendlyConfig);

        expect(new URLSearchParams(mockFetch.mock.calls[1][1].body).get('Body'))
            .toBe(`Thanks for calling! Book your appointment here: ${BOOKING_URL}`);
        expect(new URLSearchParams(mockFetch.mock.calls[3][1].body).get('Body'))
            .toBe(`Pick a time: ${BOOKING_URL}`);
    });

    it('fails without creating a link when there is no phone number', async () => {
        const result = await handleCalendlyCreateBookingLink(
            makeAction(),
            makeCallData({ from_number: undefined }),
            calendlyConfig,
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/no phone number/i);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fails without creating a link when Twilio is not configured', async () => {
        vi.stubEnv('TWILIO_AUTH_TOKEN', '');

        const result = await handleCalendlyCreateBookingLink(makeAction(), makeCallData(), calendlyConfig);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Twilio not configured/);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fails and sends no SMS when Calendly returns an error', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Unauthenticated' }, 401));

        const result = await handleCalendlyCreateBookingLink(makeAction(), makeCallData(), calendlyConfig);

        expect(result).toEqual({ success: false, error: 'Calendly API error: Unauthenticated' });
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('fails when the SMS send fails after the link is created', async () => {
        mockFetch
            .mockResolvedValueOnce(jsonResponse({ resource: { booking_url: BOOKING_URL } }))
            .mockResolvedValueOnce(jsonResponse({ message: 'bad' }, 400));

        const result = await handleCalendlyCreateBookingLink(makeAction(), makeCallData(), calendlyConfig);

        expect(result).toEqual({ success: false, error: 'Booking link created but SMS failed: SMS send failed: 400' });
    });
});
