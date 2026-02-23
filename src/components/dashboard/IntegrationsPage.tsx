'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck, Hash, Key, Calendar, Clock } from 'lucide-react';

interface Integration {
    name: string;
    description: string;
    badge: {
        text: string;
        className: string;
    } | {
        icon: React.ElementType;
        className: string;
    };
    features: string[];
}

const integrations: Integration[] = [
    {
        name: 'GoHighLevel',
        description: 'Full CRM automation for your AI voice agents',
        badge: { text: 'GHL', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
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
        badge: { text: 'HS', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
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
        badge: { icon: Calendar, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
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
        badge: { icon: CalendarCheck, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
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
        badge: { icon: Hash, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
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
        badge: { icon: Key, className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
        features: [
            'Trigger outbound calls via API',
            'Webhook-based automation',
            'Zapier & Make.com compatible',
            'Custom metadata pass-through',
        ],
    },
];

export function IntegrationsPage() {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Available integrations">
            {integrations.map((integration) => (
                <Card key={integration.name} className="relative overflow-hidden" role="listitem">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {'text' in integration.badge ? (
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold ${integration.badge.className}`} role="img" aria-label={integration.name}>
                                        {integration.badge.text}
                                    </div>
                                ) : (
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${integration.badge.className}`} role="img" aria-label={integration.name}>
                                        <integration.badge.icon className="h-5 w-5" aria-hidden="true" />
                                    </div>
                                )}
                                <CardTitle className="text-base">{integration.name}</CardTitle>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                <Clock className="h-3 w-3" />
                                Coming Soon
                            </span>
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
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
