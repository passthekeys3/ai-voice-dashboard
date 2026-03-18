'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Key, Clock, CheckCircle2, Settings2 } from 'lucide-react';
import { ApiWebhooksConfig } from './ApiWebhooksConfig';
import { TierBadge } from '@/components/ui/tier-gate';
import { hasFeature } from '@/lib/billing/tiers';
import type { PlanTier, TierFeature } from '@/lib/billing/tiers';

/* ── Brand SVG logos ─────────────────────────────────────────────── */

function GoHighLevelLogo() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M13.5 2L4 13.5h7L8.5 22 20 10.5h-7z" />
        </svg>
    );
}

function HubSpotLogo() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M18.164 7.931V5.085a2.198 2.198 0 0 0 1.266-1.978V3.05a2.199 2.199 0 0 0-2.196-2.196h-.058a2.199 2.199 0 0 0-2.196 2.196v.057a2.2 2.2 0 0 0 1.267 1.978v2.846a6.235 6.235 0 0 0-2.969 1.31L5.2 3.226a2.378 2.378 0 0 0 .079-.593 2.39 2.39 0 1 0-2.39 2.39c.421 0 .814-.11 1.155-.302l7.998 5.855a6.263 6.263 0 0 0-.976 3.388c0 1.292.393 2.492 1.064 3.493l-2.44 2.44a1.875 1.875 0 0 0-.548-.084 1.9 1.9 0 1 0 1.9 1.9 1.876 1.876 0 0 0-.084-.548l2.41-2.41a6.297 6.297 0 0 0 3.85 1.306c3.478 0 6.3-2.822 6.3-6.3a6.3 6.3 0 0 0-4.354-5.99zm-1.988 9.44a3.076 3.076 0 1 1 0-6.151 3.076 3.076 0 0 1 0 6.152z" />
        </svg>
    );
}

function GoogleCalendarLogo() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none" />
            <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="7" y="12" width="3" height="2.5" rx="0.5" fill="currentColor" />
            <rect x="10.5" y="12" width="3" height="2.5" rx="0.5" fill="currentColor" />
            <rect x="14" y="12" width="3" height="2.5" rx="0.5" fill="currentColor" />
            <rect x="7" y="15.5" width="3" height="2.5" rx="0.5" fill="currentColor" />
            <rect x="10.5" y="15.5" width="3" height="2.5" rx="0.5" fill="currentColor" />
        </svg>
    );
}

function CalendlyLogo() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 5.196 18.535l-1.602-2.77A7 7 0 1 1 12 5a6.97 6.97 0 0 1 4.243 1.428l1.722-2.67A9.953 9.953 0 0 0 12 2z" />
        </svg>
    );
}

function SlackLogo() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
    );
}

/* ── Integration data ────────────────────────────────────────────── */

interface Integration {
    name: string;
    description: string;
    logo: React.ReactNode;
    bgClassName: string;
    comingSoon: boolean;
    features: string[];
    configurable?: boolean;
    requiredFeature?: TierFeature;
    /** OAuth URL to start the connect flow (for OAuth-based integrations) */
    oauthUrl?: string;
    /** Key to check connection status in the connectedIntegrations map */
    connectionKey?: string;
}

const integrations: Integration[] = [
    {
        name: 'GoHighLevel',
        description: 'Full CRM automation for your AI voice agents',
        logo: <GoHighLevelLogo />,
        bgClassName: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
        comingSoon: false,
        requiredFeature: 'crm_integrations',
        oauthUrl: '/api/auth/crm',
        connectionKey: 'ghl',
        features: [
            'Auto-log calls to contacts',
            'Update pipeline stages',
            'Book appointments',
            'Trigger outbound calls from workflows',
            'Auto-tag contacts by sentiment',
        ],
    },
    {
        name: 'HubSpot',
        description: 'Sync AI call data with your HubSpot CRM',
        logo: <HubSpotLogo />,
        bgClassName: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
        comingSoon: false,
        requiredFeature: 'crm_integrations',
        oauthUrl: '/api/auth/hubspot',
        connectionKey: 'hubspot',
        features: [
            'Create call engagements',
            'Manage deals & pipeline',
            'Book meetings',
            'Trigger outbound calls',
            'Lead scoring & tagging',
        ],
    },
    {
        name: 'Google Calendar',
        description: 'Check availability and book events automatically',
        logo: <GoogleCalendarLogo />,
        bgClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
        comingSoon: false,
        requiredFeature: 'crm_integrations',
        oauthUrl: '/api/auth/google-calendar',
        connectionKey: 'google_calendar',
        features: [
            'Check free/busy slots',
            'Create calendar events',
            'Send attendee invitations',
            'Business hours awareness',
        ],
    },
    {
        name: 'Calendly',
        description: 'Generate scheduling links and manage bookings',
        logo: <CalendlyLogo />,
        bgClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
        comingSoon: false,
        requiredFeature: 'crm_integrations',
        oauthUrl: '/api/auth/calendly',
        connectionKey: 'calendly',
        features: [
            'Create one-time booking links',
            'Check availability',
            'Manage scheduled events',
            'Cancel bookings',
        ],
    },
    {
        name: 'Slack',
        description: 'Get real-time call notifications in your channels',
        logo: <SlackLogo />,
        bgClassName: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
        comingSoon: false,
        requiredFeature: 'crm_integrations',
        oauthUrl: '/api/auth/slack',
        connectionKey: 'slack',
        features: [
            'Call summary notifications',
            'Sentiment & score alerts',
            'Rich Block Kit formatting',
            'Custom channel routing',
        ],
    },
    {
        name: 'API / Webhooks',
        description: 'Connect Zapier, Make.com, n8n, or any HTTP client',
        logo: <Key className="h-5 w-5" aria-hidden="true" />,
        bgClassName: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
        comingSoon: false,
        configurable: true,
        requiredFeature: 'api_access',
        features: [
            'Trigger outbound calls via API',
            'Webhook-based automation',
            'Zapier & Make.com compatible',
            'Custom metadata pass-through',
        ],
    },
];

/* ── Component ───────────────────────────────────────────────────── */

interface IntegrationsPageProps {
    apiConfig?: {
        api_key?: string;
        enabled?: boolean;
        default_agent_id?: string;
        webhook_url?: string;
        webhook_signing_secret?: string;
    };
    agents?: { id: string; name: string; provider: string }[];
    appUrl?: string;
    currentTier?: PlanTier | null;
    /** Map of integration keys to their connection status */
    connectedIntegrations?: Record<string, boolean>;
}

export function IntegrationsPage({ apiConfig, agents = [], appUrl = '', currentTier = null, connectedIntegrations = {} }: IntegrationsPageProps) {
    const [apiDialogOpen, setApiDialogOpen] = useState(false);

    return (
        <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Available integrations">
                {integrations.map((integration) => {
                    // Check if this integration is locked behind a higher tier
                    const isLocked = integration.requiredFeature
                        ? !currentTier || !hasFeature(currentTier, integration.requiredFeature)
                        : false;
                    const isOAuthIntegration = !!integration.oauthUrl;
                    const isOAuthConnected = integration.connectionKey
                        ? !!connectedIntegrations[integration.connectionKey]
                        : false;
                    const isClickable = (integration.configurable || (isOAuthIntegration && !isOAuthConnected)) && !isLocked;

                    return (
                        <Card
                            key={integration.name}
                            className={`relative overflow-hidden ${
                                isClickable ? 'cursor-pointer hover:border-primary/50 focus-within:border-primary/50 transition-colors' : ''
                            } ${isLocked ? 'opacity-75' : ''}`}
                            role="listitem"
                            tabIndex={isClickable ? 0 : undefined}
                            onClick={isClickable ? () => {
                                if (isOAuthIntegration && integration.oauthUrl) {
                                    window.location.href = integration.oauthUrl;
                                } else {
                                    setApiDialogOpen(true);
                                }
                            } : undefined}
                            onKeyDown={isClickable ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    if (isOAuthIntegration && integration.oauthUrl) {
                                        window.location.href = integration.oauthUrl;
                                    } else {
                                        setApiDialogOpen(true);
                                    }
                                }
                            } : undefined}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-10 w-10 items-center justify-center rounded-lg ${integration.bgClassName}`}
                                            role="img"
                                            aria-label={integration.name}
                                        >
                                            {integration.logo}
                                        </div>
                                        <CardTitle className="text-base">{integration.name}</CardTitle>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {integration.requiredFeature && (
                                            <TierBadge feature={integration.requiredFeature} currentTier={currentTier} />
                                        )}
                                        {integration.comingSoon ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                <Clock className="h-3 w-3" />
                                                Coming Soon
                                            </span>
                                        ) : !isLocked ? (
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                (isOAuthIntegration ? isOAuthConnected : apiConfig?.enabled && apiConfig?.api_key)
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                                {(isOAuthIntegration ? isOAuthConnected : apiConfig?.enabled && apiConfig?.api_key) ? (
                                                    <>
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Connected
                                                    </>
                                                ) : (
                                                    <>
                                                        <Settings2 className="h-3 w-3" />
                                                        Configure
                                                    </>
                                                )}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {integration.description}
                                </p>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-1.5 text-sm text-muted-foreground">
                                    {integration.features.map((feature) => (
                                        <li key={feature} className="flex items-center gap-2">
                                            <span className="h-1 w-1 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                                {integration.configurable && !isLocked && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full mt-4"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setApiDialogOpen(true);
                                        }}
                                    >
                                        <Settings2 className="h-4 w-4 mr-2" />
                                        {apiConfig?.enabled ? 'Manage API Settings' : 'Set Up API Access'}
                                    </Button>
                                )}
                                {isOAuthIntegration && !isLocked && (
                                    <Button
                                        variant={isOAuthConnected ? 'outline' : 'default'}
                                        size="sm"
                                        className="w-full mt-4"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (integration.oauthUrl) {
                                                window.location.href = integration.oauthUrl;
                                            }
                                        }}
                                    >
                                        {isOAuthConnected ? 'Reconnect' : 'Connect'}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* API / Webhooks Configuration Dialog */}
            <ApiWebhooksConfig
                open={apiDialogOpen}
                onOpenChange={setApiDialogOpen}
                apiConfig={apiConfig}
                agents={agents}
                appUrl={appUrl}
            />
        </>
    );
}
