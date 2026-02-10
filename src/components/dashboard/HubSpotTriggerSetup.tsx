'use client';

/**
 * Step-by-step setup guide for configuring the HubSpot outbound trigger webhook.
 * Shown in the settings page when HubSpot trigger is enabled.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Webhook } from 'lucide-react';

interface HubSpotTriggerSetupProps {
    webhookUrl: string;
}

export function HubSpotTriggerSetup({ webhookUrl }: HubSpotTriggerSetupProps) {
    const steps = [
        {
            title: 'Copy the webhook URL',
            description: `Copy the URL above: ${webhookUrl}`,
        },
        {
            title: 'Open HubSpot Workflows',
            description: 'In HubSpot, go to Automations > Workflows > Create workflow.',
        },
        {
            title: 'Add a "Send webhook" action',
            description: 'In your workflow, add a "Send a webhook" action step.',
        },
        {
            title: 'Configure the webhook',
            description: 'Set Method to POST, paste the webhook URL. HubSpot will sign requests automatically using your app\'s client secret.',
        },
        {
            title: 'Map the payload fields',
            description: 'Set the JSON body with: portal_id (your Hub ID), phone_number (contact phone), contact_id (optional), contact_name (optional).',
        },
        {
            title: 'Test the connection',
            description: 'Enroll a test contact in the workflow to verify the call is initiated or scheduled.',
        },
    ];

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    HubSpot Webhook Setup Guide
                </CardTitle>
                <CardDescription className="text-xs">
                    Follow these steps to connect your HubSpot workflows to trigger AI calls
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ol className="space-y-3">
                    {steps.map((step, i) => (
                        <li key={i} className="flex gap-3">
                            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-orange-500/10 text-orange-600 text-xs flex items-center justify-center font-medium">
                                {i + 1}
                            </span>
                            <div>
                                <p className="text-sm font-medium">{step.title}</p>
                                <p className="text-xs text-muted-foreground">{step.description}</p>
                            </div>
                        </li>
                    ))}
                </ol>

                <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="text-xs font-medium mb-1">Example Payload</p>
                    <pre className="text-[10px] text-muted-foreground overflow-x-auto">
{`{
  "portal_id": "your-hub-id",
  "phone_number": "{{contact.phone}}",
  "contact_id": "{{contact.hs_object_id}}",
  "contact_name": "{{contact.firstname}} {{contact.lastname}}"
}`}
                    </pre>
                </div>
            </CardContent>
        </Card>
    );
}
