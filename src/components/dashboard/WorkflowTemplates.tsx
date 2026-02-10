'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { workflowTemplates, type WorkflowTemplate } from '@/lib/workflows/templates';
import { ArrowRight, Plus } from 'lucide-react';

interface WorkflowTemplatesProps {
    onSelectTemplate: (template: WorkflowTemplate) => void;
    onSkip: () => void;
}

const categoryLabels: Record<string, string> = {
    all: 'All',
    crm: 'CRM',
    alerts: 'Alerts',
    scheduling: 'Scheduling',
    inbound: 'Inbound',
};

const categoryBadgeVariant: Record<string, 'default' | 'secondary' | 'info' | 'warning' | 'success'> = {
    crm: 'info',
    alerts: 'warning',
    scheduling: 'success',
    inbound: 'secondary',
};

export function WorkflowTemplates({ onSelectTemplate, onSkip }: WorkflowTemplatesProps) {
    const [activeCategory, setActiveCategory] = useState('all');

    const filteredTemplates = activeCategory === 'all'
        ? workflowTemplates
        : workflowTemplates.filter((t) => t.category === activeCategory);

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h3 className="text-lg font-semibold">Choose a Template</h3>
                <p className="text-sm text-muted-foreground">
                    Start with a pre-built workflow template or create one from scratch.
                </p>
            </div>

            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                <TabsList>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                        <TabsTrigger key={value} value={value}>
                            {label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value={activeCategory} className="mt-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredTemplates.map((template) => (
                            <Card
                                key={template.id}
                                variant="interactive"
                                className="group"
                                onClick={() => onSelectTemplate(template)}
                            >
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <span className="text-2xl" role="img" aria-label={template.name}>
                                            {template.icon}
                                        </span>
                                        <Badge variant={categoryBadgeVariant[template.category] || 'secondary'}>
                                            {categoryLabels[template.category]}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-base">{template.name}</CardTitle>
                                    <CardDescription className="line-clamp-2">
                                        {template.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>
                                                {template.actions.length} action{template.actions.length !== 1 ? 's' : ''}
                                            </span>
                                            {template.conditions.length > 0 && (
                                                <>
                                                    <span>&middot;</span>
                                                    <span>
                                                        {template.conditions.length} condition{template.conditions.length !== 1 ? 's' : ''}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectTemplate(template);
                                            }}
                                        >
                                            Use
                                            <ArrowRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={onSkip}>
                    <Plus className="h-4 w-4 mr-2" />
                    Start from Scratch
                </Button>
            </div>
        </div>
    );
}
