/**
 * What Sentry may attach to events. Shared by every Sentry.init call.
 *
 * Sentry v11 replaced `sendDefaultPii` with `dataCollection` and made the
 * defaults permissive: with this unset it would send cookies (session tokens),
 * request bodies, query strings (OAuth codes), local variable values (decrypted
 * provider API keys), and AI prompts/outputs (call transcripts). This keeps the
 * v10 behavior of collecting none of that.
 */
import type * as Sentry from '@sentry/nextjs';

type DataCollection = NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>['dataCollection']>;

export const SENTRY_DATA_COLLECTION: DataCollection = {
    userInfo: false,
    cookies: false,
    // Allow-list rather than deny-list, so new auth/IP headers are never sent by default
    httpHeaders: {
        request: { allow: ['user-agent', 'content-type', 'accept', 'referer'] },
        response: { allow: ['content-type'] },
    },
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
};
