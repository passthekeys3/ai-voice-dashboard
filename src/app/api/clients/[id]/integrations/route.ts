import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAgencyAdmin, isClientUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getUserPermissions } from '@/lib/permissions';
import { resolveIntegrations } from '@/lib/integrations/resolve';
import {
    deepMerge,
    sanitizeIntegrations,
    validateIntegrationUpdates,
    maskIntegrationSecrets,
} from '@/lib/integrations/validate-integrations';

/**
 * GET /api/clients/[id]/integrations
 * Returns resolved integrations with source tracking and masked secrets.
 * Accessible by: agency admins (always) + client users for their own client (when can_manage_integrations).
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id: clientId } = await params;
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = isAgencyAdmin(user);
        const isOwnClient = isClientUser(user) && user.client?.id === clientId;
        const permissions = getUserPermissions(user);

        if (!isAdmin && !(isOwnClient && permissions.can_manage_integrations)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = await createClient();
        const { integrations, source } = await resolveIntegrations(supabase, user.agency.id, clientId);

        // Also fetch the raw client integrations to show what's overridden
        const { data: client } = await supabase
            .from('clients')
            .select('integrations')
            .eq('id', clientId)
            .eq('agency_id', user.agency.id)
            .single();

        return NextResponse.json({
            resolved: maskIntegrationSecrets(integrations as unknown as Record<string, unknown>),
            clientOverrides: maskIntegrationSecrets(client?.integrations as Record<string, unknown> | null),
            source,
        });
    } catch (error) {
        console.error('Client integrations GET error:', error instanceof Error ? error.message : 'Unknown');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PATCH /api/clients/[id]/integrations
 * Updates client-level integration overrides using deep merge.
 * Accessible by: agency admins (always) + client users for their own client (when can_manage_integrations).
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id: clientId } = await params;
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = isAgencyAdmin(user);
        const isOwnClient = isClientUser(user) && user.client?.id === clientId;
        const permissions = getUserPermissions(user);

        if (!isAdmin && !(isOwnClient && permissions.can_manage_integrations)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { integrations } = body;

        if (!integrations || typeof integrations !== 'object' || Array.isArray(integrations)) {
            return NextResponse.json({ error: 'integrations must be an object' }, { status: 400 });
        }

        // Validate
        const validationError = validateIntegrationUpdates(integrations as Record<string, unknown>);
        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        // Sanitize
        const sanitized = sanitizeIntegrations(integrations as Record<string, unknown>);

        const supabase = await createClient();

        // Deep merge with existing client integrations
        const { data: current } = await supabase
            .from('clients')
            .select('integrations')
            .eq('id', clientId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!current) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const existingIntegrations = (current.integrations as Record<string, unknown>) || {};

        // When creating a NEW client override for a key that currently uses agency defaults,
        // seed from the agency's full config to prevent partial overrides.
        // Without this, per-key resolution (entire block from client OR agency) would lose
        // the agency's other fields (e.g. webhook_url) when only "enabled" is saved.
        const { data: agency } = await supabase
            .from('agencies')
            .select('integrations')
            .eq('id', user.agency.id)
            .single();
        const agencyIntegrations = (agency?.integrations as Record<string, unknown>) || {};

        for (const key of Object.keys(sanitized)) {
            if (!existingIntegrations[key] && agencyIntegrations[key]) {
                existingIntegrations[key] = agencyIntegrations[key];
            }
        }

        const merged = deepMerge(existingIntegrations, sanitized);

        const { error } = await supabase
            .from('clients')
            .update({
                integrations: merged,
                updated_at: new Date().toISOString(),
            })
            .eq('id', clientId)
            .eq('agency_id', user.agency.id);

        if (error) {
            console.error('Client integrations update error:', error.code);
            return NextResponse.json({ error: 'Failed to update integrations' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Client integrations PATCH error:', error instanceof Error ? error.message : 'Unknown');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/clients/[id]/integrations?key=ghl
 * Removes a specific integration override (falls back to agency default).
 * Accessible by: agency admins (always) + client users for their own client (when can_manage_integrations).
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id: clientId } = await params;
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = isAgencyAdmin(user);
        const isOwnClient = isClientUser(user) && user.client?.id === clientId;
        const permissions = getUserPermissions(user);

        if (!isAdmin && !(isOwnClient && permissions.can_manage_integrations)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const integrationKey = request.nextUrl.searchParams.get('key');
        if (!integrationKey) {
            return NextResponse.json({ error: 'Missing ?key= parameter (e.g., ?key=ghl)' }, { status: 400 });
        }

        const ALLOWED_KEYS = ['ghl', 'hubspot', 'google_calendar', 'slack', 'calendly', 'api'];
        if (!ALLOWED_KEYS.includes(integrationKey)) {
            return NextResponse.json({ error: `Invalid integration key: ${integrationKey}` }, { status: 400 });
        }

        const supabase = await createClient();

        const { data: current } = await supabase
            .from('clients')
            .select('integrations')
            .eq('id', clientId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!current) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const integrations = { ...(current.integrations as Record<string, unknown> || {}) };
        delete integrations[integrationKey];

        // If no integrations left, set to null
        const updatedIntegrations = Object.keys(integrations).length > 0 ? integrations : null;

        const { error } = await supabase
            .from('clients')
            .update({
                integrations: updatedIntegrations,
                updated_at: new Date().toISOString(),
            })
            .eq('id', clientId)
            .eq('agency_id', user.agency.id);

        if (error) {
            console.error('Client integrations delete error:', error.code);
            return NextResponse.json({ error: 'Failed to remove integration override' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Client integrations DELETE error:', error instanceof Error ? error.message : 'Unknown');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
