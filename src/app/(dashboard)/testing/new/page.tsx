'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, TestTube2, Bot } from 'lucide-react';
import { toast } from 'sonner';

interface Agent {
    id: string;
    name: string;
    provider: string;
}

export default function NewTestSuitePage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [agentId, setAgentId] = useState('');
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(false);
    const [agentsLoading, setAgentsLoading] = useState(true);

    useEffect(() => {
        async function fetchAgents() {
            try {
                const res = await fetch('/api/agents');
                const data = await res.json();
                if (data.data) setAgents(data.data);
            } catch (err) {
                console.error('Failed to load agents:', err);
            } finally {
                setAgentsLoading(false);
            }
        }
        fetchAgents();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error('Name is required');
            return;
        }
        if (!agentId) {
            toast.error('Please select an agent');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/test-suites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                    agent_id: agentId,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to create test suite');
            }

            const data = await res.json();
            toast.success('Test suite created');
            router.push(`/testing/${data.data.id}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create test suite');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="border-b px-6 py-4">
                <h1 className="text-lg font-semibold flex items-center gap-2">
                    <TestTube2 className="h-5 w-5" />
                    New Test Suite
                </h1>
            </div>

            <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-2xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TestTube2 className="h-5 w-5" />
                                Create Test Suite
                            </CardTitle>
                            <CardDescription>
                                A test suite contains a set of test scenarios that validate your agent&apos;s behavior.
                                The agent&apos;s current prompt will be automatically captured.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="agent">Agent</Label>
                                    <Select
                                        value={agentId}
                                        onValueChange={setAgentId}
                                        disabled={agentsLoading}
                                    >
                                        <SelectTrigger id="agent">
                                            <SelectValue placeholder={agentsLoading ? 'Loading agents...' : 'Select an agent to test'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {agents.map((agent) => (
                                                <SelectItem key={agent.id} value={agent.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Bot className="h-4 w-4" />
                                                        {agent.name}
                                                        <span className="text-xs text-muted-foreground">
                                                            ({agent.provider})
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="name">Suite Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., Customer Support Validation"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description (optional)</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="What this test suite validates..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                    />
                                </div>

                                <div className="flex gap-3 pt-4 border-t">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => router.back()}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={loading || !name.trim() || !agentId}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            'Create Suite'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
