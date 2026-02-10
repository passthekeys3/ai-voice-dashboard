'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import type { SuccessCriterion, CriterionType } from '@/types';

interface CriteriaEditorProps {
    criteria: SuccessCriterion[];
    onChange: (criteria: SuccessCriterion[]) => void;
    disabled?: boolean;
}

const CRITERION_TYPE_CONFIG: Record<CriterionType, { label: string; color: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    must_pass: {
        label: 'Must Pass',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
        badgeVariant: 'default',
    },
    should_pass: {
        label: 'Should Pass',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        badgeVariant: 'secondary',
    },
    must_not_fail: {
        label: 'Must Not Fail',
        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        badgeVariant: 'destructive',
    },
};

export function CriteriaEditor({ criteria, onChange, disabled }: CriteriaEditorProps) {
    const [newCriterion, setNewCriterion] = useState('');
    const [newType, setNewType] = useState<CriterionType>('must_pass');

    const handleAdd = () => {
        if (!newCriterion.trim()) return;
        onChange([...criteria, { criterion: newCriterion.trim(), type: newType }]);
        setNewCriterion('');
    };

    const handleRemove = (index: number) => {
        onChange(criteria.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="space-y-3">
            {/* Existing criteria */}
            {criteria.length > 0 && (
                <div className="space-y-2">
                    {criteria.map((c, index) => {
                        const config = CRITERION_TYPE_CONFIG[c.type];
                        return (
                            <div
                                key={index}
                                className="flex items-center gap-2 p-2 rounded-md border bg-muted/30"
                            >
                                <Badge
                                    className={`shrink-0 text-xs ${config.color}`}
                                    variant={config.badgeVariant}
                                >
                                    {config.label}
                                </Badge>
                                <span className="text-sm flex-1">{c.criterion}</span>
                                {!disabled && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0"
                                        onClick={() => handleRemove(index)}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add new criterion */}
            {!disabled && (
                <div className="flex gap-2">
                    <Select
                        value={newType}
                        onValueChange={(v) => setNewType(v as CriterionType)}
                    >
                        <SelectTrigger className="w-[140px] shrink-0">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="must_pass">Must Pass</SelectItem>
                            <SelectItem value="should_pass">Should Pass</SelectItem>
                            <SelectItem value="must_not_fail">Must Not Fail</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        placeholder="Add success criterion..."
                        value={newCriterion}
                        onChange={(e) => setNewCriterion(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleAdd}
                        disabled={!newCriterion.trim()}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {criteria.length === 0 && !disabled && (
                <p className="text-xs text-muted-foreground">
                    Add criteria to define what makes this test pass or fail.
                </p>
            )}
        </div>
    );
}
