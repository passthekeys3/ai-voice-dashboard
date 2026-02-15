import { AgentPreviewDemo } from './AgentPreviewDemo';

export function HeroSection() {
    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-violet-500/10 dark:bg-violet-500/5 blur-3xl" />
                <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-purple-500/8 dark:bg-purple-500/3 blur-3xl" />
            </div>

            <div className="max-w-4xl mx-auto text-center space-y-6 animate-fade-up">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/50 text-sm text-violet-700 dark:text-violet-300">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                    </span>
                    Now in public beta
                </div>

                {/* Headline */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-balance">
                    Build AI Voice Agents{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400">
                        in Seconds
                    </span>
                </h1>

                {/* Subheadline */}
                <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
                    Describe what your voice agent should do in plain English. We&apos;ll generate the
                    system prompt, pick a voice, and deploy it to a phone number. White-label ready
                    for agencies.
                </p>
            </div>

            {/* Interactive prompt box */}
            <div className="w-full max-w-3xl mx-auto mt-10" style={{ animationDelay: '200ms' }}>
                <AgentPreviewDemo />
            </div>
        </section>
    );
}
