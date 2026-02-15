import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
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

                <ProductSection
                    label="Build"
                    headline="Describe your agent. Watch it come to life."
                    description="Tell the AI what your agent should say, how it should sound, and when to transfer. It writes the script, picks the voice, and handles the rest."
                    visual="builder"
                />

                <ProductSection
                    label="Monitor"
                    headline="See every conversation, in real time."
                    description="Call volume, success rates, costs, and duration — all in one view. Click any call to read the full transcript or listen to the recording."
                    visual="analytics"
                    reverse
                />

                <ProductSection
                    label="Automate"
                    headline="Connect calls to the rest of your stack."
                    description="When a call ends, update your CRM, book the appointment, and send the follow-up. Works with GoHighLevel, HubSpot, Calendly, and Slack."
                    visual="workflows"
                />

                <ProductSection
                    label="Scale"
                    headline="White-label the entire platform."
                    description="Your clients get their own branded dashboard — your logo, your domain, their data. You control what they can access."
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
