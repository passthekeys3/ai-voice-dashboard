import * as Sentry from '@sentry/nextjs';
import { SENTRY_DATA_COLLECTION } from './sentry.privacy';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        dataCollection: SENTRY_DATA_COLLECTION,
        tracesSampleRate: 1.0,
        environment: process.env.VERCEL_ENV || 'development',
    });
}
