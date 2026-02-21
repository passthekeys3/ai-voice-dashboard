'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2, FileText, Link, Type, Database } from 'lucide-react';

interface KBSource {
    source_id: string;
    source_type: 'file' | 'url' | 'text';
    source_name?: string;
    source_url?: string;
    content?: string;
    status?: string;
}

interface KnowledgeBase {
    knowledge_base_id: string;
    knowledge_base_name: string;
    status: string;
    knowledge_base_sources?: KBSource[];
}

interface KnowledgeBaseEditorProps {
    agentId: string;
}

export function KnowledgeBaseEditor({ agentId }: KnowledgeBaseEditorProps) {
    const [kb, setKb] = useState<KnowledgeBase | null>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [addingSource, setAddingSource] = useState(false);
    const [deletingSource, setDeletingSource] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state for adding sources
    const [textTitle, setTextTitle] = useState('');
    const [textContent, setTextContent] = useState('');
    const [url, setUrl] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(false);

    const fetchKB = useCallback(async () => {
        try {
            const response = await fetch(`/api/agents/${agentId}/knowledge-base`);
            if (!response.ok) {
                throw new Error('Failed to fetch knowledge base');
            }
            const data = await response.json();
            setKb(data.data);
        } catch (error) {
            console.error('Error fetching KB:', error);
            setKb(null);
        } finally {
            setLoading(false);
        }
    }, [agentId]);

    useEffect(() => {
        fetchKB();
    }, [fetchKB]);

    const createKB = async () => {
        setCreating(true);
        setError(null);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(`/api/agents/${agentId}/knowledge-base`, {
                method: 'POST',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const data = await response.json();
            if (response.ok) {
                setKb(data.data);
            } else {
                setError(data.error || 'Failed to create knowledge base');
            }
        } catch (err) {
            console.error('Error creating KB:', err);
            if (err instanceof DOMException && err.name === 'AbortError') {
                setError('Request timed out. The server may be busy — please try again.');
            } else {
                setError(err instanceof Error ? err.message : 'Failed to create knowledge base');
            }
        } finally {
            setCreating(false);
        }
    };

    const addTextSource = async () => {
        if (!textTitle.trim() || !textContent.trim()) return;

        setAddingSource(true);
        setError(null);
        try {
            const response = await fetch(`/api/agents/${agentId}/knowledge-base/sources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'text',
                    title: textTitle,
                    content: textContent,
                }),
            });
            if (response.ok) {
                setTextTitle('');
                setTextContent('');
                fetchKB();
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to add text source');
            }
        } catch (err) {
            console.error('Error adding text source:', err);
            setError(err instanceof Error ? err.message : 'Failed to add text source');
        } finally {
            setAddingSource(false);
        }
    };

    const addUrlSource = async () => {
        if (!url.trim()) return;

        setAddingSource(true);
        setError(null);
        try {
            const response = await fetch(`/api/agents/${agentId}/knowledge-base/sources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'url',
                    url,
                    enableAutoRefresh: autoRefresh,
                }),
            });
            if (response.ok) {
                setUrl('');
                setAutoRefresh(false);
                fetchKB();
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to add URL source');
            }
        } catch (err) {
            console.error('Error adding URL source:', err);
            setError(err instanceof Error ? err.message : 'Failed to add URL source');
        } finally {
            setAddingSource(false);
        }
    };

    const deleteSource = async (sourceId: string) => {
        setDeletingSource(sourceId);
        try {
            const response = await fetch(`/api/agents/${agentId}/knowledge-base/sources/${sourceId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                fetchKB();
            }
        } catch (error) {
            console.error('Error deleting source:', error);
        } finally {
            setDeletingSource(null);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (!kb) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Knowledge Base
                    </CardTitle>
                    <CardDescription>
                        Add documents, URLs, or text to enhance your agent&apos;s responses
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Button onClick={createKB} disabled={creating}>
                        {creating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Knowledge Base
                            </>
                        )}
                    </Button>
                    {error && (
                        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                            {error}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Knowledge Base
                </CardTitle>
                <CardDescription>
                    Status: <span className="capitalize">{kb.status}</span> ·
                    {kb.knowledge_base_sources?.length || 0} sources
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && (
                    <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                        {error}
                    </div>
                )}
                <Tabs defaultValue="sources" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="sources">Sources</TabsTrigger>
                        <TabsTrigger value="add-text">Add Text</TabsTrigger>
                        <TabsTrigger value="add-url">Add URL</TabsTrigger>
                    </TabsList>

                    <TabsContent value="sources" className="space-y-4">
                        {kb.knowledge_base_sources && kb.knowledge_base_sources.length > 0 ? (
                            <div className="space-y-2">
                                {kb.knowledge_base_sources.map((source) => (
                                    <div
                                        key={source.source_id}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-900"
                                    >
                                        <div className="flex items-center gap-3">
                                            {source.source_type === 'text' && <Type className="h-4 w-4 text-blue-500" />}
                                            {source.source_type === 'url' && <Link className="h-4 w-4 text-green-500" />}
                                            {source.source_type === 'file' && <FileText className="h-4 w-4 text-purple-500" />}
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {source.source_name || source.source_url || 'Untitled'}
                                                </p>
                                                <p className="text-xs text-muted-foreground capitalize">
                                                    {source.source_type} · {source.status}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => deleteSource(source.source_id)}
                                            disabled={deletingSource === source.source_id}
                                        >
                                            {deletingSource === source.source_id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No sources added yet. Add text or URLs to train your agent.
                            </p>
                        )}
                    </TabsContent>

                    <TabsContent value="add-text" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="text-title">Title</Label>
                            <Input
                                id="text-title"
                                value={textTitle}
                                onChange={(e) => setTextTitle(e.target.value)}
                                placeholder="e.g., Company FAQ, Product Info"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="text-content">Content</Label>
                            <Textarea
                                id="text-content"
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                placeholder="Enter the knowledge content here..."
                                rows={6}
                            />
                        </div>
                        <Button onClick={addTextSource} disabled={addingSource || !textTitle || !textContent}>
                            {addingSource ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Text
                                </>
                            )}
                        </Button>
                    </TabsContent>

                    <TabsContent value="add-url" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="url">URL</Label>
                            <Input
                                id="url"
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com/page"
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="auto-refresh"
                                checked={autoRefresh}
                                onCheckedChange={setAutoRefresh}
                            />
                            <Label htmlFor="auto-refresh">Auto-refresh every 12-24 hours</Label>
                        </div>
                        <Button onClick={addUrlSource} disabled={addingSource || !url}>
                            {addingSource ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add URL
                                </>
                            )}
                        </Button>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
