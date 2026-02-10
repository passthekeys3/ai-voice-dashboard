'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    TestTube2,
    Plus,
    Sparkles,
    Play,
    Trash2,
    ChevronDown,
    ChevronRight,
    Loader2,
    Save,
    Bot,
    AlertTriangle,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { PersonaSelector } from './PersonaSelector';
import { CriteriaEditor } from './CriteriaEditor';
import { TestCaseGeneratorDialog } from './TestCaseGeneratorDialog';
import type { TestSuite, TestCase, TestRun, TestPersona, SuccessCriterion } from '@/types';

interface TestSuiteEditorProps {
    suite: TestSuite & {
        agent?: { id: string; name: string; provider: string; config?: Record<string, unknown> };
        test_cases?: TestCase[];
        test_runs?: TestRun[];
    };
    personas: TestPersona[];
}

interface EditableCase {
    id?: string;
    name: string;
    description: string;
    scenario: string;
    persona_id: string | null;
    success_criteria: SuccessCriterion[];
    max_turns: number;
    tags: string[];
    is_active: boolean;
    isNew?: boolean;
    isDirty?: boolean;
}

export function TestSuiteEditor({ suite, personas }: TestSuiteEditorProps) {
    const router = useRouter();
    const [suiteName, setSuiteName] = useState(suite.name);
    const [suiteDescription, setSuiteDescription] = useState(suite.description || '');
    const [suiteNameDirty, setSuiteNameDirty] = useState(false);
    const [cases, setCases] = useState<EditableCase[]>(
        (suite.test_cases || []).map((tc) => ({
            id: tc.id,
            name: tc.name,
            description: tc.description || '',
            scenario: tc.scenario,
            persona_id: tc.persona_id || null,
            success_criteria: tc.success_criteria,
            max_turns: tc.max_turns,
            tags: tc.tags,
            is_active: tc.is_active,
        }))
    );
    const [openCases, setOpenCases] = useState<Set<number>>(new Set());
    const [savingCase, setSavingCase] = useState<number | null>(null);
    const [savingSuite, setSavingSuite] = useState(false);
    const [generatorOpen, setGeneratorOpen] = useState(false);
    const [startingRun, setStartingRun] = useState(false);

    const toggleCase = (index: number) => {
        setOpenCases((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const updateCase = (index: number, updates: Partial<EditableCase>) => {
        setCases((prev) =>
            prev.map((c, i) => (i === index ? { ...c, ...updates, isDirty: true } : c))
        );
    };

    const handleAddCase = () => {
        const newCase: EditableCase = {
            name: '',
            description: '',
            scenario: '',
            persona_id: null,
            success_criteria: [],
            max_turns: 20,
            tags: [],
            is_active: true,
            isNew: true,
            isDirty: true,
        };
        setCases((prev) => [...prev, newCase]);
        setOpenCases((prev) => new Set(prev).add(cases.length));
    };

    const handleSaveCase = async (index: number) => {
        const tc = cases[index];
        if (!tc.name.trim()) {
            toast.error('Test case name is required');
            return;
        }
        if (!tc.scenario.trim()) {
            toast.error('Test case scenario is required');
            return;
        }

        setSavingCase(index);
        try {
            if (tc.isNew) {
                // Create
                const res = await fetch(`/api/test-suites/${suite.id}/cases`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: tc.name.trim(),
                        description: tc.description.trim() || null,
                        scenario: tc.scenario.trim(),
                        persona_id: tc.persona_id,
                        success_criteria: tc.success_criteria,
                        max_turns: tc.max_turns,
                        tags: tc.tags,
                        is_active: tc.is_active,
                    }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to create test case');
                }

                const data = await res.json();
                const created = data.data[0];
                setCases((prev) =>
                    prev.map((c, i) =>
                        i === index ? { ...c, id: created.id, isNew: false, isDirty: false } : c
                    )
                );
            } else {
                // Update
                const res = await fetch(`/api/test-suites/${suite.id}/cases/${tc.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: tc.name.trim(),
                        description: tc.description.trim() || null,
                        scenario: tc.scenario.trim(),
                        persona_id: tc.persona_id,
                        success_criteria: tc.success_criteria,
                        max_turns: tc.max_turns,
                        tags: tc.tags,
                        is_active: tc.is_active,
                    }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to update test case');
                }

                setCases((prev) =>
                    prev.map((c, i) => (i === index ? { ...c, isDirty: false } : c))
                );
            }

            toast.success('Test case saved');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSavingCase(null);
        }
    };

    const handleDeleteCase = async (index: number) => {
        const tc = cases[index];

        if (tc.isNew) {
            setCases((prev) => prev.filter((_, i) => i !== index));
            return;
        }

        if (!confirm('Delete this test case?')) return;

        try {
            await fetch(`/api/test-suites/${suite.id}/cases/${tc.id}`, {
                method: 'DELETE',
            });
            setCases((prev) => prev.filter((_, i) => i !== index));
            toast.success('Test case deleted');
        } catch {
            toast.error('Failed to delete test case');
        }
    };

    const handleSaveSuite = async () => {
        setSavingSuite(true);
        try {
            const res = await fetch(`/api/test-suites/${suite.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: suiteName.trim(),
                    description: suiteDescription.trim() || null,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update suite');
            }

            setSuiteNameDirty(false);
            toast.success('Suite updated');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update');
        } finally {
            setSavingSuite(false);
        }
    };

    const handleRunTests = async () => {
        const activeCases = cases.filter((c) => c.is_active && !c.isNew);
        if (activeCases.length === 0) {
            toast.error('No saved active test cases to run');
            return;
        }

        setStartingRun(true);
        try {
            // Create the run
            const createRes = await fetch(`/api/test-suites/${suite.id}/runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt_source: 'current' }),
            });

            if (!createRes.ok) {
                const data = await createRes.json();
                throw new Error(data.error || 'Failed to create test run');
            }

            const { data: run } = await createRes.json();

            // Navigate to run page which will handle execution
            router.push(`/testing/${suite.id}/runs/${run.id}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to start test run');
            setStartingRun(false);
        }
    };

    const handleCasesAdded = useCallback(async () => {
        // Re-fetch cases from API instead of doing a full page reload
        try {
            const res = await fetch(`/api/test-suites/${suite.id}/cases`);
            if (res.ok) {
                const data = await res.json();
                if (data.data) {
                    setCases(
                        data.data.map((tc: TestCase) => ({
                            id: tc.id,
                            name: tc.name,
                            description: tc.description || '',
                            scenario: tc.scenario,
                            persona_id: tc.persona_id || null,
                            success_criteria: tc.success_criteria,
                            max_turns: tc.max_turns,
                            tags: tc.tags,
                            is_active: tc.is_active,
                        }))
                    );
                }
            }
        } catch {
            // Fallback to router refresh
            router.refresh();
        }
    }, [suite.id, router]);

    const hasUnsavedCases = cases.some((c) => c.isDirty);
    const activeCount = cases.filter((c) => c.is_active && !c.isNew).length;

    // Warn user about unsaved changes before navigating away
    useEffect(() => {
        if (!hasUnsavedCases && !suiteNameDirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasUnsavedCases, suiteNameDirty]);

    return (
        <>
            <div className="space-y-6">
                {/* Suite Info */}
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2">
                                    <TestTube2 className="h-5 w-5" />
                                    {suite.name}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-2">
                                    <Bot className="h-3.5 w-3.5" />
                                    {suite.agent?.name || 'Unknown Agent'}
                                    {suite.agent?.provider && (
                                        <Badge variant="outline" className="text-xs">
                                            {suite.agent.provider}
                                        </Badge>
                                    )}
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setGeneratorOpen(true)}
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Generate Cases
                                </Button>
                                <Button
                                    onClick={handleRunTests}
                                    disabled={startingRun || activeCount === 0}
                                >
                                    {startingRun ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Starting...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="h-4 w-4 mr-2" />
                                            Run All Tests ({activeCount})
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="suite-name">Suite Name</Label>
                                <Input
                                    id="suite-name"
                                    value={suiteName}
                                    onChange={(e) => {
                                        setSuiteName(e.target.value);
                                        setSuiteNameDirty(true);
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="suite-description">Description</Label>
                                <Input
                                    id="suite-description"
                                    value={suiteDescription}
                                    onChange={(e) => {
                                        setSuiteDescription(e.target.value);
                                        setSuiteNameDirty(true);
                                    }}
                                    placeholder="Optional description..."
                                />
                            </div>
                        </div>
                        {suiteNameDirty && (
                            <Button size="sm" onClick={handleSaveSuite} disabled={savingSuite}>
                                {savingSuite ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                Save Suite Info
                            </Button>
                        )}

                        {/* Prompt snapshot warning */}
                        {suite.agent_prompt_snapshot && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-800 dark:text-amber-200">
                                    Prompt snapshot captured when suite was created. Tests always run against the agent&apos;s
                                    current live prompt, which may have changed since then.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Run History Link */}
                {suite.test_runs && suite.test_runs.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Recent Runs</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {suite.test_runs.slice(0, 5).map((run) => (
                                    <div
                                        key={run.id}
                                        className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => router.push(`/testing/${suite.id}/runs/${run.id}`)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Badge
                                                variant={
                                                    run.status === 'completed'
                                                        ? run.failed_cases === 0
                                                            ? 'default'
                                                            : 'destructive'
                                                        : 'secondary'
                                                }
                                                className={
                                                    run.status === 'completed' && run.failed_cases === 0
                                                        ? 'bg-green-600'
                                                        : ''
                                                }
                                            >
                                                {run.status === 'completed'
                                                    ? `${run.passed_cases}/${run.total_cases} passed`
                                                    : run.status}
                                            </Badge>
                                            {run.avg_score != null && (
                                                <span className="text-sm text-muted-foreground">
                                                    Score: {run.avg_score}%
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(run.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Test Cases */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base">
                                    Test Cases ({cases.length})
                                </CardTitle>
                                <CardDescription>
                                    {activeCount} active • {cases.length - activeCount} inactive
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleAddCase}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Case
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {cases.length === 0 && (
                            <div className="text-center py-8">
                                <p className="text-sm text-muted-foreground mb-4">
                                    No test cases yet. Add them manually or use AI generation.
                                </p>
                                <div className="flex gap-2 justify-center">
                                    <Button variant="outline" size="sm" onClick={handleAddCase}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Manually
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setGeneratorOpen(true)}
                                    >
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Generate with AI
                                    </Button>
                                </div>
                            </div>
                        )}

                        {cases.map((tc, index) => (
                            <Collapsible
                                key={tc.id || `new-${index}`}
                                open={openCases.has(index)}
                                onOpenChange={() => toggleCase(index)}
                            >
                                <div className={`border rounded-lg ${!tc.is_active ? 'opacity-50' : ''} ${tc.isDirty ? 'border-amber-300 dark:border-amber-700' : ''}`}>
                                    <CollapsibleTrigger asChild>
                                        <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                            {openCases.has(index) ? (
                                                <ChevronDown className="h-4 w-4 shrink-0" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium truncate">
                                                        {tc.name || 'Untitled Test Case'}
                                                    </span>
                                                    {tc.isNew && (
                                                        <Badge variant="outline" className="text-xs">New</Badge>
                                                    )}
                                                    {tc.isDirty && !tc.isNew && (
                                                        <Badge variant="outline" className="text-xs text-amber-600">Unsaved</Badge>
                                                    )}
                                                    {!tc.is_active && (
                                                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => handleDeleteCase(index)}
                                                    aria-label={`Delete test case ${tc.name || 'untitled'}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CollapsibleTrigger>

                                    <CollapsibleContent>
                                        <Separator />
                                        <div className="p-4 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`case-name-${index}`}>Name</Label>
                                                    <Input
                                                        id={`case-name-${index}`}
                                                        value={tc.name}
                                                        onChange={(e) => updateCase(index, { name: e.target.value })}
                                                        placeholder="Test case name"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`case-persona-${index}`}>Caller Persona</Label>
                                                    <PersonaSelector
                                                        value={tc.persona_id}
                                                        onChange={(v) => updateCase(index, { persona_id: v })}
                                                        personas={personas}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor={`case-scenario-${index}`}>Scenario</Label>
                                                <Textarea
                                                    id={`case-scenario-${index}`}
                                                    value={tc.scenario}
                                                    onChange={(e) => updateCase(index, { scenario: e.target.value })}
                                                    placeholder="Describe the situation the caller is in and what they want to accomplish..."
                                                    rows={4}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Success Criteria</Label>
                                                <CriteriaEditor
                                                    criteria={tc.success_criteria}
                                                    onChange={(c) => updateCase(index, { success_criteria: c })}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Max Turns: {tc.max_turns}</Label>
                                                <Slider
                                                    value={[tc.max_turns]}
                                                    onValueChange={([v]) => updateCase(index, { max_turns: v })}
                                                    min={4}
                                                    max={40}
                                                    step={2}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Maximum conversation turns before ending the simulation
                                                </p>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleSaveCase(index)}
                                                    disabled={savingCase === index}
                                                >
                                                    {savingCase === index ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            Saving...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="h-4 w-4 mr-2" />
                                                            Save Case
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </div>
                            </Collapsible>
                        ))}

                        {hasUnsavedCases && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                Some test cases have unsaved changes. Click &quot;Save Case&quot; on each to persist them.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <TestCaseGeneratorDialog
                open={generatorOpen}
                onOpenChange={setGeneratorOpen}
                suiteId={suite.id}
                onCasesAdded={handleCasesAdded}
            />
        </>
    );
}
