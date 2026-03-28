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
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="22" height="22" aria-hidden="true">
            <path d="M100 20 L160 60 L160 140 L100 180 L40 140 L40 60 Z" fill="none" stroke="currentColor" strokeWidth="14" strokeLinejoin="round" />
            <path d="M70 110 L90 130 L135 80" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
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

function GoogleWorkspaceLogo() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

function CalendlyLogo() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="22" height="22" aria-hidden="true">
            <path d="M83.5 58.5c0-5.8-2-10.8-5.9-14.8-3.9-3.9-8.9-5.9-14.8-5.9-4.2 0-8 1.1-11.4 3.3-3.4 2.2-5.9 5.2-7.5 8.9h-8.4c1.9-6 5.5-10.9 10.7-14.6 5.2-3.7 11-5.6 17.4-5.6 8.1 0 15 2.9 20.7 8.6 5.7 5.7 8.6 12.6 8.6 20.7 0 8.1-2.9 15-8.6 20.7-5.7 5.7-12.6 8.6-20.7 8.6-6.4 0-12.2-1.9-17.4-5.6-5.2-3.7-8.8-8.6-10.7-14.6h8.4c1.6 3.7 4.1 6.7 7.5 8.9 3.4 2.2 7.2 3.3 11.4 3.3 5.8 0 10.8-2 14.8-5.9 3.9-4 5.9-9 5.9-14.8z" fill="#006BFF" />
            <path d="M28 54h24v9H28z" fill="#006BFF" rx="4.5" />
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
        name: 'Google Workspace',
        description: 'Calendar, Contacts, and Sheets — all in one connection',
        logo: <GoogleWorkspaceLogo />,
        bgClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
        comingSoon: false,
        requiredFeature: 'crm_integrations',
        oauthUrl: '/api/auth/google-calendar',
        connectionKey: 'google_calendar',
        features: [
            'Check availability & book calendar events',
            'Look up Google Contacts for caller context',
            'Export call logs & analytics to Sheets',
            'Read lead lists from Sheets for outbound',
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
