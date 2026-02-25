import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const BAR_HEIGHTS = [40, 70, 100, 58, 67];

export async function GET() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '20px',
                    background: '#ffffff',
                }}
            >
                {/* Soundwave icon */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        height: '80px',
                    }}
                >
                    {BAR_HEIGHTS.map((h, i) => (
                        <div
                            key={i}
                            style={{
                                width: '8px',
                                height: `${h * 0.8}px`,
                                borderRadius: '4px',
                                background: '#3b82f6',
                            }}
                        />
                    ))}
                </div>
                {/* Wordmark */}
                <div
                    style={{
                        fontSize: '48px',
                        fontWeight: 700,
                        color: '#0f172a',
                        letterSpacing: '-0.02em',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                >
                    BuildVoiceAI
                </div>
            </div>
        ),
        { width: 600, height: 200 }
    );
}
