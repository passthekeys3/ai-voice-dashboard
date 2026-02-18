// Module declarations for packages with ESM type resolution issues in Next.js 16 Turbopack.
// Radix UI packages reference .d.mts files in their "exports" map but only ship .d.ts files.
// date-fns v4 exports .d.cts types that Turbopack can't resolve through "exports" map.
// retell-client-js-sdk has no type declarations.

// Radix UI — .d.mts files missing from dist, Turbopack's strict resolver fails
declare module '@radix-ui/react-alert-dialog';
declare module '@radix-ui/react-avatar';
declare module '@radix-ui/react-dialog';
declare module '@radix-ui/react-dropdown-menu';
declare module '@radix-ui/react-label';
declare module '@radix-ui/react-progress';
declare module '@radix-ui/react-select';
declare module '@radix-ui/react-separator';
declare module '@radix-ui/react-slider';
declare module '@radix-ui/react-slot';
declare module '@radix-ui/react-switch';
declare module '@radix-ui/react-tabs';

declare module 'date-fns' {
    export function format(date: Date | number | string, formatStr: string): string;
    export function formatDistanceToNow(date: Date | number | string, options?: { addSuffix?: boolean }): string;
}

declare module 'retell-client-js-sdk' {
    export class RetellWebClient {
        constructor(options?: Record<string, unknown>);
        startCall(options: Record<string, unknown>): Promise<void>;
        stopCall(): void;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        on(event: string, callback: (...args: any[]) => void): void;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        off(event: string, callback: (...args: any[]) => void): void;
        removeAllListeners(): void;
    }
}
