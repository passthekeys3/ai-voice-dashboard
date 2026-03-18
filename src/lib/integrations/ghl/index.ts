/**
 * GHL Integration — barrel export.
 *
 * All existing `import { ... } from '@/lib/integrations/ghl'` continue
 * to work without changes. Internally, the code is split into:
 *   - ghl/auth.ts     — OAuth token management
 *   - ghl/contacts.ts — Contact CRUD, tags, notes, workflows
 *   - ghl/calendar.ts — Calendar, appointments, booking
 *   - ghl/pipeline.ts — Pipeline/opportunity management
 *   - ghl/shared.ts   — Constants, types, fetch helper
 */

// Auth
export { getValidAccessToken } from './auth';

// Contacts
export {
    searchContactByPhone,
    createContact,
    updateContact,
    upsertContact,
    updateContactTags,
    updateContactCustomField,
    addNoteToContact,
    addCallNoteToContact,
    triggerContactWorkflow,
    logCallToGHL,
} from './contacts';

// Calendar & Appointments
export {
    getCalendars,
    getCalendarFreeSlots,
    getNextAvailableSlot,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    getAppointment,
    bookNextAvailableAppointment,
} from './calendar';

// Pipeline
export {
    getPipelines,
    updateContactPipeline,
} from './pipeline';

// Types
export type { GHLConfig, GHLContact } from './shared';
export type { GHLCalendar, GHLTimeSlot, GHLAppointment } from './calendar';

// Scoring utilities (re-exported from shared integration utilities)
export { calculateAutoTags, calculateLeadScore } from '../shared';
