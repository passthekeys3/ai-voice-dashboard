'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AgencyBranding } from '@/types';
import { DEFAULT_AGENCY_BRANDING } from '@/types/database';

interface ThemeContextValue {
    branding: AgencyBranding;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
    };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

// Convert hex color to HSL for CSS variable usage
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    // Parse hex values
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
        return { h: 0, s: 0, l: Math.round(l * 100) };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h = 0;
    switch (max) {
        case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            break;
        case g:
            h = ((b - r) / d + 2) / 6;
            break;
        case b:
            h = ((r - g) / d + 4) / 6;
            break;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

// Validate hex color to prevent CSS injection
function isValidHexColor(c: string): boolean {
    return /^#[0-9A-Fa-f]{3,8}$/.test(c);
}

// Generate CSS variables from branding colors
function generateCSSVariables(branding: AgencyBranding): string {
    const primary = isValidHexColor(branding.primary_color || '') ? branding.primary_color! : DEFAULT_AGENCY_BRANDING.primary_color;
    const secondary = isValidHexColor(branding.secondary_color || '') ? branding.secondary_color! : DEFAULT_AGENCY_BRANDING.secondary_color;
    const accent = isValidHexColor(branding.accent_color || '') ? branding.accent_color! : DEFAULT_AGENCY_BRANDING.accent_color;

    const primaryHSL = hexToHSL(primary);
    const accentHSL = hexToHSL(accent);

    if (!primaryHSL || !accentHSL) {
        return '';
    }

    // Generate CSS custom properties
    return `
        :root {
            --brand-primary: ${primary};
            --brand-secondary: ${secondary};
            --brand-accent: ${accent};
            --brand-primary-hsl: ${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%;
            --brand-accent-hsl: ${accentHSL.h} ${accentHSL.s}% ${accentHSL.l}%;
        }
    `;
}

interface ThemeProviderProps {
    children: ReactNode;
    branding?: AgencyBranding;
}

export function ThemeProvider({ children, branding }: ThemeProviderProps) {
    const value = useMemo<ThemeContextValue>(() => ({
        branding: branding || {},
        colors: {
            primary: branding?.primary_color || DEFAULT_AGENCY_BRANDING.primary_color,
            secondary: branding?.secondary_color || DEFAULT_AGENCY_BRANDING.secondary_color,
            accent: branding?.accent_color || DEFAULT_AGENCY_BRANDING.accent_color,
        },
    }), [branding]);

    const cssVariables = useMemo(() => {
        if (!branding) return '';
        return generateCSSVariables(branding);
    }, [branding]);

    return (
        <ThemeContext.Provider value={value}>
            {cssVariables && (
                <style dangerouslySetInnerHTML={{ __html: cssVariables }} />
            )}
            {children}
        </ThemeContext.Provider>
    );
}

// Optional hook to get just the branding
export function useBranding(): AgencyBranding {
    const { branding } = useTheme();
    return branding;
}

// Optional hook to get color values
export function useBrandColors() {
    const { colors } = useTheme();
    return colors;
}
