'use client';

/**
 * Step-by-step setup guide for configuring the GHL outbound trigger webhook.
 * Shown in the settings page when GHL trigger is enabled.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Webhook } from 'lucide-react';

interface GHLTriggerSetupProps {
    webhookUrl: string;
}

export function GHLTriggerSetup({ webhookUrl }: GHLTriggerSetupProps) {
    const steps = [
        {
            title: 'Copy the webhook URL',
            description: `Copy the URL above: ${webhookUrl}`,
        },
        {
            title: 'Open GHL Workflow Builder',
            description: 'In GoHighLevel, go to Automations > Create/Edit Workflow.',
        },
        {
            title: 'Add a "Send Webhook" action',
            description: 'In your workflow, add a "Custom Webhook" or "Send Webhook" action step.',
        },
        {
            title: 'Configure the webhook',
            description: 'Set Method to POST, paste the webhook URL, and add header "x-ghl-signature" with your webhook secret.',
        },
        {
            title: 'Map the payload fields',
            description: 'Set the JSON body with: location_id (your GHL location), phone_number (contact phone), contact_id (optional), contact_name (optional).',
        },
        {
            title: 'Test the connection',
            description: 'Trigger the workflow with a test contact to verify the call is initiated or scheduled.',
        },
    ];

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    GHL Webhook Setup Guide
                </CardTitle>
                <CardDescription className="text-xs">
                    Follow these steps to connect your GHL workflows to trigger AI calls
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ol className="space-y-3">
                    {steps.map((step, i) => (
                        <li key={i} className="flex gap-3">
                            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
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
  "location_id": "your-ghl-location-id",
  "phone_number": "{{contact.phone}}",
  "contact_id": "{{contact.id}}",
  "contact_name": "{{contact.name}}"
}`}
                    </pre>
                </div>
            </CardContent>
        </Card>
    );
}
