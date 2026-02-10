/**
 * AI Agent Builder - Barrel Export
 */

export type {
    AgentDraft,
    BuilderMessage,
    VoiceRecommendation,
    VoiceCharacteristics,
    LLMBuilderResponse,
    BuilderContext,
    Voice,
    IntegrationSelection,
} from './types';

export { generateAgentConfigStream, matchVoicesToDescription } from './llm';

export {
    getAvailableTemplates,
    getTemplateActions,
    getTemplateById,
    WORKFLOW_TEMPLATES,
} from './templates';
export type { WorkflowTemplate } from './templates';

export { BUILDER_SYSTEM_PROMPT, buildMessages } from './prompts';
