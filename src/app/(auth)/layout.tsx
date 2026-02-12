import { headers } from 'next/headers';
import Image from 'next/image';
import { getAgencyFromDomain } from '@/lib/getAgencyFromDomain';
import { DEFAULT_AGENCY_BRANDING } from '@/types/database';

export default async function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Get agency branding from domain
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost';
    const agency = await getAgencyFromDomain(host);
    const branding = agency?.branding;

    const isValidColor = (c: string) => /^#[0-9A-Fa-f]{3,8}$/.test(c);
    const rawPrimary = branding?.primary_color || DEFAULT_AGENCY_BRANDING.primary_color;
    const primaryColor = isValidColor(rawPrimary) ? rawPrimary : DEFAULT_AGENCY_BRANDING.primary_color;
    const logoUrl = branding?.logo_url;
    const companyName = branding?.company_name || agency?.name;
    const tagline = branding?.tagline;
    const loginMessage = branding?.login_message;

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            {/* Inject brand colors as CSS variables */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                        :root {
                            --brand-primary: ${primaryColor};
                        }
                    `,
                }}
            />

            {/* Header with logo */}
            <header className="w-full py-6 px-4">
                <div className="max-w-md mx-auto flex flex-col items-center">
                    {logoUrl ? (
                        <Image
                            src={logoUrl}
                            alt={companyName || 'Logo'}
                            width={200}
                            height={50}
                            className="h-12 w-auto object-contain"
                            priority
                        />
                    ) : companyName ? (
                        <h1
                            className="text-2xl font-bold"
                            style={{ color: primaryColor }}
                        >
                            {companyName}
                        </h1>
                    ) : null}

                    {tagline && (
                        <p className="mt-2 text-sm text-muted-foreground text-center">
                            {tagline}
                        </p>
                    )}
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex items-center justify-center px-4 pb-12">
                <div className="w-full max-w-md">
                    {loginMessage && (
                        <div
                            className="mb-6 p-4 rounded-lg text-center text-sm"
                            style={{
                                backgroundColor: `${primaryColor}10`,
                                borderColor: `${primaryColor}30`,
                                borderWidth: 1,
                            }}
                        >
                            {loginMessage}
                        </div>
                    )}
                    {children}
                </div>
            </main>

            {/* Footer */}
            <footer className="py-4 px-4 text-center text-sm text-muted-foreground">
                {branding?.footer_text || (
                    <>
                        {companyName ? `© ${new Date().getFullYear()} ${companyName}` : 'Powered by BuildVoiceAI'}
                    </>
                )}
            </footer>
        </div>
    );
}
