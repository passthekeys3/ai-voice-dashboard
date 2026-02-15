const logos = [
    'Retell AI',
    'Vapi',
    'GoHighLevel',
    'HubSpot',
    'Twilio',
    'Calendly',
];

export function LogoBar() {
    return (
        <section className="py-12 px-4 border-t border-border/50">
            <div className="max-w-4xl mx-auto">
                <p className="text-xs text-muted-foreground/60 text-center uppercase tracking-widest mb-6">
                    Integrates with
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                    {logos.map((name) => (
                        <span
                            key={name}
                            className="text-sm font-medium text-muted-foreground/40"
                        >
                            {name}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}
