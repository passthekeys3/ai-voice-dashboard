/**
 * AI Agent Builder Types
 */

export interface AgentDraft {
    name: string;
    provider: 'retell' | 'vapi' | 'bland';
    systemPrompt: string;
    firstMessage: string;
    voiceId: string;
    voiceName: string;
    language: string;
    integrations: IntegrationSelection[];
}

export interface IntegrationSelection {
    templateId: string;
    name: string;
    description: string;
    enabled: boolean;
    crm: 'ghl' | 'hubspot' | 'gcal' | 'calendly' | 'slack';
}

export interface BuilderMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    updates?: Partial<AgentDraft>;
    timestamp: number;
}

export interface VoiceRecommendation {
    voice_id: string;
    name: string;
    gender?: string;
    accent?: string;
    age?: string;
    preview_url?: string;
    reasoning: string;
    score: number;
}

export interface VoiceCharacteristics {
    gender?: 'male' | 'female' | 'neutral';
    ageRange?: 'young' | 'middle-aged' | 'mature';
    accent?: string;
    tone?: string;
}

/** Shape of the structured JSON Claude returns */
export interface LLMBuilderResponse {
    message: string;
    updates?: {
        name?: string;
        systemPrompt?: string;
        firstMessage?: string;
        voiceCharacteristics?: VoiceCharacteristics;
        integrationSuggestions?: string[];
        language?: string;
    };
}

export interface BuilderContext {
    hasGHL: boolean;
    hasHubSpot: boolean;
    hasGCal: boolean;
    hasCalendly: boolean;
    hasSlack: boolean;
}

export interface Voice {
    id: string;
    name: string;
    provider: string;
    gender?: string;
    accent?: string;
    age?: string;
    preview_url?: string;
}
