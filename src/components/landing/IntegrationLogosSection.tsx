'use client';

import { useInView } from '@/hooks/useInView';

interface LogoProps {
    className?: string;
}

function GoHighLevelLogo({ className }: LogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            className={className}
            aria-hidden="true"
        >
            <path d="M13.5 2L4 13.5h7L8.5 22 20 10.5h-7z" />
        </svg>
    );
}

function HubSpotLogo({ className }: LogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            className={className}
            aria-hidden="true"
        >
            <path d="M18.164 7.931V5.085a2.198 2.198 0 0 0 1.266-1.978V3.05a2.199 2.199 0 0 0-2.196-2.196h-.058a2.199 2.199 0 0 0-2.196 2.196v.057a2.2 2.2 0 0 0 1.267 1.978v2.846a6.235 6.235 0 0 0-2.969 1.31L5.2 3.226a2.378 2.378 0 0 0 .079-.593 2.39 2.39 0 1 0-2.39 2.39c.421 0 .814-.11 1.155-.302l7.998 5.855a6.263 6.263 0 0 0-.976 3.388c0 1.292.393 2.492 1.064 3.493l-2.44 2.44a1.875 1.875 0 0 0-.548-.084 1.9 1.9 0 1 0 1.9 1.9 1.876 1.876 0 0 0-.084-.548l2.41-2.41a6.297 6.297 0 0 0 3.85 1.306c3.478 0 6.3-2.822 6.3-6.3a6.3 6.3 0 0 0-4.354-5.99zm-1.988 9.44a3.076 3.076 0 1 1 0-6.151 3.076 3.076 0 0 1 0 6.152z" />
        </svg>
    );
}

function CalendlyLogo({ className }: LogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            className={className}
            aria-hidden="true"
        >
            <path d="M12 2a10 10 0 1 0 5.196 18.535l-1.602-2.77A7 7 0 1 1 12 5a6.97 6.97 0 0 1 4.243 1.428l1.722-2.67A9.953 9.953 0 0 0 12 2z" />
        </svg>
    );
}

function SlackLogo({ className }: LogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            className={className}
            aria-hidden="true"
        >
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
    );
}

function RetellLogo({ className }: LogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className={className}
            aria-hidden="true"
        >
            <line x1="4" y1="9" x2="4" y2="15" />
            <line x1="8" y1="6" x2="8" y2="18" />
            <line x1="12" y1="3" x2="12" y2="21" />
            <line x1="16" y1="6" x2="16" y2="18" />
            <line x1="20" y1="9" x2="20" y2="15" />
        </svg>
    );
}

function VapiLogo({ className }: LogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            className={className}
            aria-hidden="true"
        >
            <path d="M3 4h3.5l5.5 12 5.5-12H21L12 22z" />
        </svg>
    );
}

const integrations = [
    { name: 'GoHighLevel', Logo: GoHighLevelLogo },
    { name: 'HubSpot', Logo: HubSpotLogo },
    { name: 'Calendly', Logo: CalendlyLogo },
    { name: 'Slack', Logo: SlackLogo },
    { name: 'Retell', Logo: RetellLogo },
    { name: 'Vapi', Logo: VapiLogo },
];

export function IntegrationLogosSection() {
    const { ref, isInView } = useInView({ threshold: 0.2 });

    return (
        <section ref={ref} className="py-12 sm:py-16 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                <p
                    className={`text-xs font-medium text-muted-foreground uppercase tracking-widest text-center mb-8 animate-on-scroll stagger-1 ${isInView ? 'is-visible' : ''}`}
                >
                    Works with your existing stack
                </p>
                <div
                    className={`flex flex-wrap items-center justify-center gap-8 sm:gap-12 animate-on-scroll stagger-2 ${isInView ? 'is-visible' : ''}`}
                >
                    {integrations.map(({ name, Logo }) => (
                        <div
                            key={name}
                            className="flex items-center gap-2 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors duration-200"
                        >
                            <Logo />
                            <span className="text-sm font-medium">{name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
