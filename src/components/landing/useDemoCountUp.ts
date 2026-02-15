'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook that animates a number from 0 → target using requestAnimationFrame.
 * Uses an ease-out cubic curve for natural deceleration.
 *
 * @param target - The final number value to animate to
 * @param isActive - Whether the animation should start (typically from useInView)
 * @param options.duration - Animation duration in ms (default 1500)
 * @param options.delay - Delay before animation starts in ms (default 0)
 * @returns The current animated number value
 */
export function useDemoCountUp(
    target: number,
    isActive: boolean,
    options?: { duration?: number; delay?: number }
): number {
    const { duration = 1500, delay = 0 } = options ?? {};
    const [value, setValue] = useState(0);
    const rafRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const hasStartedRef = useRef(false);

    useEffect(() => {
        if (!isActive || hasStartedRef.current) return;
        hasStartedRef.current = true;

        const timeoutId = setTimeout(() => {
            const animate = (timestamp: number) => {
                if (startTimeRef.current === null) {
                    startTimeRef.current = timestamp;
                }

                const elapsed = timestamp - startTimeRef.current;
                const progress = Math.min(elapsed / duration, 1);

                // Ease-out cubic: 1 - (1 - t)^3
                const eased = 1 - Math.pow(1 - progress, 3);
                setValue(eased * target);

                if (progress < 1) {
                    rafRef.current = requestAnimationFrame(animate);
                } else {
                    setValue(target);
                }
            };

            rafRef.current = requestAnimationFrame(animate);
        }, delay);

        return () => {
            clearTimeout(timeoutId);
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [isActive, target, duration, delay]);

    // If reduced motion is preferred, show final value immediately
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mq.matches && isActive) {
            setValue(target);
        }
    }, [isActive, target]);

    return value;
}
