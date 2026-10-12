'use client';

import { Zap, Info } from 'lucide-react';
import type { VoiceProvider } from '@/types';
import { estimateCostPerMin, formatCostPerMin } from '@/lib/constants/config';
import { cn } from '@/lib/utils';

interface CostEstimateProps {
    provider: VoiceProvider;
    voiceModel: string;
    llmModel: string;
    className?: string;
}

/** "Est. ~$X/min" line with a hover/focus breakdown. Renders nothing for providers we don't estimate. */
export function CostEstimate({ provider, voiceModel, llmModel, className }: CostEstimateProps) {
    const cost = estimateCostPerMin(provider, voiceModel, llmModel);
    if (!cost) return null;

    const rows: Array<[label: string, value: string]> = [
        ['Platform', formatCostPerMin(cost.platform)],
        ['Voice', cost.voice === null ? 'In speech model' : formatCostPerMin(cost.voice)],
        ['LLM', cost.llm === null ? 'Not listed' : formatCostPerMin(cost.llm)],
        ['Telephony', formatCostPerMin(cost.telephony)],
    ];

    return (
        <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span>Est. ~${cost.total.toFixed(3)}/min</span>
            <div className="relative group ml-auto" tabIndex={0} role="button" aria-label="Show cost breakdown">
                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/70 group-hover:text-foreground group-focus-within:text-foreground transition-colors" />
                <div className="absolute bottom-full right-0 mb-2 w-56 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity z-50">
                    <p className="font-medium text-xs mb-2">Cost breakdown</p>
                    <div className="space-y-1 text-[11px]">
                        {rows.map(([label, value]) => (
                            <div key={label} className="flex justify-between">
                                <span className="text-muted-foreground">{label}</span>
                                <span>{value}</span>
                            </div>
                        ))}
                        <div className="flex justify-between border-t pt-1 mt-1 font-medium">
                            <span>Total</span>
                            <span>${cost.total.toFixed(3)}/min</span>
                        </div>
                    </div>
                    {provider !== 'retell' && (
                        <p className="mt-2 text-[10px] text-muted-foreground">LLM cost is an estimate; billed by tokens used.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
