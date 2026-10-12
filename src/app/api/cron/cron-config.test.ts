import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '../../../..');
const vercelConfig = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')) as {
    crons: { path: string; schedule: string }[];
};
const cronDir = path.join(root, 'src/app/api/cron');
const cronRoutes = readdirSync(cronDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);

describe('Vercel cron configuration', () => {
    it('only schedules crons that run at most once a day (Hobby plan rejects the deploy otherwise)', () => {
        for (const { path: cronPath, schedule } of vercelConfig.crons) {
            const [minute, hour] = schedule.split(/\s+/);
            expect(/^\d+$/.test(minute) && /^\d+$/.test(hour), `${cronPath} runs more than daily: "${schedule}"`).toBe(true);
        }
    });

    it('points every cron at an existing route', () => {
        for (const { path: cronPath } of vercelConfig.crons) {
            expect(cronRoutes).toContain(cronPath.replace('/api/cron/', ''));
        }
    });

    it('has every cron route accept GET, which is what Vercel Cron sends', () => {
        for (const name of cronRoutes) {
            const source = readFileSync(path.join(cronDir, name, 'route.ts'), 'utf8');
            expect(/export (const GET|(async )?function GET)\b/.test(source), `${name} has no GET handler`).toBe(true);
        }
    });
});
