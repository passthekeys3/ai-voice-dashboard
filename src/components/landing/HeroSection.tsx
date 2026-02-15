import { AgentPreviewDemo } from './AgentPreviewDemo';

export function HeroSection() {
    return (
        <section className="relative flex flex-col items-center justify-center px-4 pt-32 pb-20 sm:pt-40 sm:pb-28">
            <div className="max-w-2xl mx-auto text-center space-y-4 mb-12">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
                    What should your voice agent do?
                </h1>
                <p className="text-lg text-muted-foreground">
                    Describe it in plain English. We&apos;ll build the rest.
                </p>
            </div>

            <div className="w-full max-w-2xl mx-auto">
                <AgentPreviewDemo />
            </div>
        </section>
    );
}
