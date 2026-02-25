interface LogoProps {
    variant?: 'full' | 'icon';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const BARS = [
    { x: 1, height: 10 },
    { x: 5.5, height: 17 },
    { x: 10, height: 20 },
    { x: 14.5, height: 14 },
    { x: 19, height: 16 },
];

const sizeConfig = {
    sm: { icon: 'h-5 w-5', text: 'text-[15px] font-bold tracking-tight' },
    md: { icon: 'h-6 w-6', text: 'text-base font-semibold tracking-tight' },
    lg: { icon: 'h-8 w-8', text: 'text-xl font-bold tracking-tight' },
};

export function Logo({ variant = 'full', size = 'sm', className = '' }: LogoProps) {
    const config = sizeConfig[size];

    const icon = (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`${config.icon} shrink-0`}
            aria-hidden="true"
        >
            {BARS.map((bar, i) => (
                <rect
                    key={i}
                    x={bar.x}
                    y={24 - bar.height - (24 - bar.height) / 2}
                    width={3}
                    height={bar.height}
                    rx={1.5}
                    fill="#3b82f6"
                />
            ))}
        </svg>
    );

    if (variant === 'icon') {
        return <span className={className}>{icon}</span>;
    }

    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            {icon}
            <span className={config.text}>BuildVoiceAI</span>
        </span>
    );
}
