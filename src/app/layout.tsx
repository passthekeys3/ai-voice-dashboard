import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { getAgencyFromDomain } from "@/lib/getAgencyFromDomain";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

// Default metadata for the platform
const DEFAULT_METADATA: Metadata = {
    title: "Voice AI Dashboard",
    description: "White-label voice AI agency dashboard",
    icons: {
        icon: "/favicon.ico",
    },
};

// Generate dynamic metadata based on agency branding
export async function generateMetadata(): Promise<Metadata> {
    try {
        const headersList = await headers();
        const host = headersList.get("host") || "localhost";

        const agency = await getAgencyFromDomain(host);

        if (agency?.branding) {
            const branding = agency.branding;
            const title = branding.company_name || agency.name || DEFAULT_METADATA.title;

            return {
                title: {
                    default: title as string,
                    template: `%s | ${title}`,
                },
                description: branding.tagline || DEFAULT_METADATA.description,
                icons: branding.favicon_url
                    ? { icon: branding.favicon_url }
                    : DEFAULT_METADATA.icons,
                openGraph: {
                    title: title as string,
                    description: branding.tagline || (DEFAULT_METADATA.description as string),
                    siteName: title as string,
                    images: branding.logo_url ? [branding.logo_url] : undefined,
                },
            };
        }

        return DEFAULT_METADATA;
    } catch {
        // Fallback to default metadata on any error
        return DEFAULT_METADATA;
    }
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} font-sans antialiased`}>
                <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
                    {children}
                    <Toaster position="bottom-right" richColors closeButton />
                </ThemeProvider>
            </body>
        </html>
    );
}
