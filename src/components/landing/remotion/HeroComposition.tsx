import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

/* ─── Configuration ─── */

// Two voice sources — left (human) and right (AI) — emit speech arcs
interface VoiceSourceConfig {
    id: number;
    cx: number; // center X in %
    cy: number; // center Y in %
    hue: number;
    arcCount: number; // concurrent arcs
    arcInterval: number; // frames between arc emissions
    arcPhase: number; // frame offset for first arc
    direction: 1 | -1; // 1 = rightward arcs, -1 = leftward arcs
}

const VOICE_SOURCES: VoiceSourceConfig[] = [
    { id: 0, cx: 15, cy: 45, hue: 262, arcCount: 4, arcInterval: 60, arcPhase: 0, direction: 1 },
    { id: 1, cx: 85, cy: 40, hue: 221, arcCount: 4, arcInterval: 60, arcPhase: 30, direction: -1 },
];

// Center focal point — the AI "brain" between the two voice sources
const CENTER_FOCAL = { cx: 50, cy: 42 };

// Floating AI nodes that drift and connect
interface NodeConfig {
    id: number;
    cx: number;
    cy: number;
    radiusX: number;
    radiusY: number;
    speed: number;
    phase: number;
    size: number;
    hue: number;
}

const NODES: NodeConfig[] = [
    { id: 0, cx: 35, cy: 30, radiusX: 4, radiusY: 3, speed: 0.006, phase: 0, size: 6, hue: 255 },
    { id: 1, cx: 55, cy: 25, radiusX: 3, radiusY: 4, speed: 0.008, phase: 1.5, size: 5, hue: 240 },
    { id: 2, cx: 65, cy: 55, radiusX: 5, radiusY: 3, speed: 0.005, phase: 3.0, size: 7, hue: 250 },
    { id: 3, cx: 40, cy: 65, radiusX: 4, radiusY: 5, speed: 0.007, phase: 4.2, size: 5, hue: 230 },
    { id: 4, cx: 50, cy: 45, radiusX: 3, radiusY: 3, speed: 0.009, phase: 2.1, size: 8, hue: 262 },
    { id: 5, cx: 75, cy: 35, radiusX: 3, radiusY: 4, speed: 0.004, phase: 5.0, size: 5, hue: 245 },
    { id: 6, cx: 25, cy: 50, radiusX: 4, radiusY: 3, speed: 0.006, phase: 0.8, size: 6, hue: 235 },
    { id: 7, cx: 60, cy: 70, radiusX: 3, radiusY: 4, speed: 0.007, phase: 3.5, size: 5, hue: 255 },
];

const NODE_CONNECTION_THRESHOLD = 22;

// Waveform config
const WAVEFORM_LINES = 3;

/* ─── Helpers ─── */

function getNodePosition(node: NodeConfig, frame: number) {
    const x = node.cx + Math.cos(frame * node.speed + node.phase) * node.radiusX;
    const y = node.cy + Math.sin(frame * node.speed * 0.7 + node.phase) * node.radiusY;
    return { x, y };
}

function getDistance(x1: number, y1: number, x2: number, y2: number) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/* ─── Sub-components ─── */

/** Pulsing center focal point — the AI "brain" processing voice */
function CenterFocalPoint({ frame, isDark }: { frame: number; isDark: boolean }) {
    const breathe = Math.sin(frame * 0.025) * 0.5 + 0.5;
    const innerSize = 12 + breathe * 6;
    const outerSize = 30 + breathe * 20;
    const ringSize = 50 + breathe * 30;

    const innerOpacity = isDark ? 0.5 : 0.6;
    const outerOpacity = (isDark ? 0.15 : 0.25) * (0.6 + breathe * 0.4);
    const ringOpacity = (isDark ? 0.08 : 0.12) * (0.4 + breathe * 0.6);

    const hue = interpolate(Math.sin(frame * 0.01), [-1, 1], [245, 262]);

    return (
        <>
            {/* Outer breathing ring */}
            <div
                style={{
                    position: 'absolute',
                    left: `${CENTER_FOCAL.cx}%`,
                    top: `${CENTER_FOCAL.cy}%`,
                    width: ringSize,
                    height: ringSize,
                    borderRadius: '50%',
                    border: `1px solid hsl(${hue}, 70%, ${isDark ? '65%' : '72%'})`,
                    opacity: ringOpacity,
                    transform: 'translate(-50%, -50%)',
                }}
            />
            {/* Mid glow */}
            <div
                style={{
                    position: 'absolute',
                    left: `${CENTER_FOCAL.cx}%`,
                    top: `${CENTER_FOCAL.cy}%`,
                    width: outerSize,
                    height: outerSize,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, hsl(${hue}, 80%, ${isDark ? '60%' : '75%'}) 0%, transparent 70%)`,
                    opacity: outerOpacity,
                    transform: 'translate(-50%, -50%)',
                    filter: `blur(${isDark ? 8 : 6}px)`,
                }}
            />
            {/* Inner bright core */}
            <div
                style={{
                    position: 'absolute',
                    left: `${CENTER_FOCAL.cx}%`,
                    top: `${CENTER_FOCAL.cy}%`,
                    width: innerSize,
                    height: innerSize,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, hsl(${hue}, 85%, ${isDark ? '70%' : '80%'}) 0%, hsl(${hue}, 80%, ${isDark ? '55%' : '70%'}) 60%, transparent 100%)`,
                    opacity: innerOpacity,
                    transform: 'translate(-50%, -50%)',
                    boxShadow: `0 0 ${innerSize}px hsl(${hue}, 80%, ${isDark ? '60%' : '75%'})`,
                }}
            />
        </>
    );
}

/** Concentric speech arcs emanating from a voice source */
function SpeechArc({
    source, frame, arcIndex, isDark,
}: {
    source: VoiceSourceConfig; frame: number; arcIndex: number; isDark: boolean;
}) {
    const arcFrame = source.arcPhase + arcIndex * source.arcInterval;
    const elapsed = frame - arcFrame;
    const arcDuration = 120;

    if (elapsed < 0 || elapsed >= arcDuration) return null;

    const progress = elapsed / arcDuration;

    // Arc expands outward from the source
    const radius = interpolate(progress, [0, 1], [20, 280], { extrapolateRight: 'clamp' });
    const opacity = interpolate(progress, [0, 0.15, 0.7, 1], [0, isDark ? 0.2 : 0.35, isDark ? 0.08 : 0.15, 0], { extrapolateRight: 'clamp' });

    if (opacity < 0.005) return null;

    // Stroke width thicker when freshly emitted, thinner as it expands
    const strokeWidth = interpolate(progress, [0, 0.3, 1], [isDark ? 2.5 : 3, isDark ? 1.5 : 2, isDark ? 0.5 : 0.8], { extrapolateRight: 'clamp' });

    // SVG arc — semicircle facing the direction
    const startAngle = source.direction === 1 ? -60 : 120;
    const endAngle = source.direction === 1 ? 60 : 240;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = radius * Math.cos(startRad);
    const y1 = radius * Math.sin(startRad);
    const x2 = radius * Math.cos(endRad);
    const y2 = radius * Math.sin(endRad);

    const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

    return (
        <svg
            style={{
                position: 'absolute',
                left: `${source.cx}%`,
                top: `${source.cy}%`,
                transform: 'translate(-50%, -50%)',
                overflow: 'visible',
                width: 1,
                height: 1,
            }}
        >
            <path
                d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
                fill="none"
                stroke={`hsl(${source.hue}, ${isDark ? '80%' : '75%'}, ${isDark ? '60%' : '68%'})`}
                strokeWidth={strokeWidth}
                opacity={opacity}
                strokeLinecap="round"
            />
        </svg>
    );
}

/** Ambient glow behind each voice source */
function VoiceGlow({
    source, frame, isDark,
}: {
    source: VoiceSourceConfig; frame: number; isDark: boolean;
}) {
    const pulse = 0.7 + Math.sin(frame * 0.02 + source.id * 2) * 0.3;
    const baseOpacity = isDark ? 0.25 : 0.5;
    const opacity = baseOpacity * pulse;
    const size = isDark ? 200 : 350;
    const blurAmount = isDark ? 60 : 50;

    return (
        <div
            style={{
                position: 'absolute',
                left: `${source.cx}%`,
                top: `${source.cy}%`,
                width: size,
                height: size,
                borderRadius: '50%',
                background: `radial-gradient(circle, hsl(${source.hue}, 85%, ${isDark ? '58%' : '78%'}) 0%, transparent 70%)`,
                opacity,
                transform: 'translate(-50%, -50%)',
                filter: `blur(${blurAmount}px)`,
                willChange: 'opacity',
            }}
        />
    );
}

/** Traveling data particle along a connection path */
function DataParticle({
    x1, y1, x2, y2, frame, particleIndex, isDark,
}: {
    x1: number; y1: number; x2: number; y2: number;
    frame: number; particleIndex: number; isDark: boolean;
}) {
    const cycleDuration = 90; // Frames per full travel
    const phaseOffset = particleIndex * 35;
    const progress = ((frame + phaseOffset) % cycleDuration) / cycleDuration;

    // Particle position along the line
    const px = x1 + (x2 - x1) * progress;
    const py = y1 + (y2 - y1) * progress;

    // Fade in at start, fade out at end
    const opacity = interpolate(progress, [0, 0.1, 0.9, 1], [0, isDark ? 0.5 : 0.6, isDark ? 0.5 : 0.6, 0], { extrapolateRight: 'clamp' });

    if (opacity < 0.01) return null;

    const size = isDark ? 3 : 3.5;

    return (
        <div
            style={{
                position: 'absolute',
                left: `${px}%`,
                top: `${py}%`,
                width: size,
                height: size,
                borderRadius: '50%',
                background: `hsl(252, ${isDark ? '80%' : '75%'}, ${isDark ? '70%' : '78%'})`,
                opacity,
                transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 ${size * 2}px hsl(252, 80%, ${isDark ? '65%' : '75%'})`,
            }}
        />
    );
}

/** Small floating node representing an AI network point */
function NetworkNode({
    node, frame, isDark,
}: {
    node: NodeConfig; frame: number; isDark: boolean;
}) {
    const { x, y } = getNodePosition(node, frame);
    const pulse = 0.6 + Math.sin(frame * 0.03 + node.phase) * 0.4;
    const opacity = (isDark ? 0.4 : 0.5) * pulse;

    return (
        <div
            style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: node.size,
                height: node.size,
                borderRadius: '50%',
                background: `hsl(${node.hue}, ${isDark ? '80%' : '75%'}, ${isDark ? '65%' : '72%'})`,
                opacity,
                transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 ${node.size * 2}px hsl(${node.hue}, 80%, ${isDark ? '60%' : '75%'})`,
                willChange: 'transform, opacity',
            }}
        />
    );
}

/** Connection line between two network nodes */
function NodeConnection({
    x1, y1, x2, y2, distance, frame, isDark,
}: {
    x1: number; y1: number; x2: number; y2: number;
    distance: number; frame: number; isDark: boolean;
}) {
    const maxOpacity = isDark ? 0.15 : 0.2;
    const distanceFactor = 1 - distance / NODE_CONNECTION_THRESHOLD;
    const pulse = 0.5 + Math.sin(frame * 0.02 + x1 * 0.1) * 0.5;
    const opacity = maxOpacity * distanceFactor * pulse;

    if (opacity < 0.008) return null;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    return (
        <div
            style={{
                position: 'absolute',
                left: `${x1}%`,
                top: `${y1}%`,
                width: `${length}%`,
                height: 1,
                background: isDark
                    ? 'linear-gradient(90deg, hsl(262, 70%, 60%), hsl(221, 70%, 55%))'
                    : 'linear-gradient(90deg, hsl(262, 70%, 72%), hsl(221, 70%, 68%))',
                opacity,
                transform: `rotate(${angle}deg)`,
                transformOrigin: '0 50%',
                willChange: 'opacity',
            }}
        />
    );
}

/** Undulating audio waveform line across the composition */
function WaveformLine({
    lineIndex, frame, isDark,
}: {
    lineIndex: number; frame: number; isDark: boolean;
}) {
    const points = 80;
    const baseY = 50 + (lineIndex - 1) * 12; // Spread lines vertically
    const timeOffset = frame * 0.04 + lineIndex * 1.5;

    let pathD = '';
    for (let i = 0; i <= points; i++) {
        const t = i / points;
        const x = t * 100;

        // Multi-frequency sine wave — like a voice waveform
        const amp1 = 3 * Math.sin(t * 6 + timeOffset);
        const amp2 = 1.5 * Math.sin(t * 14 + timeOffset * 1.3);
        const amp3 = 0.8 * Math.sin(t * 22 + timeOffset * 0.7);

        // Fade amplitude at edges
        const edgeFade = Math.sin(t * Math.PI);
        const y = baseY + (amp1 + amp2 + amp3) * edgeFade;

        pathD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }

    const opacity = interpolate(
        Math.sin(frame * 0.015 + lineIndex * 2),
        [-1, 1],
        [isDark ? 0.06 : 0.1, isDark ? 0.15 : 0.22],
    );

    const hue = 240 + lineIndex * 15;

    return (
        <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
            }}
        >
            <path
                d={pathD}
                fill="none"
                stroke={`hsl(${hue}, ${isDark ? '70%' : '75%'}, ${isDark ? '60%' : '68%'})`}
                strokeWidth={0.15}
                opacity={opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/* ─── Main Composition ─── */

export interface HeroCompositionProps {
    isDark: boolean;
}

export const HeroComposition: React.FC<HeroCompositionProps> = ({ isDark }) => {
    const frame = useCurrentFrame();

    // Calculate node positions for connections
    const positions = NODES.map((node) => ({
        node,
        ...getNodePosition(node, frame),
    }));

    // Generate connections between nearby nodes
    const connections: { x1: number; y1: number; x2: number; y2: number; distance: number; key: string }[] = [];
    for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
            const dist = getDistance(positions[i].x, positions[i].y, positions[j].x, positions[j].y);
            if (dist < NODE_CONNECTION_THRESHOLD) {
                connections.push({
                    x1: positions[i].x,
                    y1: positions[i].y,
                    x2: positions[j].x,
                    y2: positions[j].y,
                    distance: dist,
                    key: `${i}-${j}`,
                });
            }
        }
    }

    // Max arcs per source across the duration
    const maxArcs = 16;

    return (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
            {/* Layer 1: Voice source glows */}
            {VOICE_SOURCES.map((source) => (
                <VoiceGlow key={`glow-${source.id}`} source={source} frame={frame} isDark={isDark} />
            ))}

            {/* Layer 2: Audio waveform lines */}
            {Array.from({ length: WAVEFORM_LINES }, (_, i) => (
                <WaveformLine key={`wave-${i}`} lineIndex={i} frame={frame} isDark={isDark} />
            ))}

            {/* Layer 3: Network connections + traveling particles */}
            {connections.map((conn) => (
                <NodeConnection
                    key={conn.key}
                    x1={conn.x1}
                    y1={conn.y1}
                    x2={conn.x2}
                    y2={conn.y2}
                    distance={conn.distance}
                    frame={frame}
                    isDark={isDark}
                />
            ))}
            {connections.map((conn) =>
                [0, 1].map((pi) => (
                    <DataParticle
                        key={`particle-${conn.key}-${pi}`}
                        x1={conn.x1}
                        y1={conn.y1}
                        x2={conn.x2}
                        y2={conn.y2}
                        frame={frame}
                        particleIndex={pi}
                        isDark={isDark}
                    />
                ))
            )}

            {/* Layer 4: Speech arcs from voice sources */}
            {VOICE_SOURCES.map((source) =>
                Array.from({ length: maxArcs }, (_, i) => (
                    <SpeechArc
                        key={`arc-${source.id}-${i}`}
                        source={source}
                        frame={frame}
                        arcIndex={i}
                        isDark={isDark}
                    />
                ))
            )}

            {/* Layer 5: Center focal point — AI processing hub */}
            <CenterFocalPoint frame={frame} isDark={isDark} />

            {/* Layer 7: AI network nodes */}
            {NODES.map((node) => (
                <NetworkNode key={`node-${node.id}`} node={node} frame={frame} isDark={isDark} />
            ))}
        </AbsoluteFill>
    );
};
