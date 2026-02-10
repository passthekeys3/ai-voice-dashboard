'use client';

import { Zap } from 'lucide-react';
import type { IntegrationSelection } from '@/lib/agent-builder/types';

interface AgentBuilderIntegrationCardProps {
    integration: IntegrationSelection;
    onToggle: (enabled: boolean) => void;
}

const CRM_ICONS: Record<string, string> = {
    ghl: '🟢',
    hubspot: '🟠',
};

export function AgentBuilderIntegrationCard({
    integration,
    onToggle,
}: AgentBuilderIntegrationCardProps) {
    return (
        <div
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                integration.enabled
                    ? 'border-violet-500/30 bg-violet-500/5'
                    : 'border-border opacity-60'
            }`}
        >
            {/* CRM Icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm">
                {CRM_ICONS[integration.crm] || <Zap className="h-4 w-4" />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{integration.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                    {integration.description}
                </div>
            </div>

            {/* Toggle */}
            <button
                onClick={() => onToggle(!integration.enabled)}
                className={`flex-shrink-0 relative w-9 h-5 rounded-full transition-colors duration-200 ${
                    integration.enabled ? 'bg-violet-500' : 'bg-muted'
                }`}
                role="switch"
                aria-checked={integration.enabled}
                aria-label={`Toggle ${integration.name}`}
            >
                <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        integration.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                />
            </button>
        </div>
    );
}
