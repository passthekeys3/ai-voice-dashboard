'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Webhook, Save, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import type { Workflow, WorkflowAction, WorkflowCondition, WorkflowTrigger } from '@/types';

interface WorkflowEditorProps {
    workflow?: Workflow;
    agents: { id: string; name: string }[];
}

const actionTypes = [
    { value: 'webhook', label: 'Send Webhook', description: 'POST data to any URL' },
    // GoHighLevel actions
    { value: 'ghl_log_call', label: 'Log to GoHighLevel', description: 'Add a note to the contact' },
    { value: 'ghl_create_contact', label: 'Create GHL Contact', description: 'Create a new contact if not found' },
    { value: 'ghl_upsert_contact', label: 'Upsert GHL Contact', description: 'Find or create contact with call data' },
    { value: 'ghl_add_call_note', label: 'Add Call Note (GHL)', description: 'Push call summary and transcript as note' },
    { value: 'ghl_add_tags', label: 'Auto-Tag Contact (GHL)', description: 'Apply tags based on call outcome' },
    { value: 'ghl_update_pipeline', label: 'Update Pipeline Stage', description: 'Move contact in pipeline' },
    { value: 'ghl_lead_score', label: 'Lead Qualification Score', description: 'Calculate and store lead score' },
    { value: 'ghl_book_appointment', label: 'Book Appointment (GHL)', description: 'Schedule next available slot' },
    { value: 'ghl_cancel_appointment', label: 'Cancel Appointment (GHL)', description: 'Cancel an existing appointment' },
    { value: 'ghl_trigger_workflow', label: 'Trigger GHL Workflow', description: 'Start a GHL automation (SMS, email, etc.)' },
    { value: 'ghl_update_contact_field', label: 'Update Contact Field (GHL)', description: 'Set a custom field with call data' },
    // HubSpot actions
    { value: 'hubspot_log_call', label: 'Log to HubSpot', description: 'Create call engagement in HubSpot' },
    { value: 'hubspot_create_contact', label: 'Create HubSpot Contact', description: 'Create contact if not found' },
    { value: 'hubspot_update_contact', label: 'Update HubSpot Contact', description: 'Update contact properties based on call' },
    { value: 'hubspot_upsert_contact', label: 'Upsert HubSpot Contact', description: 'Find or create contact with call data' },
    { value: 'hubspot_add_call_note', label: 'Add Call Note (HubSpot)', description: 'Push call summary and transcript as note' },
    { value: 'hubspot_add_tags', label: 'Auto-Tag Contact (HubSpot)', description: 'Apply tags based on call outcome' },
    { value: 'hubspot_update_pipeline', label: 'Update Pipeline (HubSpot)', description: 'Create/move deal in pipeline' },
    { value: 'hubspot_lead_score', label: 'Lead Score (HubSpot)', description: 'Calculate and store lead score' },
    { value: 'hubspot_book_appointment', label: 'Book Meeting (HubSpot)', description: 'Schedule a meeting for the contact' },
    { value: 'hubspot_cancel_appointment', label: 'Cancel Meeting (HubSpot)', description: 'Cancel an existing meeting' },
    { value: 'hubspot_trigger_workflow', label: 'Trigger HubSpot Workflow', description: 'Enroll contact in a HubSpot workflow' },
    { value: 'hubspot_update_contact_field', label: 'Update Contact Property (HubSpot)', description: 'Set a contact property with call data' },
    // Google Calendar actions
    { value: 'gcal_book_event', label: 'Book Event (Google Calendar)', description: 'Find next available slot and create event' },
    { value: 'gcal_cancel_event', label: 'Cancel Event (Google Calendar)', description: 'Cancel a previously booked event' },
    { value: 'gcal_check_availability', label: 'Check Availability (Google Calendar)', description: 'Check free/busy slots on calendar' },
    // Messaging actions
    { value: 'send_sms', label: 'Send SMS', description: 'Send an SMS to the caller after the call' },
    { value: 'send_email', label: 'Send Email', description: 'Send an email notification after the call' },
    { value: 'send_slack', label: 'Send Slack Notification', description: 'Post a call notification to Slack' },
    // Calendly actions
    { value: 'calendly_check_availability', label: 'Check Availability (Calendly)', description: 'Check free/busy slots on Calendly' },
    { value: 'calendly_create_booking_link', label: 'Create Booking Link (Calendly)', description: 'Generate a one-time scheduling link' },
    { value: 'calendly_cancel_event', label: 'Cancel Event (Calendly)', description: 'Cancel a scheduled Calendly event' },
];

const conditionFields = [
    { value: 'duration_seconds', label: 'Call Duration (seconds)' },
    { value: 'status', label: 'Call Status' },
    { value: 'sentiment', label: 'Sentiment' },
    { value: 'direction', label: 'Direction' },
    { value: 'from_number', label: 'From Number' },
    { value: 'to_number', label: 'To Number' },
    { value: 'cost_cents', label: 'Cost (cents)' },
    { value: 'agent_name', label: 'Agent Name' },
    { value: 'summary', label: 'Call Summary' },
    { value: 'transcript', label: 'Transcript' },
];

const conditionOperators = [
    { value: '==', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: '>', label: 'greater than' },
    { value: '<', label: 'less than' },
    { value: '>=', label: 'greater or equal' },
    { value: '<=', label: 'less or equal' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
];

export function WorkflowEditor({ workflow, agents }: WorkflowEditorProps) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState(workflow?.name || '');
    const [description, setDescription] = useState(workflow?.description || '');
    const [trigger, setTrigger] = useState<WorkflowTrigger>(workflow?.trigger || 'call_ended');
    const [agentId, setAgentId] = useState<string>(workflow?.agent_id || 'all');
    const [isActive, setIsActive] = useState(workflow?.is_active ?? true);
    const [conditions, setConditions] = useState<WorkflowCondition[]>(workflow?.conditions || []);
    const [actions, setActions] = useState<WorkflowAction[]>(
        workflow?.actions || [{ type: 'webhook', config: { url: '' } }]
    );

    const addCondition = () => {
        setConditions([...conditions, { field: 'duration_seconds', operator: '>', value: 0 }]);
    };

    const removeCondition = (index: number) => {
        setConditions(conditions.filter((_, i) => i !== index));
    };

    const updateCondition = (index: number, updates: Partial<WorkflowCondition>) => {
        setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
    };

    const addAction = () => {
        setActions([...actions, { type: 'webhook', config: { url: '' } }]);
    };

    const removeAction = (index: number) => {
        if (actions.length === 1) return;
        setActions(actions.filter((_, i) => i !== index));
    };

    const updateAction = (index: number, updates: Partial<WorkflowAction>) => {
        setActions(actions.map((a, i) => i === index ? { ...a, ...updates } : a));
    };

    const updateActionConfig = (index: number, key: string, value: string) => {
        setActions(actions.map((a, i) =>
            i === index ? { ...a, config: { ...a.config, [key]: value } } : a
        ));
    };

    const moveActionUp = (index: number) => {
        if (index === 0) return;
        const newActions = [...actions];
        [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
        setActions(newActions);
    };

    const moveActionDown = (index: number) => {
        if (index === actions.length - 1) return;
        const newActions = [...actions];
        [newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]];
        setActions(newActions);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        if (actions.length === 0) {
            setError('At least one action is required');
            return;
        }

        // Validate webhook URLs
        for (const action of actions) {
            if (action.type === 'webhook' && !action.config.url) {
                setError('Webhook URL is required');
                return;
            }
        }

        setSaving(true);
        setError(null);

        try {
            const body = {
                name,
                description,
                trigger,
                agent_id: agentId === 'all' ? null : agentId,
                conditions,
                actions,
                is_active: isActive,
            };

            const response = await fetch(
                workflow ? `/api/workflows/${workflow.id}` : '/api/workflows',
                {
                    method: workflow ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save workflow');
            }

            router.push('/workflows');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <fieldset disabled={saving} className="border-0 p-0 m-0 space-y-6">
            {/* Basic Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>Give your workflow a name and description</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Workflow Name *</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Send to Zapier on call end"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What does this workflow do?"
                            rows={2}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="is-active">Active</Label>
                            <p className="text-sm text-muted-foreground">
                                Enable or disable this workflow
                            </p>
                        </div>
                        <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
                    </div>
                </CardContent>
            </Card>

            {/* Trigger */}
            <Card>
                <CardHeader>
                    <CardTitle>Trigger</CardTitle>
                    <CardDescription>When should this workflow run?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="trigger-event">Trigger Event</Label>
                            <Select value={trigger} onValueChange={(v: string) => setTrigger(v as WorkflowTrigger)}>
                                <SelectTrigger id="trigger-event">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="call_ended">When Call Ends</SelectItem>
                                    <SelectItem value="call_started">When Call Starts</SelectItem>
                                    <SelectItem value="inbound_call_started">When Inbound Call Starts</SelectItem>
                                    <SelectItem value="inbound_call_ended">When Inbound Call Ends</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="agent">Agent</Label>
                            <Select value={agentId} onValueChange={setAgentId}>
                                <SelectTrigger id="agent">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Agents</SelectItem>
                                    {agents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
                <CardHeader>
                    <CardTitle>Conditions (Optional)</CardTitle>
                    <CardDescription>Only run when these conditions are met</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {conditions.map((condition, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Select
                                value={condition.field}
                                onValueChange={(v: string) => updateCondition(index, { field: v })}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {conditionFields.map((f) => (
                                        <SelectItem key={f.value} value={f.value}>
                                            {f.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={condition.operator}
                                onValueChange={(v: string) => updateCondition(index, { operator: v as WorkflowCondition['operator'] })}
                            >
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {conditionOperators.map((op) => (
                                        <SelectItem key={op.value} value={op.value}>
                                            {op.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                id={`condition-${index}-value`}
                                value={String(condition.value)}
                                onChange={(e) => updateCondition(index, {
                                    value: e.target.value === '' || isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)
                                })}
                                placeholder="Value"
                                className="flex-1"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeCondition(index)}
                                aria-label="Remove condition"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" onClick={addCondition}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Condition
                    </Button>
                </CardContent>
            </Card>

            {/* Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Actions *</CardTitle>
                    <CardDescription>What should happen when this workflow runs?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {actions.map((action, index) => (
                        <Card key={index} className="bg-slate-50 dark:bg-slate-900">
                            <CardContent className="pt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <Select
                                        value={action.type}
                                        onValueChange={(v: string) => updateAction(index, {
                                            type: v as WorkflowAction['type'],
                                            config: v === 'webhook' ? { url: '' } : {}
                                        })}
                                    >
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {actionTypes.map((t) => (
                                                <SelectItem key={t.value} value={t.value}>
                                                    {t.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => moveActionUp(index)}
                                            disabled={index === 0}
                                            aria-label="Move action up"
                                        >
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => moveActionDown(index)}
                                            disabled={index === actions.length - 1}
                                            aria-label="Move action down"
                                        >
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        {actions.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeAction(index)}
                                                aria-label="Remove action"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Webhook config */}
                                {action.type === 'webhook' && (
                                    <div className="space-y-2">
                                        <Label htmlFor={`action-${index}-url`}>Webhook URL *</Label>
                                        <div className="flex items-center gap-2">
                                            <Webhook className="h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id={`action-${index}-url`}
                                                value={(action.config.url as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'url', e.target.value)}
                                                placeholder="https://hooks.zapier.com/..."
                                                className="flex-1"
                                            />
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            We&apos;ll POST call data (transcript, summary, recording, etc.) to this URL
                                        </p>
                                    </div>
                                )}

                                {/* GHL config */}
                                {action.type === 'ghl_create_contact' && (
                                    <div className="space-y-2">
                                        <Label htmlFor={`action-${index}-tags`}>Tags (comma-separated)</Label>
                                        <Input
                                            id={`action-${index}-tags`}
                                            value={(action.config.tags as string) || ''}
                                            onChange={(e) => updateActionConfig(index, 'tags', e.target.value)}
                                            placeholder="ai-call, new-lead"
                                        />
                                    </div>
                                )}

                                {action.type === 'ghl_log_call' && (
                                    <p className="text-sm text-muted-foreground">
                                        Will log call details as a note on the contact in GoHighLevel
                                    </p>
                                )}

                                {/* Auto-Tag config */}
                                {action.type === 'ghl_add_tags' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Automatically apply tags based on call sentiment, duration, and keywords
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-always-add`}>Always Add Tags (comma-separated)</Label>
                                            <Input
                                                id={`action-${index}-always-add`}
                                                value={(action.config.always_add as string) || 'ai-voice-call'}
                                                onChange={(e) => updateActionConfig(index, 'always_add', e.target.value)}
                                                placeholder="ai-voice-call, contacted"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-positive-tags`}>Positive Sentiment Tags</Label>
                                            <Input
                                                id={`action-${index}-positive-tags`}
                                                value={(action.config.positive_tags as string) || 'hot-lead, satisfied'}
                                                onChange={(e) => updateActionConfig(index, 'positive_tags', e.target.value)}
                                                placeholder="hot-lead, satisfied"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-negative-tags`}>Negative Sentiment Tags</Label>
                                            <Input
                                                id={`action-${index}-negative-tags`}
                                                value={(action.config.negative_tags as string) || 'needs-follow-up'}
                                                onChange={(e) => updateActionConfig(index, 'negative_tags', e.target.value)}
                                                placeholder="needs-follow-up, cold-lead"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-long-call-tags`}>Long Call Tags (5+ min)</Label>
                                                <Input
                                                    id={`action-${index}-long-call-tags`}
                                                    value={(action.config.long_call_tags as string) || 'engaged'}
                                                    onChange={(e) => updateActionConfig(index, 'long_call_tags', e.target.value)}
                                                    placeholder="engaged, high-interest"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-short-call-tags`}>Short Call Tags (&lt;30s)</Label>
                                                <Input
                                                    id={`action-${index}-short-call-tags`}
                                                    value={(action.config.short_call_tags as string) || 'quick-call'}
                                                    onChange={(e) => updateActionConfig(index, 'short_call_tags', e.target.value)}
                                                    placeholder="quick-call, no-answer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Pipeline Update config */}
                                {action.type === 'ghl_update_pipeline' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Move contacts to pipeline stages based on call outcomes
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-pipeline-id`}>Pipeline ID *</Label>
                                            <Input
                                                id={`action-${index}-pipeline-id`}
                                                value={(action.config.pipeline_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'pipeline_id', e.target.value)}
                                                placeholder="Enter your GHL pipeline ID"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Find in GHL → Settings → Pipelines → Click pipeline → Copy ID from URL
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-positive-stage-id`}>Positive Sentiment Stage ID</Label>
                                            <Input
                                                id={`action-${index}-positive-stage-id`}
                                                value={(action.config.positive_stage_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'positive_stage_id', e.target.value)}
                                                placeholder="Stage ID for positive calls"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-negative-stage-id`}>Negative Sentiment Stage ID</Label>
                                            <Input
                                                id={`action-${index}-negative-stage-id`}
                                                value={(action.config.negative_stage_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'negative_stage_id', e.target.value)}
                                                placeholder="Stage ID for negative calls"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-default-stage-id`}>Default Stage ID</Label>
                                            <Input
                                                id={`action-${index}-default-stage-id`}
                                                value={(action.config.default_stage_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'default_stage_id', e.target.value)}
                                                placeholder="Stage ID for all other calls"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Lead Score config */}
                                {action.type === 'ghl_lead_score' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Calculate a 0-100 lead score and store it in a custom field
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-custom-field-key`}>Custom Field Key</Label>
                                            <Input
                                                id={`action-${index}-custom-field-key`}
                                                value={(action.config.custom_field_key as string) || 'lead_score'}
                                                onChange={(e) => updateActionConfig(index, 'custom_field_key', e.target.value)}
                                                placeholder="lead_score"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Create this custom field in GHL first
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-positive-sentiment-score`}>Positive Sentiment (+)</Label>
                                                <Input
                                                    id={`action-${index}-positive-sentiment-score`}
                                                    type="number"
                                                    value={(action.config.positive_sentiment_score as string) || '25'}
                                                    onChange={(e) => updateActionConfig(index, 'positive_sentiment_score', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-negative-sentiment-score`}>Negative Sentiment (-)</Label>
                                                <Input
                                                    id={`action-${index}-negative-sentiment-score`}
                                                    type="number"
                                                    value={(action.config.negative_sentiment_score as string) || '-15'}
                                                    onChange={(e) => updateActionConfig(index, 'negative_sentiment_score', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-long-call-score`}>Long Call Bonus (+)</Label>
                                                <Input
                                                    id={`action-${index}-long-call-score`}
                                                    type="number"
                                                    value={(action.config.long_call_score as string) || '20'}
                                                    onChange={(e) => updateActionConfig(index, 'long_call_score', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-short-call-score`}>Short Call Penalty (-)</Label>
                                                <Input
                                                    id={`action-${index}-short-call-score`}
                                                    type="number"
                                                    value={(action.config.short_call_score as string) || '-10'}
                                                    onChange={(e) => updateActionConfig(index, 'short_call_score', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-base-score`}>Base Score</Label>
                                            <Input
                                                id={`action-${index}-base-score`}
                                                type="number"
                                                value={(action.config.base_score as string) || '50'}
                                                onChange={(e) => updateActionConfig(index, 'base_score', e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Starting score before adjustments (0-100)
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* HubSpot Log Call */}
                                {action.type === 'hubspot_log_call' && (
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            Creates a call engagement in HubSpot with the call details, transcript, and summary.
                                            Automatically finds or creates a contact by phone number.
                                        </p>
                                        <p className="text-xs text-orange-600">
                                            Requires HubSpot integration to be connected in Settings
                                        </p>
                                    </div>
                                )}

                                {/* HubSpot Create Contact */}
                                {action.type === 'hubspot_create_contact' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Creates a new contact in HubSpot if one doesn&apos;t exist for the caller&apos;s phone number
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-first-name`}>Default First Name</Label>
                                            <Input
                                                id={`action-${index}-first-name`}
                                                value={(action.config.first_name as string) || 'Unknown'}
                                                onChange={(e) => updateActionConfig(index, 'first_name', e.target.value)}
                                                placeholder="Unknown"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-lead-status`}>Lead Status</Label>
                                            <Input
                                                id={`action-${index}-lead-status`}
                                                value={(action.config.lead_status as string) || 'NEW'}
                                                onChange={(e) => updateActionConfig(index, 'lead_status', e.target.value)}
                                                placeholder="NEW"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                HubSpot lead status for new contacts
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* HubSpot Update Contact */}
                                {action.type === 'hubspot_update_contact' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Update contact properties based on call outcome
                                        </p>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-positive-lead-status`}>Positive Sentiment Status</Label>
                                                <Input
                                                    id={`action-${index}-positive-lead-status`}
                                                    value={(action.config.positive_lead_status as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'positive_lead_status', e.target.value)}
                                                    placeholder="QUALIFIED"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-negative-lead-status`}>Negative Sentiment Status</Label>
                                                <Input
                                                    id={`action-${index}-negative-lead-status`}
                                                    value={(action.config.negative_lead_status as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'negative_lead_status', e.target.value)}
                                                    placeholder="UNQUALIFIED"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-default-lead-status`}>Default Status</Label>
                                                <Input
                                                    id={`action-${index}-default-lead-status`}
                                                    value={(action.config.default_lead_status as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'default_lead_status', e.target.value)}
                                                    placeholder="IN_PROGRESS"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-custom-property-name`}>Custom Property Name (optional)</Label>
                                                <Input
                                                    id={`action-${index}-custom-property-name`}
                                                    value={(action.config.custom_property_name as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'custom_property_name', e.target.value)}
                                                    placeholder="ai_call_sentiment"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-custom-property-value`}>Custom Property Value (optional)</Label>
                                                <Input
                                                    id={`action-${index}-custom-property-value`}
                                                    value={(action.config.custom_property_value as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'custom_property_value', e.target.value)}
                                                    placeholder="processed"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* HubSpot Upsert Contact */}
                                {action.type === 'hubspot_upsert_contact' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Find or create a HubSpot contact by phone number with auto-tagging based on call data
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-default-tags`}>Default Tags (comma-separated)</Label>
                                            <Input
                                                id={`action-${index}-default-tags`}
                                                value={(action.config.default_tags as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'default_tags', e.target.value)}
                                                placeholder="ai-voice-call, buildvoiceai"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-source`}>Contact Source</Label>
                                            <Input
                                                id={`action-${index}-source`}
                                                value={(action.config.source as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'source', e.target.value)}
                                                placeholder="BuildVoiceAI Call"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* HubSpot Add Call Note */}
                                {action.type === 'hubspot_add_call_note' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Attach a formatted call note to the HubSpot contact with summary, transcript, and sentiment
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <Switch
                                                id={`action-${index}-include-transcript`}
                                                checked={action.config.include_transcript !== 'false'}
                                                onCheckedChange={(checked: boolean) => updateActionConfig(index, 'include_transcript', checked ? 'true' : 'false')}
                                            />
                                            <Label htmlFor={`action-${index}-include-transcript`}>Include transcript in note</Label>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-max-transcript-length`}>Max Transcript Length</Label>
                                            <Input
                                                id={`action-${index}-max-transcript-length`}
                                                type="number"
                                                value={(action.config.max_transcript_length as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'max_transcript_length', e.target.value)}
                                                placeholder="2000 (characters)"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* HubSpot Add Tags */}
                                {action.type === 'hubspot_add_tags' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Auto-tag the HubSpot contact based on call sentiment, duration, and keywords.
                                            Tags are stored in a custom &quot;ai_call_tags&quot; property.
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-always-add`}>Always Add Tags (comma-separated)</Label>
                                            <Input
                                                id={`action-${index}-always-add`}
                                                value={(action.config.always_add as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'always_add', e.target.value)}
                                                placeholder="ai-called, buildvoiceai"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-positive-tags`}>Positive Sentiment Tags</Label>
                                                <Input
                                                    id={`action-${index}-positive-tags`}
                                                    value={(action.config.positive_tags as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'positive_tags', e.target.value)}
                                                    placeholder="positive-call, interested"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-negative-tags`}>Negative Sentiment Tags</Label>
                                                <Input
                                                    id={`action-${index}-negative-tags`}
                                                    value={(action.config.negative_tags as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'negative_tags', e.target.value)}
                                                    placeholder="negative-call, not-interested"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-short-call-tags`}>Short Call Tags (&le;30s)</Label>
                                                <Input
                                                    id={`action-${index}-short-call-tags`}
                                                    value={(action.config.short_call_tags as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'short_call_tags', e.target.value)}
                                                    placeholder="short-call, no-answer"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-long-call-tags`}>Long Call Tags (&ge;5min)</Label>
                                                <Input
                                                    id={`action-${index}-long-call-tags`}
                                                    value={(action.config.long_call_tags as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'long_call_tags', e.target.value)}
                                                    placeholder="long-call, engaged"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* HubSpot Update Pipeline */}
                                {action.type === 'hubspot_update_pipeline' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Create or update a deal in a HubSpot pipeline based on call sentiment
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-pipeline-id`}>Pipeline ID *</Label>
                                            <Input
                                                id={`action-${index}-pipeline-id`}
                                                value={(action.config.pipeline_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'pipeline_id', e.target.value)}
                                                placeholder="Enter your HubSpot pipeline ID"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Find in HubSpot &rarr; Deals &rarr; Board actions &rarr; Edit stages &rarr; Copy pipeline ID
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-default-stage-id`}>Default Stage ID</Label>
                                                <Input
                                                    id={`action-${index}-default-stage-id`}
                                                    value={(action.config.default_stage_id as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'default_stage_id', e.target.value)}
                                                    placeholder="appointmentscheduled"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-positive-stage-id`}>Positive Stage ID</Label>
                                                <Input
                                                    id={`action-${index}-positive-stage-id`}
                                                    value={(action.config.positive_stage_id as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'positive_stage_id', e.target.value)}
                                                    placeholder="qualifiedtobuy"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-negative-stage-id`}>Negative Stage ID</Label>
                                                <Input
                                                    id={`action-${index}-negative-stage-id`}
                                                    value={(action.config.negative_stage_id as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'negative_stage_id', e.target.value)}
                                                    placeholder="closedlost"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* HubSpot Lead Score */}
                                {action.type === 'hubspot_lead_score' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Calculate a lead qualification score (0-100) and store it on the HubSpot contact
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-property-name`}>Property Name</Label>
                                            <Input
                                                id={`action-${index}-property-name`}
                                                value={(action.config.property_name as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'property_name', e.target.value)}
                                                placeholder="ai_lead_score"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                HubSpot contact property to store the score in
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-positive-sentiment-score`}>Positive Sentiment Score</Label>
                                                <Input
                                                    id={`action-${index}-positive-sentiment-score`}
                                                    type="number"
                                                    value={(action.config.positive_sentiment_score as string) || '25'}
                                                    onChange={(e) => updateActionConfig(index, 'positive_sentiment_score', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-negative-sentiment-score`}>Negative Sentiment Score</Label>
                                                <Input
                                                    id={`action-${index}-negative-sentiment-score`}
                                                    type="number"
                                                    value={(action.config.negative_sentiment_score as string) || '-15'}
                                                    onChange={(e) => updateActionConfig(index, 'negative_sentiment_score', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-long-call-score`}>Long Call Score</Label>
                                                <Input
                                                    id={`action-${index}-long-call-score`}
                                                    type="number"
                                                    value={(action.config.long_call_score as string) || '20'}
                                                    onChange={(e) => updateActionConfig(index, 'long_call_score', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-short-call-score`}>Short Call Score</Label>
                                                <Input
                                                    id={`action-${index}-short-call-score`}
                                                    type="number"
                                                    value={(action.config.short_call_score as string) || '-10'}
                                                    onChange={(e) => updateActionConfig(index, 'short_call_score', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-base-score`}>Base Score</Label>
                                            <Input
                                                id={`action-${index}-base-score`}
                                                type="number"
                                                value={(action.config.base_score as string) || '50'}
                                                onChange={(e) => updateActionConfig(index, 'base_score', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* HubSpot Book Meeting */}
                                {action.type === 'hubspot_book_appointment' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Create a meeting in HubSpot associated with the contact
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-meeting-title`}>Meeting Title</Label>
                                            <Input
                                                id={`action-${index}-meeting-title`}
                                                value={(action.config.meeting_title as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'meeting_title', e.target.value)}
                                                placeholder="AI Call Follow-up"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-days-ahead`}>Days Ahead</Label>
                                                <Input
                                                    id={`action-${index}-days-ahead`}
                                                    type="number"
                                                    value={(action.config.days_ahead as string) || '1'}
                                                    onChange={(e) => updateActionConfig(index, 'days_ahead', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-preferred-hour`}>Preferred Hour (24h)</Label>
                                                <Input
                                                    id={`action-${index}-preferred-hour`}
                                                    type="number"
                                                    value={(action.config.preferred_hour as string) || '10'}
                                                    onChange={(e) => updateActionConfig(index, 'preferred_hour', e.target.value)}
                                                    min="0"
                                                    max="23"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-duration-minutes`}>Duration (minutes)</Label>
                                                <Input
                                                    id={`action-${index}-duration-minutes`}
                                                    type="number"
                                                    value={(action.config.duration_minutes as string) || '30'}
                                                    onChange={(e) => updateActionConfig(index, 'duration_minutes', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-description`}>Description</Label>
                                            <Input
                                                id={`action-${index}-description`}
                                                value={(action.config.description as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'description', e.target.value)}
                                                placeholder="Booked automatically after AI voice call"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-timezone`}>Timezone</Label>
                                            <Input
                                                id={`action-${index}-timezone`}
                                                value={(action.config.timezone as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'timezone', e.target.value)}
                                                placeholder="America/New_York (leave blank for UTC)"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* HubSpot Cancel Meeting */}
                                {action.type === 'hubspot_cancel_appointment' && (
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            Cancel a HubSpot meeting by ID. The meeting ID should be passed in the call metadata
                                            or configured below.
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-meeting-id`}>Meeting ID (optional)</Label>
                                            <Input
                                                id={`action-${index}-meeting-id`}
                                                value={(action.config.meeting_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'meeting_id', e.target.value)}
                                                placeholder="Leave empty to use metadata.meeting_id"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* HubSpot Trigger Workflow */}
                                {action.type === 'hubspot_trigger_workflow' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Enroll the contact in a HubSpot workflow to trigger follow-up sequences
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-hubspot-workflow-id`}>HubSpot Workflow ID *</Label>
                                            <Input
                                                id={`action-${index}-hubspot-workflow-id`}
                                                value={(action.config.hubspot_workflow_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'hubspot_workflow_id', e.target.value)}
                                                placeholder="Enter HubSpot workflow ID"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Find in HubSpot &rarr; Automations &rarr; Workflows &rarr; Click workflow &rarr; Copy ID from URL
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* HubSpot Update Contact Property */}
                                {action.type === 'hubspot_update_contact_field' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Update a specific HubSpot contact property using call data template variables
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-property-name`}>Property Name *</Label>
                                            <Input
                                                id={`action-${index}-property-name`}
                                                value={(action.config.property_name as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'property_name', e.target.value)}
                                                placeholder="ai_call_summary"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-value-template`}>Value Template *</Label>
                                            <Input
                                                id={`action-${index}-value-template`}
                                                value={(action.config.value_template as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'value_template', e.target.value)}
                                                placeholder="{{summary}}"
                                            />
                                        </div>
                                        <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
                                            <p className="font-medium mb-1">Available template variables:</p>
                                            <div className="grid grid-cols-2 gap-1">
                                                <span>{`{{summary}}`} - Call summary</span>
                                                <span>{`{{sentiment}}`} - Call sentiment</span>
                                                <span>{`{{duration}}`} - Duration (seconds)</span>
                                                <span>{`{{duration_minutes}}`} - Duration (minutes)</span>
                                                <span>{`{{agent_name}}`} - Agent name</span>
                                                <span>{`{{direction}}`} - Call direction</span>
                                                <span>{`{{from_number}}`} - Caller number</span>
                                                <span>{`{{to_number}}`} - Called number</span>
                                                <span>{`{{status}}`} - Call status</span>
                                                <span>{`{{recording_url}}`} - Recording URL</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* GHL Book Appointment */}
                                {action.type === 'ghl_book_appointment' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Automatically book the next available appointment slot in GoHighLevel
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-calendar-id`}>Calendar ID *</Label>
                                            <Input
                                                id={`action-${index}-calendar-id`}
                                                value={(action.config.calendar_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'calendar_id', e.target.value)}
                                                placeholder="Enter your GHL calendar ID"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Find in GHL → Settings → Calendars → Click calendar → Copy ID from URL
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-appointment-title`}>Appointment Title</Label>
                                            <Input
                                                id={`action-${index}-appointment-title`}
                                                value={(action.config.appointment_title as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'appointment_title', e.target.value)}
                                                placeholder="AI Call Follow-up"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-days-ahead`}>Days to Search Ahead</Label>
                                                <Input
                                                    id={`action-${index}-days-ahead`}
                                                    type="number"
                                                    value={(action.config.days_ahead as string) || '7'}
                                                    onChange={(e) => updateActionConfig(index, 'days_ahead', e.target.value)}
                                                    min="1"
                                                    max="30"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    How far ahead to look for slots (1-30 days)
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-duration-minutes`}>Duration (minutes)</Label>
                                                <Input
                                                    id={`action-${index}-duration-minutes`}
                                                    type="number"
                                                    value={(action.config.duration_minutes as string) || '30'}
                                                    onChange={(e) => updateActionConfig(index, 'duration_minutes', e.target.value)}
                                                    min="15"
                                                    max="120"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-timezone`}>Timezone (optional)</Label>
                                            <Input
                                                id={`action-${index}-timezone`}
                                                value={(action.config.timezone as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'timezone', e.target.value)}
                                                placeholder="America/New_York"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                IANA timezone name (e.g., America/Chicago, Europe/London)
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-notes`}>Notes (optional)</Label>
                                            <Textarea
                                                id={`action-${index}-notes`}
                                                value={(action.config.notes as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'notes', e.target.value)}
                                                placeholder="Booked automatically after AI voice call"
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* GHL Cancel Appointment */}
                                {action.type === 'ghl_cancel_appointment' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Cancel an existing appointment. The appointment ID should be passed in the call metadata or configured below.
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-appointment-id`}>Appointment ID (optional)</Label>
                                            <Input
                                                id={`action-${index}-appointment-id`}
                                                value={(action.config.appointment_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'appointment_id', e.target.value)}
                                                placeholder="Leave empty to use metadata.appointment_id"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                If empty, will look for appointment_id in the call metadata
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* GHL Upsert Contact */}
                                {action.type === 'ghl_upsert_contact' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Find or create a GHL contact by phone number, then update with call data and tags.
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-default-tags`}>Default Tags (comma-separated)</Label>
                                            <Input
                                                id={`action-${index}-default-tags`}
                                                value={(action.config.default_tags as string) || 'ai-call'}
                                                onChange={(e) => updateActionConfig(index, 'default_tags', e.target.value)}
                                                placeholder="ai-call, new-lead"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-source`}>Source</Label>
                                            <Input
                                                id={`action-${index}-source`}
                                                value={(action.config.source as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'source', e.target.value)}
                                                placeholder="BuildVoiceAI Call"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-custom-field-key`}>Custom Field Key (optional)</Label>
                                            <Input
                                                id={`action-${index}-custom-field-key`}
                                                value={(action.config.custom_field_key as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'custom_field_key', e.target.value)}
                                                placeholder="e.g. ai_call_summary"
                                            />
                                        </div>
                                        {(action.config.custom_field_key as string) && (
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-custom-field-value`}>Custom Field Value</Label>
                                                <Input
                                                    id={`action-${index}-custom-field-value`}
                                                    value={(action.config.custom_field_value as string) || ''}
                                                    onChange={(e) => updateActionConfig(index, 'custom_field_value', e.target.value)}
                                                    placeholder="Leave blank to use call summary"
                                                />
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                id={`action-${index}-add-sentiment-tags`}
                                                checked={action.config.add_sentiment_tags !== 'false'}
                                                onCheckedChange={(v: boolean) => updateActionConfig(index, 'add_sentiment_tags', String(v))}
                                            />
                                            <Label htmlFor={`action-${index}-add-sentiment-tags`}>Auto-add sentiment tags (e.g., positive-sentiment, negative-sentiment)</Label>
                                        </div>
                                    </div>
                                )}

                                {/* GHL Add Call Note */}
                                {action.type === 'ghl_add_call_note' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Push a formatted call summary as a note on the GHL contact. Includes call details, summary, and optionally the transcript.
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                id={`action-${index}-include-transcript`}
                                                checked={action.config.include_transcript !== 'false'}
                                                onCheckedChange={(v: boolean) => updateActionConfig(index, 'include_transcript', String(v))}
                                            />
                                            <Label htmlFor={`action-${index}-include-transcript`}>Include call transcript in note</Label>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-max-transcript-length`}>Max Transcript Length (characters)</Label>
                                            <Input
                                                id={`action-${index}-max-transcript-length`}
                                                type="number"
                                                value={(action.config.max_transcript_length as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'max_transcript_length', e.target.value)}
                                                placeholder="2000 (leave blank for full transcript)"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* GHL Trigger Workflow */}
                                {action.type === 'ghl_trigger_workflow' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Start a GHL automation workflow for the contact. Use this to trigger SMS follow-ups, email sequences, or other automations.
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-ghl-workflow-id`}>GHL Workflow ID *</Label>
                                            <Input
                                                id={`action-${index}-ghl-workflow-id`}
                                                value={(action.config.ghl_workflow_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'ghl_workflow_id', e.target.value)}
                                                placeholder="Enter your GHL workflow ID"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Find in GHL → Automation → Workflows → Click workflow → Copy ID from URL
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* GHL Update Contact Field */}
                                {action.type === 'ghl_update_contact_field' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Set a custom field on the GHL contact using call data. Use template variables for dynamic values.
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-field-key`}>Custom Field Key *</Label>
                                            <Input
                                                id={`action-${index}-field-key`}
                                                value={(action.config.field_key as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'field_key', e.target.value)}
                                                placeholder="e.g., last_ai_call_summary"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                The custom field must already exist in GHL
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-value-template`}>Field Value *</Label>
                                            <Input
                                                id={`action-${index}-value-template`}
                                                value={(action.config.value_template as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'value_template', e.target.value)}
                                                placeholder="e.g., {{summary}}"
                                            />
                                        </div>
                                        <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3">
                                            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Available Variables</p>
                                            <div className="grid grid-cols-2 gap-1 text-xs text-blue-600 dark:text-blue-400">
                                                <span>{'{{summary}}'} - Call summary</span>
                                                <span>{'{{sentiment}}'} - Sentiment</span>
                                                <span>{'{{duration}}'} - Duration (seconds)</span>
                                                <span>{'{{agent_name}}'} - Agent name</span>
                                                <span>{'{{direction}}'} - Call direction</span>
                                                <span>{'{{status}}'} - Call status</span>
                                                <span>{'{{from_number}}'} - Caller number</span>
                                                <span>{'{{to_number}}'} - Called number</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Google Calendar Book Event */}
                                {action.type === 'gcal_book_event' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Find the next available slot on your Google Calendar and book an event automatically
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-gcal-calendar-id`}>Calendar ID</Label>
                                            <Input
                                                id={`action-${index}-gcal-calendar-id`}
                                                value={(action.config.calendar_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'calendar_id', e.target.value)}
                                                placeholder="primary (uses default from settings)"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Leave empty to use your default calendar from Settings
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-gcal-event-title`}>Event Title</Label>
                                            <Input
                                                id={`action-${index}-gcal-event-title`}
                                                value={(action.config.event_title as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'event_title', e.target.value)}
                                                placeholder="AI Call Follow-up"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-gcal-description`}>Description</Label>
                                            <Textarea
                                                id={`action-${index}-gcal-description`}
                                                value={(action.config.description as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'description', e.target.value)}
                                                placeholder="Booked automatically after AI voice call"
                                                rows={2}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-gcal-days-ahead`}>Days to Search Ahead</Label>
                                                <Input
                                                    id={`action-${index}-gcal-days-ahead`}
                                                    type="number"
                                                    value={(action.config.days_ahead as string) || '7'}
                                                    onChange={(e) => updateActionConfig(index, 'days_ahead', e.target.value)}
                                                    min="1"
                                                    max="30"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-gcal-duration`}>Duration (minutes)</Label>
                                                <Input
                                                    id={`action-${index}-gcal-duration`}
                                                    type="number"
                                                    value={(action.config.duration_minutes as string) || '30'}
                                                    onChange={(e) => updateActionConfig(index, 'duration_minutes', e.target.value)}
                                                    min="15"
                                                    max="120"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-gcal-start-hour`}>Start Hour</Label>
                                                <Input
                                                    id={`action-${index}-gcal-start-hour`}
                                                    type="number"
                                                    value={(action.config.start_hour as string) || '9'}
                                                    onChange={(e) => updateActionConfig(index, 'start_hour', e.target.value)}
                                                    min="0"
                                                    max="23"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`action-${index}-gcal-end-hour`}>End Hour</Label>
                                                <Input
                                                    id={`action-${index}-gcal-end-hour`}
                                                    type="number"
                                                    value={(action.config.end_hour as string) || '17'}
                                                    onChange={(e) => updateActionConfig(index, 'end_hour', e.target.value)}
                                                    min="0"
                                                    max="23"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-gcal-timezone`}>Timezone (optional)</Label>
                                            <Input
                                                id={`action-${index}-gcal-timezone`}
                                                value={(action.config.timezone as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'timezone', e.target.value)}
                                                placeholder="America/New_York"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-gcal-attendee`}>Attendee Email (optional)</Label>
                                            <Input
                                                id={`action-${index}-gcal-attendee`}
                                                value={(action.config.attendee_email as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'attendee_email', e.target.value)}
                                                placeholder="contact@example.com"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Google Calendar Cancel Event */}
                                {action.type === 'gcal_cancel_event' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Cancel a previously booked Google Calendar event. The event ID should be passed in call metadata or configured below.
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-gcal-event-id`}>Event ID (optional)</Label>
                                            <Input
                                                id={`action-${index}-gcal-event-id`}
                                                value={(action.config.event_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'event_id', e.target.value)}
                                                placeholder="Leave empty to use metadata.gcal_event_id"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                If empty, will look for gcal_event_id in the call metadata
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-gcal-cancel-calendar-id`}>Calendar ID</Label>
                                            <Input
                                                id={`action-${index}-gcal-cancel-calendar-id`}
                                                value={(action.config.calendar_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'calendar_id', e.target.value)}
                                                placeholder="primary (uses default from settings)"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Google Calendar Check Availability */}
                                {action.type === 'gcal_check_availability' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Check free/busy availability on your Google Calendar. Primarily informational — logs busy slot count.
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-gcal-avail-calendar-id`}>Calendar ID</Label>
                                            <Input
                                                id={`action-${index}-gcal-avail-calendar-id`}
                                                value={(action.config.calendar_id as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'calendar_id', e.target.value)}
                                                placeholder="primary (uses default from settings)"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-gcal-hours-ahead`}>Hours Ahead</Label>
                                            <Input
                                                id={`action-${index}-gcal-hours-ahead`}
                                                type="number"
                                                value={(action.config.hours_ahead as string) || '24'}
                                                onChange={(e) => updateActionConfig(index, 'hours_ahead', e.target.value)}
                                                min="1"
                                                max="168"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                How many hours ahead to check (1-168)
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-gcal-avail-timezone`}>Timezone (optional)</Label>
                                            <Input
                                                id={`action-${index}-gcal-avail-timezone`}
                                                value={(action.config.timezone as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'timezone', e.target.value)}
                                                placeholder="America/New_York"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* SMS config */}
                                {action.type === 'send_sms' && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-sms-to`}>Recipient Phone Number</Label>
                                            <Input
                                                id={`action-${index}-sms-to`}
                                                value={(action.config.to as string) || '{{from_number}}'}
                                                onChange={(e) => updateActionConfig(index, 'to', e.target.value)}
                                                placeholder="{{from_number}} or +1234567890"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Use {'{{from_number}}'} to send to the caller&apos;s number
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-sms-message`}>Message *</Label>
                                            <Textarea
                                                id={`action-${index}-sms-message`}
                                                value={(action.config.message as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'message', e.target.value)}
                                                placeholder="Hi! Thanks for your call with {{agent_name}}. Here's a summary: {{summary}}"
                                                rows={3}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Variables: {'{{from_number}}, {{to_number}}, {{agent_name}}, {{summary}}, {{sentiment}}, {{duration_minutes}}, {{recording_url}}'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Email config */}
                                {action.type === 'send_email' && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-email-to`}>Recipient Email *</Label>
                                            <Input
                                                id={`action-${index}-email-to`}
                                                value={(action.config.to as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'to', e.target.value)}
                                                placeholder="customer@example.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-email-subject`}>Subject *</Label>
                                            <Input
                                                id={`action-${index}-email-subject`}
                                                value={(action.config.subject as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'subject', e.target.value)}
                                                placeholder="Call Summary from {{agent_name}}"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-email-body`}>Email Body (HTML supported)</Label>
                                            <Textarea
                                                id={`action-${index}-email-body`}
                                                value={(action.config.body as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'body', e.target.value)}
                                                placeholder="<p>Hi,</p><p>Here is a summary of your call: {{summary}}</p>"
                                                rows={5}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Variables: {'{{from_number}}, {{to_number}}, {{agent_name}}, {{summary}}, {{sentiment}}, {{duration_minutes}}, {{recording_url}}'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Slack config */}
                                {action.type === 'send_slack' && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-slack-webhook`}>Webhook URL Override</Label>
                                            <Input
                                                id={`action-${index}-slack-webhook`}
                                                value={(action.config.webhook_url as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'webhook_url', e.target.value)}
                                                placeholder="Leave empty to use agency default"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Optional — uses the webhook URL from Settings if not specified
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-slack-message`}>Custom Message</Label>
                                            <Textarea
                                                id={`action-${index}-slack-message`}
                                                value={(action.config.message_template as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'message_template', e.target.value)}
                                                placeholder="New {{direction}} call with {{agent_name}} — {{status}} ({{duration_minutes}} min). Summary: {{summary}}"
                                                rows={3}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Leave empty for a rich default notification. Variables: {'{{from_number}}, {{to_number}}, {{agent_name}}, {{summary}}, {{sentiment}}, {{duration_minutes}}, {{direction}}, {{status}}'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Calendly Check Availability config */}
                                {action.type === 'calendly_check_availability' && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-calendly-hours`}>Hours Ahead to Check</Label>
                                            <Input
                                                id={`action-${index}-calendly-hours`}
                                                type="number"
                                                min={1}
                                                max={720}
                                                value={(action.config.hours_ahead as string) || '48'}
                                                onChange={(e) => updateActionConfig(index, 'hours_ahead', e.target.value)}
                                                placeholder="48"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Number of hours from now to check for busy times (default: 48)
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Calendly Create Booking Link config */}
                                {action.type === 'calendly_create_booking_link' && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-calendly-event-type`}>Event Type URI</Label>
                                            <Input
                                                id={`action-${index}-calendly-event-type`}
                                                value={(action.config.event_type_uri as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'event_type_uri', e.target.value)}
                                                placeholder="Leave empty to use default from Settings"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Full Calendly event type URI. Leave empty to use the default event type configured in Settings.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-calendly-max-events`}>Max Uses</Label>
                                            <Input
                                                id={`action-${index}-calendly-max-events`}
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={(action.config.max_event_count as string) || '1'}
                                                onChange={(e) => updateActionConfig(index, 'max_event_count', e.target.value)}
                                                placeholder="1"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                How many times this scheduling link can be used (default: 1)
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Calendly Cancel Event config */}
                                {action.type === 'calendly_cancel_event' && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-calendly-event-uuid`}>Event UUID</Label>
                                            <Input
                                                id={`action-${index}-calendly-event-uuid`}
                                                value={(action.config.event_uuid as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'event_uuid', e.target.value)}
                                                placeholder="UUID from previous booking (or passed via metadata)"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                The scheduled event UUID. Can also be passed dynamically via call metadata.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`action-${index}-calendly-cancel-reason`}>Cancellation Reason</Label>
                                            <Input
                                                id={`action-${index}-calendly-cancel-reason`}
                                                value={(action.config.reason as string) || ''}
                                                onChange={(e) => updateActionConfig(index, 'reason', e.target.value)}
                                                placeholder="Cancelled via AI call workflow"
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                    <Button variant="outline" onClick={addAction}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Action
                    </Button>
                </CardContent>
            </Card>

            {/* Error */}
            {error && (
                <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Save */}
            <div className="flex justify-end gap-4">
                <Button variant="outline" asChild>
                    <Link href="/workflows">Cancel</Link>
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            {workflow ? 'Save Changes' : 'Create Workflow'}
                        </>
                    )}
                </Button>
            </div>
            </fieldset>
        </div>
    );
}
