'use client';

import { useState, useRef, useCallback } from 'react';
import { WorkflowTemplates } from '@/components/dashboard/WorkflowTemplates';
import { WorkflowEditor } from '@/components/dashboard/WorkflowEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { WorkflowTemplate } from '@/lib/workflows/templates';
import type { Workflow, WorkflowTrigger, WorkflowAction, WorkflowCondition } from '@/types';
import type { AIWorkflowResponse } from '@/lib/workflows/ai-builder';

interface NewWorkflowFlowProps {
    agents: { id: string; name: string }[];
    context?: {
        hasGHL: boolean;
        hasHubSpot: boolean;
        hasGCal: boolean;
        hasCalendly: boolean;
        hasSlack: boolean;
    };
}

const AI_EXAMPLES = [
    'Log all completed calls to HubSpot and send a Slack notification with the summary',
    'After positive calls, create a contact in GHL, score the lead, and book an appointment',
    'Send an SMS follow-up to callers after every completed inbound call',
    'Tag contacts with "hot-lead" when call sentiment is positive and duration is over 3 minutes',
];

export function NewWorkflowFlow({ agents, context }: NewWorkflowFlowProps) {
    const [mode, setMode] = useState<'choose' | 'ai' | 'editor'>('choose');
    const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
    const [aiGeneratedWorkflow, setAiGeneratedWorkflow] = useState<Partial<Workflow> | null>(null);

    // AI mode state
    const [aiInput, setAiInput] = useState('');
    const [aiMessage, setAiMessage] = useState('');
    const [aiStreaming, setAiStreaming] = useState(false);
    const [aiStreamText, setAiStreamText] = useState('');
    const [aiError, setAiError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleSelectTemplate = (template: WorkflowTemplate) => {
        setSelectedTemplate(template);
        setMode('editor');
    };

    const handleSkip = () => {
        setSelectedTemplate(null);
        setMode('editor');
    };

    const handleAiMode = () => {
        setMode('ai');
    };

    const handleBackToChoose = () => {
        abortControllerRef.current?.abort();
        setMode('choose');
        setAiInput('');
        setAiMessage('');
        setAiStreamText('');
        setAiError(null);
        setAiGeneratedWorkflow(null);
    };

    const handleGenerate = useCallback(async (prompt?: string) => {
        const text = prompt || aiInput;
        if (!text.trim() || aiStreaming) return;

        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setAiStreaming(true);
        setAiError(null);
        setAiStreamText('');
        setAiMessage('');
        setAiGeneratedWorkflow(null);

        try {
            const response = await fetch('/api/workflows/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text.trim(),
                    context: context || {
                        hasGHL: false,
                        hasHubSpot: false,
                        hasGCal: false,
                        hasCalendly: false,
                        hasSlack: false,
                    },
                    agents: agents.map(a => ({ id: a.id, name: a.name })),
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to generate workflow');
            }

            if (!response.body) {
                throw new Error('No response stream');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullStreamText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const chunk = JSON.parse(line);

                        if (chunk.type === 'text_delta') {
                            fullStreamText += chunk.text;
                            setAiStreamText(fullStreamText);
                        } else if (chunk.type === 'result') {
                            const result = chunk.data as AIWorkflowResponse;
                            setAiMessage(result.message);

                            if (result.workflow) {
                                setAiGeneratedWorkflow({
                                    name: result.workflow.name,
                                    description: result.workflow.description,
                                    trigger: result.workflow.trigger as WorkflowTrigger,
                                    conditions: result.workflow.conditions as WorkflowCondition[],
                                    actions: result.workflow.actions as WorkflowAction[],
                                    is_active: true,
                                });
                            }
                        } else if (chunk.type === 'error') {
                            throw new Error(chunk.error);
                        }
                    } catch (parseError) {
                        if (parseError instanceof SyntaxError) continue;
                        throw parseError;
                    }
                }
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
            setAiError(errorMsg);
        } finally {
            setAiStreaming(false);
        }
    }, [aiInput, aiStreaming, context, agents]);

    const handleUseWorkflow = () => {
        if (aiGeneratedWorkflow) {
            setMode('editor');
        }
    };

    // Choose mode: Template gallery + AI option + Start blank
    if (mode === 'choose') {
        return (
            <div className="space-y-6">
                {/* AI Option */}
                <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                                <Sparkles className="h-4 w-4 text-white" />
                            </div>
                            Describe with AI
                        </CardTitle>
                        <CardDescription>
                            Tell us what you want in plain English and AI will generate the workflow for you
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={handleAiMode}
                            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                        >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Describe with AI
                        </Button>
                    </CardContent>
                </Card>

                {/* Templates */}
                <WorkflowTemplates
                    onSelectTemplate={handleSelectTemplate}
                    onSkip={handleSkip}
                />
            </div>
        );
    }

    // AI mode: Prompt input + streaming response + preview
    if (mode === 'ai') {
        return (
            <div className="space-y-6">
                <Button variant="ghost" size="sm" onClick={handleBackToChoose}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to options
                </Button>

                <Card className="border-violet-200 dark:border-violet-800">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                                <Sparkles className="h-4 w-4 text-white" />
                            </div>
                            Describe Your Workflow
                        </CardTitle>
                        <CardDescription>
                            Tell us what should happen after a call, and AI will build the workflow for you
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            value={aiInput}
                            onChange={(e) => setAiInput(e.target.value)}
                            placeholder="e.g., After every completed call, log it to HubSpot, score the lead, and send a Slack notification with the summary"
                            className="min-h-[100px] resize-none"
                            disabled={aiStreaming}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault();
                                    handleGenerate();
                                }
                            }}
                        />

                        {/* Example prompts */}
                        {!aiStreaming && !aiGeneratedWorkflow && (
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium">Try an example:</p>
                                <div className="flex flex-wrap gap-2">
                                    {AI_EXAMPLES.map((example) => (
                                        <button
                                            key={example}
                                            onClick={() => {
                                                setAiInput(example);
                                                handleGenerate(example);
                                            }}
                                            className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-violet-500/50 hover:bg-violet-500/5 text-muted-foreground hover:text-foreground transition-all text-left"
                                        >
                                            {example}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => handleGenerate()}
                                disabled={!aiInput.trim() || aiStreaming}
                                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                            >
                                {aiStreaming ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Generate Workflow
                                    </>
                                )}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                {aiStreaming ? '' : '⌘+Enter to generate'}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Error */}
                {aiError && (
                    <Card className="border-red-200 dark:border-red-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <AlertCircle className="h-4 w-4" />
                                <p className="text-sm">{aiError}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Streaming / Result */}
                {(aiStreaming || aiMessage) && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">AI Response</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {aiMessage || (aiStreaming ? aiStreamText || 'Thinking...' : '')}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Generated workflow preview */}
                {aiGeneratedWorkflow && !aiStreaming && (
                    <Card className="border-green-200 dark:border-green-800">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Check className="h-4 w-4 text-green-600" />
                                Generated Workflow
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div>
                                    <span className="text-sm font-medium">Name: </span>
                                    <span className="text-sm">{aiGeneratedWorkflow.name}</span>
                                </div>
                                <div>
                                    <span className="text-sm font-medium">Description: </span>
                                    <span className="text-sm text-muted-foreground">{aiGeneratedWorkflow.description}</span>
                                </div>
                                <div>
                                    <span className="text-sm font-medium">Trigger: </span>
                                    <Badge variant="outline">{aiGeneratedWorkflow.trigger}</Badge>
                                </div>
                                {aiGeneratedWorkflow.conditions && aiGeneratedWorkflow.conditions.length > 0 && (
                                    <div>
                                        <span className="text-sm font-medium">Conditions: </span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {aiGeneratedWorkflow.conditions.map((c, i) => (
                                                <Badge key={i} variant="secondary" className="text-xs">
                                                    {c.field} {c.operator} {c.value}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <span className="text-sm font-medium">Actions ({aiGeneratedWorkflow.actions?.length || 0}): </span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {aiGeneratedWorkflow.actions?.map((a, i) => (
                                            <Badge key={i} variant="outline" className="text-xs">
                                                {a.type}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button onClick={handleUseWorkflow}>
                                    <Check className="h-4 w-4 mr-2" />
                                    Use This Workflow
                                </Button>
                                <Button variant="outline" onClick={() => handleGenerate()}>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Regenerate
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    // Editor mode: Pre-fill from template or AI-generated workflow
    const templateWorkflow: Partial<Workflow> | undefined = aiGeneratedWorkflow
        ? aiGeneratedWorkflow
        : selectedTemplate
          ? {
                name: selectedTemplate.name,
                description: selectedTemplate.description,
                trigger: selectedTemplate.trigger as WorkflowTrigger,
                conditions: selectedTemplate.conditions as WorkflowCondition[],
                actions: selectedTemplate.actions as WorkflowAction[],
                is_active: true,
            }
          : undefined;

    return (
        <WorkflowEditor
            workflow={templateWorkflow as Workflow | undefined}
            agents={agents}
        />
    );
}
