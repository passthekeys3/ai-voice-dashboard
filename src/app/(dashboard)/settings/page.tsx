import type { Metadata } from 'next';

import { Suspense } from 'react';
import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { SettingsForm } from '@/components/dashboard/SettingsForm';
import { ClientPermissionsEditor } from '@/components/dashboard/ClientPermissionsEditor';
import { CustomDomainSettings } from '@/components/dashboard/CustomDomainSettings';
import { DEFAULT_CLIENT_PERMISSIONS } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Brain } from 'lucide-react';
import type { Agency, AgencyIntegrations } from '@/types';

function BillingSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-10 w-40" />
            </CardContent>
        </Card>
    );
}

async function AIUsageCard({ agencyId }: { agencyId: string }) {
    const supabase = await createClient();
    const { data: agency } = await supabase
        .from('agencies')
        .select('ai_analysis_count')
        .eq('id', agencyId)
        .single();

    const count = (agency as { ai_analysis_count?: number } | null)?.ai_analysis_count ?? 0;
    const costDollars = (count * 0.01).toFixed(2);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    AI Call Analysis Usage
                </CardTitle>
                <CardDescription>
                    Tracked usage for AI-powered call analysis across all clients
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-4">
                    <div>
                        <p className="text-3xl font-bold">{count.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">calls analyzed</p>
                    </div>
                    <div className="text-xl font-semibold text-muted-foreground">=</div>
                    <div>
                        <p className="text-3xl font-bold">${costDollars}</p>
                        <p className="text-sm text-muted-foreground">at $0.01/call</p>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                    Enable or disable AI analysis per-client in each client&apos;s billing settings.
                </p>
            </CardContent>
        </Card>
    );
}

export const metadata: Metadata = { title: 'Settings' };

/** Mask a secret string for safe display: "...last4" or undefined */
function mask(value: string | undefined): string | undefined {
    return value ? '...' + value.slice(-4) : undefined;
}

/** Strip all raw secrets from the agency object before passing to client components */
function sanitizeAgencyForClient(agency: Agency): Agency {
    const safeIntegrations: AgencyIntegrations | undefined = agency.integrations ? {
        ghl: agency.integrations.ghl ? {
            // Safe fields
            enabled: agency.integrations.ghl.enabled,
            auth_method: agency.integrations.ghl.auth_method,
            location_id: agency.integrations.ghl.location_id,
            oauth_location_id: agency.integrations.ghl.oauth_location_id,
            calling_window: agency.integrations.ghl.calling_window,
            trigger_config: agency.integrations.ghl.trigger_config ? {
                ...agency.integrations.ghl.trigger_config,
                webhook_secret: mask(agency.integrations.ghl.trigger_config.webhook_secret) ?? '',
            } : undefined,
            // Masked secrets
            api_key: mask(agency.integrations.ghl.api_key),
            // Strip OAuth tokens entirely (not shown in form, server deep-merge preserves them)
            access_token: undefined,
            refresh_token: undefined,
            expires_at: undefined,
        } : undefined,
        hubspot: agency.integrations.hubspot ? {
            enabled: agency.integrations.hubspot.enabled,
            portal_id: agency.integrations.hubspot.portal_id,
            trigger_config: agency.integrations.hubspot.trigger_config ? {
                ...agency.integrations.hubspot.trigger_config,
                webhook_secret: mask(agency.integrations.hubspot.trigger_config.webhook_secret) ?? '',
            } : undefined,
            access_token: undefined,
            refresh_token: undefined,
            expires_at: undefined,
        } : undefined,
        google_calendar: agency.integrations.google_calendar ? {
            enabled: agency.integrations.google_calendar.enabled,
            default_calendar_id: agency.integrations.google_calendar.default_calendar_id,
            default_calendar_name: agency.integrations.google_calendar.default_calendar_name,
            access_token: undefined,
            refresh_token: undefined,
            expires_at: undefined,
        } : undefined,
        slack: agency.integrations.slack ? {
            enabled: agency.integrations.slack.enabled,
            channel_name: agency.integrations.slack.channel_name,
            webhook_url: mask(agency.integrations.slack.webhook_url),
        } : undefined,
        calendly: agency.integrations.calendly ? {
            enabled: agency.integrations.calendly.enabled,
            user_uri: agency.integrations.calendly.user_uri,
            default_event_type_uri: agency.integrations.calendly.default_event_type_uri,
            api_token: mask(agency.integrations.calendly.api_token),
        } : undefined,
        api: agency.integrations.api ? {
            enabled: agency.integrations.api.enabled,
            default_agent_id: agency.integrations.api.default_agent_id,
            api_key: mask(agency.integrations.api.api_key),
        } : undefined,
    } : undefined;

    return {
        ...agency,
        retell_api_key: mask(agency.retell_api_key),
        vapi_api_key: mask(agency.vapi_api_key),
        bland_api_key: mask(agency.bland_api_key),
        integrations: safeIntegrations,
    };
}

export default async function SettingsPage() {
    const user = await requireAgencyAdmin();
    const safeAgency = sanitizeAgencyForClient(user.agency);

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Settings"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                    <p className="text-muted-foreground">
                        Configure your agency branding, integrations, and permissions
                    </p>
                </div>

                {/* AI Call Analysis Usage */}
                {user.profile.role === 'agency_admin' && (
                    <Suspense fallback={<BillingSkeleton />}>
                        <AIUsageCard agencyId={user.agency.id} />
                    </Suspense>
                )}

                <SettingsForm agency={safeAgency} />

                {/* Custom Domain Settings - Only for agency admins */}
                {user.profile.role === 'agency_admin' && (
                    <CustomDomainSettings />
                )}

                <ClientPermissionsEditor
                    permissions={user.agency.default_client_permissions || DEFAULT_CLIENT_PERMISSIONS}
                    agencyId={user.agency.id}
                    isAgencyDefault={true}
                />
            </div>
        </div>
    );
}
