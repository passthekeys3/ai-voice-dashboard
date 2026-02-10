'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { VoiceRecommendation } from '@/lib/agent-builder/types';

interface AgentBuilderVoiceCardProps {
    voice: VoiceRecommendation;
    isSelected: boolean;
    onSelect: () => void;
}

export function AgentBuilderVoiceCard({ voice, isSelected, onSelect }: AgentBuilderVoiceCardProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.removeAttribute('src');
                audioRef.current = null;
            }
        };
    }, []);

    const handlePlayPreview = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        if (!voice.preview_url) return;

        // Always stop existing audio first
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.removeAttribute('src');
            audioRef.current = null;
        }

        if (isPlaying) {
            setIsPlaying(false);
            return;
        }

        const audio = new Audio(voice.preview_url);
        audioRef.current = audio;
        audio.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);

        audio.onended = () => {
            setIsPlaying(false);
            audioRef.current = null;
        };
        audio.onerror = () => {
            setIsPlaying(false);
            audioRef.current = null;
        };
    }, [voice.preview_url, isPlaying]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
        }
    }, [onSelect]);

    return (
        <div
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={handleKeyDown}
            className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                isSelected
                    ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/20'
                    : 'border-border hover:border-violet-500/30 hover:bg-violet-500/5'
            }`}
        >
            {/* Selection indicator */}
            <div
                className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    isSelected
                        ? 'bg-violet-500 text-white'
                        : 'border-2 border-muted-foreground/30'
                }`}
            >
                {isSelected && <Check className="h-3 w-3" />}
            </div>

            {/* Voice info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{voice.name}</span>
                    {voice.gender && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {voice.gender}
                        </Badge>
                    )}
                    {voice.accent && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {voice.accent}
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {voice.reasoning}
                </p>
            </div>

            {/* Preview button */}
            {voice.preview_url && (
                <button
                    onClick={handlePlayPreview}
                    className="flex-shrink-0 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                    aria-label={isPlaying ? `Stop preview for ${voice.name}` : `Play preview for ${voice.name}`}
                >
                    {isPlaying ? (
                        <Pause className="h-3.5 w-3.5" />
                    ) : (
                        <Play className="h-3.5 w-3.5 ml-0.5" />
                    )}
                </button>
            )}
        </div>
    );
}
