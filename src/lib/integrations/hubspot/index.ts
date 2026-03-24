/**
 * HubSpot Integration — barrel export.
 *
 * All existing `import { ... } from '@/lib/integrations/hubspot'` continue
 * to work without changes. Internally, the code is split into:
 *   - hubspot/auth.ts      — OAuth token management
 *   - hubspot/contacts.ts  — Contact CRUD, tags, notes, call logging
 *   - hubspot/pipeline.ts  — Deal pipeline management
 *   - hubspot/meetings.ts  — Meeting CRUD, booking
 *   - hubspot/workflows.ts — Workflow enrollment
 *   - hubspot/shared.ts    — Constants, types, fetch helper
 */

// Auth
export { refreshAccessToken, getValidAccessToken } from './auth';

// Contacts
export {
    searchContactByPhone,
    searchContactByEmail,
    createContact,
    updateContact,
    updateContactProperty,
    upsertContact,
    updateContactTags,
    addNoteToContact,
    addCallNoteToContact,
    createCallEngagement,
    logCallToHubSpot,
} from './contacts';

// Pipeline
export { getPipelines, updateContactPipeline } from './pipeline';

// Meetings
export {
    createMeeting,
    cancelMeeting,
    getMeetingsByContact,
    bookNextAvailableMeeting,
} from './meetings';

// Workflows
export { triggerWorkflow } from './workflows';

// Types
export type { HubSpotConfig, HubSpotContact, HubSpotDeal, HubSpotMeeting, HubSpotPipeline } from './shared';
