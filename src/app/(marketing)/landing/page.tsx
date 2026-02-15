import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { LogoBar } from '@/components/landing/LogoBar';
import { ProductSection } from '@/components/landing/ProductSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
    return (
        <>
            <Navbar />
            <main>
                <HeroSection />
                <LogoBar />

                <ProductSection
                    label="Build"
                    headline="Describe your agent. Watch it come to life."
                    description="Use plain English to define personality, scripts, and call flows. No code required — just describe what you want and deploy in minutes."
                    visual="builder"
                />

                <ProductSection
                    label="Monitor"
                    headline="See every conversation, in real time."
                    description="Track call volume, success rates, and average duration from a single dashboard. Export reports or drill into individual transcripts."
                    visual="analytics"
                    reverse
                />

                <ProductSection
                    label="Automate"
                    headline="Connect calls to the rest of your stack."
                    description="Trigger CRM updates, book appointments, and send follow-ups automatically when a call ends. Works with GoHighLevel, HubSpot, and more."
                    visual="workflows"
                />

                <ProductSection
                    label="Scale"
                    headline="White-label the entire platform."
                    description="Give each client their own branded portal with custom domains, separate billing, and isolated analytics. Built for agencies from day one."
                    visual="portal"
                    reverse
                />

                <PricingSection />
                <FinalCTA />
            </main>
            <Footer />
        </>
    );
}
