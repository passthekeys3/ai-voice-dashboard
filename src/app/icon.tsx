import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

const BAR_HEIGHTS = [40, 70, 100, 58, 67];

export default function Icon() {
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
                    borderRadius: '6px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        height: '22px',
                    }}
                >
                    {BAR_HEIGHTS.map((h, i) => (
                        <div
                            key={i}
                            style={{
                                width: '3px',
                                height: `${h * 0.22}px`,
                                borderRadius: '1.5px',
                                background: '#ffffff',
                            }}
                        />
                    ))}
                </div>
            </div>
        ),
        { ...size }
    );
}
