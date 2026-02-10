'use client';

import { useState, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface GeneratedCase {
    name: string;
    scenario: string;
    success_criteria: { criterion: string; type: 'must_pass' | 'should_pass' | 'must_not_fail' }[];
    tags: string[];
    suggested_persona: string;
    selected?: boolean;
}

interface TestCaseGeneratorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suiteId: string;
    onCasesAdded: () => void;
}

export function TestCaseGeneratorDialog({
    open,
    onOpenChange,
    suiteId,
    onCasesAdded,
}: TestCaseGeneratorDialogProps) {
    const [generating, setGenerating] = useState(false);
    const [cases, setCases] = useState<GeneratedCase[]>([]);
    const [streamText, setStreamText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleGenerate = useCallback(async () => {
        setGenerating(true);
        setError(null);
        setCases([]);
        setStreamText('');

        try {
            const res = await fetch(`/api/test-suites/${suiteId}/generate`, {
                method: 'POST',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Generation failed');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response stream');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        if (event.type === 'text_delta') {
                            setStreamText((prev) => prev + event.text);
                        } else if (event.type === 'result' && event.cases) {
                            setCases(
                                event.cases.map((c: GeneratedCase) => ({ ...c, selected: true }))
                            );
                        } else if (event.type === 'error') {
                            setError(event.message);
                        }
                    } catch {
                        // Skip unparseable lines
                    }
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Generation failed');
        } finally {
            setGenerating(false);
        }
    }, [suiteId]);

    const handleToggle = (index: number) => {
        setCases((prev) =>
            prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
        );
    };

    const handleSelectAll = () => {
        const allSelected = cases.every((c) => c.selected);
        setCases((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
    };

    const handleAddSelected = async () => {
        const selected = cases.filter((c) => c.selected);
        if (selected.length === 0) return;

        setSaving(true);
        try {
            const casesToSave = selected.map((c) => ({
                name: c.name,
                scenario: c.scenario,
                success_criteria: c.success_criteria,
                tags: c.tags,
            }));

            const res = await fetch(`/api/test-suites/${suiteId}/cases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(casesToSave),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save test cases');
            }

            onCasesAdded();
            onOpenChange(false);
            setCases([]);
            setStreamText('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const selectedCount = cases.filter((c) => c.selected).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        AI Test Case Generator
                    </DialogTitle>
                    <DialogDescription>
                        Analyze the agent&apos;s prompt and generate diverse test scenarios covering happy paths,
                        edge cases, and adversarial conditions.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto min-h-0">
                    {/* Initial state */}
                    {!generating && cases.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Sparkles className="h-10 w-10 text-muted-foreground/50 mb-4" />
                            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                                Click generate to analyze the agent&apos;s prompt and create 6-10 test scenarios
                                with success criteria.
                            </p>
                            <Button onClick={handleGenerate}>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Generate Test Cases
                            </Button>
                        </div>
                    )}

                    {/* Generating animation */}
                    {generating && cases.length === 0 && (
                        <div className="py-8 space-y-4">
                            <div className="flex items-center gap-3 mb-4">
                                <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                                <p className="text-sm font-medium">Analyzing prompt and generating scenarios...</p>
                            </div>
                            {streamText && (
                                <pre className="text-xs text-muted-foreground bg-muted/50 p-4 rounded-lg overflow-auto max-h-[300px] whitespace-pre-wrap">
                                    {streamText}
                                </pre>
                            )}
                        </div>
                    )}

                    {/* Error state */}
                    {error && (
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium">Generation failed</p>
                                <p className="text-sm mt-1">{error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3"
                                    onClick={handleGenerate}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Generated cases */}
                    {cases.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    {cases.length} test cases generated • {selectedCount} selected
                                </p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSelectAll}
                                >
                                    {cases.every((c) => c.selected) ? 'Deselect All' : 'Select All'}
                                </Button>
                            </div>

                            {cases.map((tc, index) => (
                                <div
                                    key={index}
                                    className={`p-4 rounded-lg border transition-colors ${
                                        tc.selected
                                            ? 'border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20'
                                            : 'border-muted bg-muted/20 opacity-60'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            checked={tc.selected}
                                            onCheckedChange={() => handleToggle(index)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-sm font-medium">{tc.name}</h4>
                                                {tc.tags?.map((tag) => (
                                                    <Badge key={tag} variant="outline" className="text-xs">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                                {tc.suggested_persona && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        {tc.suggested_persona}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {tc.scenario}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {tc.success_criteria?.map((c, ci) => (
                                                    <Badge
                                                        key={ci}
                                                        variant={
                                                            c.type === 'must_pass'
                                                                ? 'default'
                                                                : c.type === 'must_not_fail'
                                                                  ? 'destructive'
                                                                  : 'secondary'
                                                        }
                                                        className="text-xs"
                                                    >
                                                        {c.criterion}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {cases.length > 0 && (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleGenerate}
                                disabled={generating}
                            >
                                Regenerate
                            </Button>
                            <Button
                                onClick={handleAddSelected}
                                disabled={saving || selectedCount === 0}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    `Add ${selectedCount} Test Case${selectedCount !== 1 ? 's' : ''}`
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
