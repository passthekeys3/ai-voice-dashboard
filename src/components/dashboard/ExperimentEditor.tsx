'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Save, Loader2, FlaskConical } from 'lucide-react';
import type { Experiment, ExperimentGoal } from '@/types';

interface ExperimentEditorProps {
    experiment?: Experiment;
    agents: { id: string; name: string }[];
}

interface VariantDraft {
    id?: string;
    name: string;
    prompt: string;
    traffic_weight: number;
    is_control: boolean;
}

export function ExperimentEditor({ experiment, agents }: ExperimentEditorProps) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState(experiment?.name || '');
    const [description, setDescription] = useState(experiment?.description || '');
    const [agentId, setAgentId] = useState(experiment?.agent_id || '');
    const [goal, setGoal] = useState<ExperimentGoal>(experiment?.goal || 'conversion');
    const [variants, setVariants] = useState<VariantDraft[]>(
        experiment?.variants?.map(v => ({
            id: v.id,
            name: v.name,
            prompt: v.prompt,
            traffic_weight: v.traffic_weight,
            is_control: v.is_control,
        })) || [
            { name: 'Control', prompt: '', traffic_weight: 50, is_control: true },
            { name: 'Variant A', prompt: '', traffic_weight: 50, is_control: false },
        ]
    );

    const totalWeight = variants.reduce((sum, v) => sum + v.traffic_weight, 0);

    const addVariant = () => {
        const newVariant: VariantDraft = {
            name: `Variant ${String.fromCharCode(65 + variants.length - 1)}`,
            prompt: '',
            traffic_weight: 0,
            is_control: false,
        };
        setVariants([...variants, newVariant]);
    };

    const removeVariant = (index: number) => {
        if (variants.length <= 2) return;
        setVariants(variants.filter((_, i) => i !== index));
    };

    const updateVariant = (index: number, updates: Partial<VariantDraft>) => {
        setVariants(variants.map((v, i) => i === index ? { ...v, ...updates } : v));
    };

    const normalizeWeights = () => {
        const equalWeight = Math.floor(100 / variants.length);
        const remainder = 100 - (equalWeight * variants.length);
        setVariants(variants.map((v, i) => ({
            ...v,
            traffic_weight: equalWeight + (i === 0 ? remainder : 0),
        })));
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Name is required');
            return;
        }
        if (!agentId) {
            setError('Please select an agent');
            return;
        }
        if (variants.length < 2) {
            setError('At least 2 variants are required');
            return;
        }
        if (variants.some(v => !v.prompt.trim())) {
            setError('All variants must have a prompt');
            return;
        }
        if (totalWeight !== 100) {
            setError(`Traffic weights must sum to 100% (currently ${totalWeight}%)`);
            return;
        }

        setSaving(true);
        setError(null);

        try {
            if (experiment) {
                // Update existing
                const expRes = await fetch(`/api/experiments/${experiment.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description, goal }),
                });
                if (!expRes.ok) {
                    const errData = await expRes.json().catch(() => ({}));
                    throw new Error(errData.error || 'Failed to update experiment');
                }
                // Update variants
                const varRes = await fetch(`/api/experiments/${experiment.id}/variants`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ variants }),
                });
                if (!varRes.ok) {
                    const errData = await varRes.json().catch(() => ({}));
                    throw new Error(errData.error || 'Failed to update variants');
                }
            } else {
                // Create new
                const createRes = await fetch('/api/experiments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        description,
                        agent_id: agentId,
                        goal,
                        variants,
                    }),
                });
                if (!createRes.ok) {
                    const errData = await createRes.json().catch(() => ({}));
                    throw new Error(errData.error || 'Failed to create experiment');
                }
            }

            router.push('/experiments');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Basic Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Experiment Setup</CardTitle>
                    <CardDescription>Define your experiment and what you want to optimize</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Experiment Name *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Friendly vs Professional Tone"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Agent *</Label>
                            <Select
                                value={agentId}
                                onValueChange={setAgentId}
                                disabled={!!experiment}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an agent" />
                                </SelectTrigger>
                                <SelectContent>
                                    {agents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What are you testing?"
                            rows={2}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Optimization Goal</Label>
                        <Select value={goal} onValueChange={(v: string) => setGoal(v as ExperimentGoal)}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="conversion">Conversion Rate</SelectItem>
                                <SelectItem value="duration">Call Duration</SelectItem>
                                <SelectItem value="sentiment">Sentiment Score</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                            We&apos;ll highlight the winning variant based on this metric
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Variants */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Prompt Variants</CardTitle>
                        <CardDescription>
                            Create different versions of your agent prompt to test
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={normalizeWeights}>
                            Split Evenly
                        </Button>
                        <Button variant="outline" size="sm" onClick={addVariant}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Variant
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {variants.map((variant, index) => (
                        <Card key={index} className={variant.is_control ? 'border-primary' : ''}>
                            <CardHeader className="py-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FlaskConical className="h-4 w-4" />
                                        <Input
                                            value={variant.name}
                                            onChange={(e) => updateVariant(index, { name: e.target.value })}
                                            className="w-40 h-8"
                                        />
                                        {variant.is_control && (
                                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                                Control
                                            </span>
                                        )}
                                    </div>
                                    {variants.length > 2 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeVariant(index)}
                                            aria-label={`Remove variant ${variant.name}`}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Prompt *</Label>
                                    <Textarea
                                        value={variant.prompt}
                                        onChange={(e) => updateVariant(index, { prompt: e.target.value })}
                                        placeholder="Enter the full agent prompt for this variant..."
                                        rows={6}
                                        className="font-mono text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Traffic Weight</Label>
                                        <span className="text-sm font-medium">{variant.traffic_weight}%</span>
                                    </div>
                                    <Slider
                                        value={[variant.traffic_weight]}
                                        onValueChange={([value]: number[]) => updateVariant(index, { traffic_weight: value })}
                                        max={100}
                                        step={5}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Weight Summary */}
                    <div className={`p-3 rounded-lg ${totalWeight === 100 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                        <p className={`text-sm font-medium ${totalWeight === 100 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                            Total Traffic: {totalWeight}% {totalWeight !== 100 && '(must equal 100%)'}
                        </p>
                    </div>
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
                    <Link href="/experiments">Cancel</Link>
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
                            {experiment ? 'Save Changes' : 'Create Experiment'}
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
