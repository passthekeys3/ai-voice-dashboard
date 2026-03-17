'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { Plus, Trash2, Save, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import type { Workflow, WorkflowAction, WorkflowCondition, WorkflowTrigger } from '@/types';
import { actionTypes } from './workflows/ActionTypeRegistry';
import { ActionConfigFields } from './workflows/ActionConfigFields';
import { ConditionBuilder } from './workflows/ConditionBuilder';
import { TriggerConfig } from './workflows/TriggerConfig';

interface WorkflowEditorProps {
    workflow?: Workflow;
    agents: { id: string; name: string }[];
    clientId?: string;
}

export function WorkflowEditor({ workflow, agents, clientId }: WorkflowEditorProps) {

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState(workflow?.name || '');
    const [description, setDescription] = useState(workflow?.description || '');
    const [trigger, setTrigger] = useState<WorkflowTrigger>(workflow?.trigger || 'call_ended');
    const [agentId, setAgentId] = useState<string>(workflow?.agent_id || 'all');
    const [isActive, setIsActive] = useState(workflow?.is_active ?? true);
    const [conditions, setConditions] = useState(
        () => (workflow?.conditions || []).map(c => ({ ...c, _key: crypto.randomUUID() }))
    );
    const [actions, setActions] = useState(
        () => (workflow?.actions || [{ type: 'webhook', config: { url: '' } } as WorkflowAction]).map(a => ({ ...a, _key: crypto.randomUUID() }))
    );

    const addCondition = () => {
        setConditions([...conditions, { field: 'duration_seconds', operator: '>' as const, value: 0, _key: crypto.randomUUID() }]);
    };

    const removeCondition = (index: number) => {
        setConditions(conditions.filter((_, i) => i !== index));
    };

    const updateCondition = (index: number, updates: Partial<WorkflowCondition>) => {
        setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
    };

    const addAction = () => {
        setActions([...actions, { type: 'webhook' as const, config: { url: '' }, _key: crypto.randomUUID() }]);
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

        // Validate required fields per action type
        for (const action of actions) {
            if (action.type === 'webhook' && !action.config.url) {
                setError('Webhook URL is required');
                return;
            }
            if (action.type === 'ghl_update_pipeline' && !action.config.pipeline_id) {
                setError('Pipeline ID is required for GHL pipeline updates');
                return;
            }
            if (action.type === 'hubspot_update_pipeline' && !action.config.pipeline_id) {
                setError('Pipeline ID is required for HubSpot pipeline updates');
                return;
            }
            if (action.type === 'ghl_book_appointment' && !action.config.calendar_id) {
                setError('Calendar ID is required for GHL appointment booking');
                return;
            }
            if (action.type === 'ghl_trigger_workflow' && !action.config.workflow_id) {
                setError('Workflow ID is required for GHL workflow triggers');
                return;
            }
            if (action.type === 'hubspot_trigger_workflow' && !action.config.workflow_id) {
                setError('Workflow ID is required for HubSpot workflow triggers');
                return;
            }
            if (action.type === 'ghl_update_contact_field' && (!action.config.field_key || !action.config.value_template)) {
                setError('Field key and value are required for GHL contact field updates');
                return;
            }
            if (action.type === 'hubspot_update_contact_field' && (!action.config.property_name || !action.config.value_template)) {
                setError('Property name and value are required for HubSpot contact field updates');
                return;
            }
            if (action.type === 'send_sms' && !action.config.message) {
                setError('Message is required for SMS actions');
                return;
            }
            if (action.type === 'send_email' && (!action.config.to || !action.config.subject)) {
                setError('Recipient and subject are required for email actions');
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
                conditions: conditions.map(({ _key: _, ...c }) => c),
                actions: actions.map(({ _key: _, ...a }) => a),
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

            window.location.href = clientId ? `/clients/${clientId}` : '/workflows';
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
                    <TriggerConfig
                        trigger={trigger}
                        setTrigger={setTrigger}
                        agentId={agentId}
                        setAgentId={setAgentId}
                        agents={agents}
                    />
                </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
                <CardHeader>
                    <CardTitle>Conditions (Optional)</CardTitle>
                    <CardDescription>Only run when these conditions are met</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ConditionBuilder
                        conditions={conditions}
                        addCondition={addCondition}
                        removeCondition={removeCondition}
                        updateCondition={updateCondition}
                    />
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
                        <Card key={action._key} className="bg-slate-50 dark:bg-slate-900">
                            <CardContent className="pt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <Select
                                        value={action.type}
                                        onValueChange={(v: string) => updateAction(index, {
                                            type: v as WorkflowAction['type'],
                                            config: v === 'webhook' ? { url: '' } : {}
                                        })}
                                    >
                                        <SelectTrigger className="min-w-[200px] w-auto">
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

                                <ActionConfigFields
                                    action={action}
                                    index={index}
                                    updateActionConfig={updateActionConfig}
                                />
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
