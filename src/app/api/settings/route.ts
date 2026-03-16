import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    deepMerge,
    sanitizeIntegrations,
    validateIntegrationUpdates,
} from '@/lib/integrations/validate-integrations';
import { encrypt } from '@/lib/crypto';
import crypto from 'crypto';

export async function PATCH(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, branding, calling_window, retell_api_key, vapi_api_key, vapi_public_key, bland_api_key, integrations } = body;

        // Validate API key format and length
        const API_KEY_MAX_LENGTH = 256;
        // API keys typically contain alphanumeric chars, underscores, hyphens, and may have prefixes
        const API_KEY_PATTERN = /^[a-zA-Z0-9_\-:.]+$/;

        if (retell_api_key) {
            if (typeof retell_api_key !== 'string' || retell_api_key.length > API_KEY_MAX_LENGTH) {
                return NextResponse.json({ error: 'Invalid Retell API key: too long' }, { status: 400 });
            }
            if (!API_KEY_PATTERN.test(retell_api_key)) {
                return NextResponse.json({ error: 'Invalid Retell API key format' }, { status: 400 });
            }
        }

        if (vapi_api_key) {
            if (typeof vapi_api_key !== 'string' || vapi_api_key.length > API_KEY_MAX_LENGTH) {
                return NextResponse.json({ error: 'Invalid Vapi API key: too long' }, { status: 400 });
            }
            if (!API_KEY_PATTERN.test(vapi_api_key)) {
                return NextResponse.json({ error: 'Invalid Vapi API key format' }, { status: 400 });
            }
        }

        if (vapi_public_key) {
            if (typeof vapi_public_key !== 'string' || vapi_public_key.length > API_KEY_MAX_LENGTH) {
                return NextResponse.json({ error: 'Invalid Vapi Public key: too long' }, { status: 400 });
            }
            if (!API_KEY_PATTERN.test(vapi_public_key)) {
                return NextResponse.json({ error: 'Invalid Vapi Public key format' }, { status: 400 });
            }
        }

        if (bland_api_key) {
            if (typeof bland_api_key !== 'string' || bland_api_key.length > API_KEY_MAX_LENGTH) {
                return NextResponse.json({ error: 'Invalid Bland API key: too long' }, { status: 400 });
            }
            if (!API_KEY_PATTERN.test(bland_api_key)) {
                return NextResponse.json({ error: 'Invalid Bland API key format' }, { status: 400 });
            }
        }

        // Validate integration settings using shared utility
        if (integrations) {
            const validationError = validateIntegrationUpdates(integrations as Record<string, unknown>);
            if (validationError) {
                return NextResponse.json({ error: validationError }, { status: 400 });
            }
        }

        // Validate name if provided
        if (name !== undefined) {
            if (typeof name !== 'string' || name.length < 1 || name.length > 100) {
                return NextResponse.json({ error: 'Agency name must be 1-100 characters' }, { status: 400 });
            }
        }

        // Validate branding if provided
        if (branding !== undefined) {
            if (typeof branding !== 'object' || branding === null || Array.isArray(branding)) {
                return NextResponse.json({ error: 'Invalid branding format' }, { status: 400 });
            }
            const b = branding as Record<string, unknown>;
            const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
            const MAX_STRING = 500;
            // Validate color fields
            for (const colorField of ['primary_color', 'accent_color', 'sidebar_color', 'text_color']) {
                if (b[colorField] !== undefined && b[colorField] !== null && b[colorField] !== '') {
                    if (typeof b[colorField] !== 'string' || !HEX_COLOR.test(b[colorField] as string)) {
                        return NextResponse.json({ error: `Invalid ${colorField}: must be a hex color (e.g. #FF0000)` }, { status: 400 });
                    }
                }
            }
            // Validate URL fields
            for (const urlField of ['logo_url', 'favicon_url']) {
                if (b[urlField] !== undefined && b[urlField] !== null && b[urlField] !== '') {
                    if (typeof b[urlField] !== 'string' || (b[urlField] as string).length > 2048) {
                        return NextResponse.json({ error: `Invalid ${urlField}: too long` }, { status: 400 });
                    }
                    try { new URL(b[urlField] as string); } catch {
                        return NextResponse.json({ error: `Invalid ${urlField}: must be a valid URL` }, { status: 400 });
                    }
                }
            }
            // Validate string fields
            for (const strField of ['company_name', 'tagline', 'login_message', 'footer_text', 'support_email']) {
                if (b[strField] !== undefined && b[strField] !== null) {
                    if (typeof b[strField] !== 'string' || (b[strField] as string).length > MAX_STRING) {
                        return NextResponse.json({ error: `Invalid ${strField}: too long (max ${MAX_STRING} chars)` }, { status: 400 });
                    }
                }
            }
            // Validate email field
            if (b.support_email !== undefined && b.support_email !== null && b.support_email !== '') {
                if (typeof b.support_email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.support_email as string)) {
                    return NextResponse.json({ error: 'Invalid support email format' }, { status: 400 });
                }
            }
        }

        // Validate and process calling_window if provided
        if (calling_window !== undefined) {
            if (typeof calling_window !== 'object' || calling_window === null || Array.isArray(calling_window)) {
                return NextResponse.json({ error: 'Invalid calling window format' }, { status: 400 });
            }
            const cw = calling_window as Record<string, unknown>;
            if (cw.enabled !== undefined && typeof cw.enabled !== 'boolean') {
                return NextResponse.json({ error: 'calling_window.enabled must be a boolean' }, { status: 400 });
            }
            if (cw.start_hour !== undefined) {
                if (typeof cw.start_hour !== 'number' || cw.start_hour < 0 || cw.start_hour > 23) {
                    return NextResponse.json({ error: 'calling_window.start_hour must be 0-23' }, { status: 400 });
                }
            }
            if (cw.end_hour !== undefined) {
                if (typeof cw.end_hour !== 'number' || cw.end_hour < 0 || cw.end_hour > 23) {
                    return NextResponse.json({ error: 'calling_window.end_hour must be 0-23' }, { status: 400 });
                }
            }
            if (cw.days_of_week !== undefined) {
                if (!Array.isArray(cw.days_of_week) || !cw.days_of_week.every((d: unknown) => typeof d === 'number' && d >= 0 && d <= 6)) {
                    return NextResponse.json({ error: 'calling_window.days_of_week must be an array of numbers 0-6' }, { status: 400 });
                }
            }
            if (cw.timezone !== undefined) {
                if (typeof cw.timezone !== 'string' || (cw.timezone as string).length > 100) {
                    return NextResponse.json({ error: 'Invalid calling window timezone' }, { status: 400 });
                }
            }
        }

        // Use admin client to bypass RLS for agency update
        const supabase = await createAdminClient();

        // Build update payload — only include fields that were provided
        const updatePayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (name !== undefined) updatePayload.name = name;
        if (branding !== undefined) updatePayload.branding = branding;
        if (calling_window !== undefined) updatePayload.calling_window = calling_window;
        if (retell_api_key !== undefined) updatePayload.retell_api_key = encrypt(retell_api_key) ?? null;
        if (vapi_api_key !== undefined) updatePayload.vapi_api_key = encrypt(vapi_api_key) ?? null;
        if (vapi_public_key !== undefined) updatePayload.vapi_public_key = encrypt(vapi_public_key) ?? null;
        if (bland_api_key !== undefined) updatePayload.bland_api_key = encrypt(bland_api_key) ?? null;

        // Deep merge integrations to prevent overwriting sibling/nested keys
        if (integrations !== undefined) {
            const sanitized = sanitizeIntegrations(integrations as Record<string, unknown>);

            const { data: current } = await supabase
                .from('agencies')
                .select('integrations')
                .eq('id', user.agency.id)
                .single();

            const existingIntegrations = (current?.integrations as Record<string, unknown>) || {};
            const merged = deepMerge(existingIntegrations, sanitized);

            // Auto-generate webhook signing secret when API key is created and no secret exists yet
            const mergedApi = (merged as Record<string, Record<string, unknown>>).api;
            if (mergedApi?.api_key && !mergedApi.webhook_signing_secret) {
                mergedApi.webhook_signing_secret = crypto.randomBytes(32).toString('hex');
            }

            updatePayload.integrations = merged;
        }

        const { error } = await supabase
            .from('agencies')
            .update(updatePayload)
            .eq('id', user.agency.id);

        if (error) {
            console.error('Settings update error:', error.code);
            return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Settings update error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
