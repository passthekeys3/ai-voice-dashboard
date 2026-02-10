/**
 * Status configuration for calls and other entities
 * Centralized styling and display configuration
 */

// Badge variants from the badge component
// Note: 'error' is mapped to 'destructive' in the actual usage
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'live' | 'error';

// =====================================================
// CALL STATUS CONFIGURATION
// =====================================================

export type CallStatus =
    | 'completed'
    | 'ended'
    | 'in_progress'
    | 'active'
    | 'failed'
    | 'error'
    | 'no_answer'
    | 'busy'
    | 'canceled'
    | 'pending'
    | 'scheduled'
    | 'queued';

export interface StatusConfig {
    label: string;
    variant: BadgeVariant;
    icon?: string;
    description?: string;
}

export const CALL_STATUS_CONFIG: Record<CallStatus, StatusConfig> = {
    completed: {
        label: 'Completed',
        variant: 'success',
        description: 'Call completed successfully',
    },
    ended: {
        label: 'Ended',
        variant: 'success',
        description: 'Call has ended',
    },
    in_progress: {
        label: 'In Progress',
        variant: 'live',
        description: 'Call is currently active',
    },
    active: {
        label: 'Active',
        variant: 'live',
        description: 'Call is currently active',
    },
    failed: {
        label: 'Failed',
        variant: 'error',
        description: 'Call failed to connect',
    },
    error: {
        label: 'Error',
        variant: 'error',
        description: 'An error occurred during the call',
    },
    no_answer: {
        label: 'No Answer',
        variant: 'warning',
        description: 'Recipient did not answer',
    },
    busy: {
        label: 'Busy',
        variant: 'warning',
        description: 'Recipient line was busy',
    },
    canceled: {
        label: 'Canceled',
        variant: 'secondary',
        description: 'Call was canceled',
    },
    pending: {
        label: 'Pending',
        variant: 'secondary',
        description: 'Call is pending',
    },
    scheduled: {
        label: 'Scheduled',
        variant: 'info',
        description: 'Call is scheduled for later',
    },
    queued: {
        label: 'Queued',
        variant: 'secondary',
        description: 'Call is in queue',
    },
};

/**
 * Get status configuration with fallback for unknown statuses
 */
export function getCallStatusConfig(status: string): StatusConfig {
    const normalizedStatus = status.toLowerCase().replace(/[^a-z_]/g, '') as CallStatus;
    return CALL_STATUS_CONFIG[normalizedStatus] || {
        label: status,
        variant: 'secondary' as const,
        description: `Status: ${status}`,
    };
}

// =====================================================
// EXPERIMENT STATUS CONFIGURATION
// =====================================================

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

export const EXPERIMENT_STATUS_CONFIG: Record<ExperimentStatus, StatusConfig> = {
    draft: {
        label: 'Draft',
        variant: 'secondary',
        description: 'Experiment is being configured',
    },
    running: {
        label: 'Running',
        variant: 'live',
        description: 'Experiment is actively collecting data',
    },
    paused: {
        label: 'Paused',
        variant: 'warning',
        description: 'Experiment is temporarily paused',
    },
    completed: {
        label: 'Completed',
        variant: 'success',
        description: 'Experiment has finished',
    },
    archived: {
        label: 'Archived',
        variant: 'outline',
        description: 'Experiment has been archived',
    },
};

/**
 * Get experiment status configuration with fallback
 */
export function getExperimentStatusConfig(status: string): StatusConfig {
    return EXPERIMENT_STATUS_CONFIG[status as ExperimentStatus] || {
        label: status,
        variant: 'secondary' as const,
        description: `Status: ${status}`,
    };
}

// =====================================================
// AGENT STATUS CONFIGURATION
// =====================================================

export type AgentStatus = 'active' | 'inactive' | 'error' | 'syncing';

export const AGENT_STATUS_CONFIG: Record<AgentStatus, StatusConfig> = {
    active: {
        label: 'Active',
        variant: 'success',
        description: 'Agent is active and ready',
    },
    inactive: {
        label: 'Inactive',
        variant: 'secondary',
        description: 'Agent is not active',
    },
    error: {
        label: 'Error',
        variant: 'error',
        description: 'Agent has an error',
    },
    syncing: {
        label: 'Syncing',
        variant: 'info',
        description: 'Agent is syncing with provider',
    },
};

// =====================================================
// PROVIDER CONFIGURATION
// =====================================================

export type VoiceProvider = 'retell' | 'vapi';

export interface ProviderConfig {
    label: string;
    color: string;
    bgColor: string;
    darkBgColor: string;
}

export const PROVIDER_CONFIG: Record<VoiceProvider, ProviderConfig> = {
    retell: {
        label: 'Retell',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        darkBgColor: 'dark:bg-blue-900/20',
    },
    vapi: {
        label: 'Vapi',
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        darkBgColor: 'dark:bg-purple-900/20',
    },
};

/**
 * Get provider configuration with fallback
 */
export function getProviderConfig(provider: string): ProviderConfig {
    return PROVIDER_CONFIG[provider as VoiceProvider] || {
        label: provider,
        color: 'text-slate-600',
        bgColor: 'bg-slate-50',
        darkBgColor: 'dark:bg-slate-900/20',
    };
}
