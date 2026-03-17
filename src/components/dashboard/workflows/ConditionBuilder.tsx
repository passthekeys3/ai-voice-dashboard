'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { conditionFields, conditionOperators } from './ActionTypeRegistry';
import type { WorkflowCondition } from '@/types';

interface ConditionBuilderProps {
    conditions: (WorkflowCondition & { _key: string })[];
    addCondition: () => void;
    removeCondition: (index: number) => void;
    updateCondition: (index: number, updates: Partial<WorkflowCondition>) => void;
}

export function ConditionBuilder({ conditions, addCondition, removeCondition, updateCondition }: ConditionBuilderProps) {
    return (
        <>
            {conditions.map((condition, index) => (
                <div key={condition._key} className="flex items-center gap-2">
                    <Select
                        value={condition.field}
                        onValueChange={(v: string) => updateCondition(index, { field: v })}
                    >
                        <SelectTrigger className="min-w-[180px] w-auto">
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
                        <SelectTrigger className="min-w-[140px] w-auto">
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
        </>
    );
}
