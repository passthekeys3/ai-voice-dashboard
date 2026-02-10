import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Voice Assistant',
    robots: { index: false, follow: false },
};

/**
 * Minimal layout for the embeddable widget — no dashboard chrome,
 * no ThemeProvider, no Toaster. Just passes children through.
 *
 * The root layout (src/app/layout.tsx) provides <html> and <body>.
 * We override styles at the page level to strip dashboard CSS.
 */
export default function WidgetLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div style={{ margin: 0, padding: 0, overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif', height: '100vh', width: '100vw' }}>
            {children}
        </div>
    );
}
