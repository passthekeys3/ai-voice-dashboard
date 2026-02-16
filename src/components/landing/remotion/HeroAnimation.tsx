'use client';

import { useRef, useEffect, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { HeroComposition } from './HeroComposition';

const COMPOSITION_WIDTH = 1920;
const COMPOSITION_HEIGHT = 1080;
const FPS = 30;
const DURATION_IN_FRAMES = 900; // 30 seconds at 30fps

interface HeroAnimationProps {
    isInView: boolean;
}

export function HeroAnimation({ isInView }: HeroAnimationProps) {
    const playerRef = useRef<PlayerRef>(null);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [isDark, setIsDark] = useState(false);

    // Check reduced motion preference
    useEffect(() => {
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mql.matches);
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

    // Detect dark mode
    useEffect(() => {
        const checkDark = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };
        checkDark();

        const observer = new MutationObserver(checkDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Play/pause based on visibility
    useEffect(() => {
        if (!playerRef.current) return;
        if (isInView) {
            playerRef.current.play();
        } else {
            playerRef.current.pause();
        }
    }, [isInView]);

    // Don't render if reduced motion
    if (prefersReducedMotion) {
        return null;
    }

    return (
        <div className="w-full h-full remotion-hero-player">
            <Player
                ref={playerRef}
                component={HeroComposition}
                inputProps={{ isDark }}
                durationInFrames={DURATION_IN_FRAMES}
                fps={FPS}
                compositionWidth={COMPOSITION_WIDTH}
                compositionHeight={COMPOSITION_HEIGHT}
                style={{ width: '100%', height: '100%' }}
                loop
                autoPlay
                controls={false}
                clickToPlay={false}
                acknowledgeRemotionLicense
            />
        </div>
    );
}
