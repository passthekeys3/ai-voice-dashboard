import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'BuildVoiceAI - AI Voice Agents Platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
            >
                {/* Decorative gradient orb */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-100px',
                        right: '-100px',
                        width: '400px',
                        height: '400px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
                        display: 'flex',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: '-80px',
                        left: '-80px',
                        width: '300px',
                        height: '300px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(14,165,233,0.1) 0%, transparent 70%)',
                        display: 'flex',
                    }}
                />

                {/* Main content */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '20px',
                    }}
                >
                    {/* Soundwave icon */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            height: '64px',
                        }}
                    >
                        {[24, 42, 60, 36, 48].map((h, i) => (
                            <div
                                key={i}
                                style={{
                                    width: '10px',
                                    height: `${h}px`,
                                    borderRadius: '5px',
                                    background: 'linear-gradient(180deg, #60a5fa, #3b82f6)',
                                }}
                            />
                        ))}
                    </div>
                    <div
                        style={{
                            fontSize: '64px',
                            fontWeight: 700,
                            color: '#ffffff',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        BuildVoiceAI
                    </div>
                    <div
                        style={{
                            fontSize: '28px',
                            fontWeight: 400,
                            color: '#94a3b8',
                            letterSpacing: '0.01em',
                        }}
                    >
                        AI Voice Agents for Agencies
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
