import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const BAR_HEIGHTS = [40, 70, 100, 58, 67];

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0f172a',
                    borderRadius: '36px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        height: '120px',
                    }}
                >
                    {BAR_HEIGHTS.map((h, i) => (
                        <div
                            key={i}
                            style={{
                                width: '16px',
                                height: `${h * 1.2}px`,
                                borderRadius: '8px',
                                background: 'linear-gradient(180deg, #60a5fa, #3b82f6)',
                            }}
                        />
                    ))}
                </div>
            </div>
        ),
        { ...size }
    );
}
