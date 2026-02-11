'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Check, Search, ChevronDown, ChevronUp, Volume2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { Voice } from '@/lib/agent-builder/types';

interface AgentBuilderVoicePickerProps {
    selectedVoiceId: string;
    selectedVoiceName: string;
    provider: string;
    onVoiceSelect: (voiceId: string, voiceName: string) => void;
}

const GENDER_FILTERS = ['all', 'male', 'female'] as const;
type GenderFilter = (typeof GENDER_FILTERS)[number];

export function AgentBuilderVoicePicker({
    selectedVoiceId,
    selectedVoiceName,
    provider,
    onVoiceSelect,
}: AgentBuilderVoicePickerProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [voices, setVoices] = useState<Voice[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Fetch voices when expanded or provider changes
    useEffect(() => {
        if (!isExpanded) return;

        let cancelled = false;
        setLoading(true);
        setFetchError(null);

        const fetchVoices = async () => {
            try {
                const response = await fetch(`/api/voices?provider=${provider}`);
                if (!response.ok) {
                    if (!cancelled) setFetchError('Failed to load voices. Check your API key in Settings.');
                    return;
                }
                const { data } = await response.json();
                if (!cancelled && data) {
                    setVoices(data);
                }
            } catch (err) {
                console.error('Failed to fetch voices:', err);
                if (!cancelled) setFetchError('Failed to load voices. Please try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchVoices();
        return () => { cancelled = true; };
    }, [isExpanded, provider]);

    // Reset search/filter when provider changes
    useEffect(() => {
        setSearchQuery('');
        setGenderFilter('all');
    }, [provider]);

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

    const handlePlayPreview = useCallback((e: React.MouseEvent, voice: Voice) => {
        e.stopPropagation();
        if (!voice.preview_url) return;

        // Stop existing audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.removeAttribute('src');
            audioRef.current = null;
        }

        if (playingVoiceId === voice.id) {
            setPlayingVoiceId(null);
            return;
        }

        const audio = new Audio(voice.preview_url);
        audioRef.current = audio;
        audio.play().catch(() => setPlayingVoiceId(null));
        setPlayingVoiceId(voice.id);

        audio.onended = () => {
            setPlayingVoiceId(null);
            audioRef.current = null;
        };
        audio.onerror = () => {
            setPlayingVoiceId(null);
            audioRef.current = null;
        };
    }, [playingVoiceId]);

    const filteredVoices = useMemo(() => {
        return voices.filter(voice => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesName = voice.name.toLowerCase().includes(query);
                const matchesAccent = voice.accent?.toLowerCase().includes(query);
                const matchesGender = voice.gender?.toLowerCase().includes(query);
                if (!matchesName && !matchesAccent && !matchesGender) return false;
            }

            // Gender filter
            if (genderFilter !== 'all' && voice.gender) {
                if (!voice.gender.toLowerCase().includes(genderFilter)) return false;
            }

            return true;
        });
    }, [voices, searchQuery, genderFilter]);

    // Selected voice display (collapsed state)
    if (!isExpanded) {
        return (
            <div>
                {selectedVoiceName ? (
                    <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                            <Volume2 className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{selectedVoiceName}</span>
                        </div>
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium flex-shrink-0"
                        >
                            Change
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="w-full text-left text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium py-2 px-3 rounded-lg border border-dashed border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                    >
                        Browse & select a voice...
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                    {voices.length > 0 ? `${filteredVoices.length} of ${voices.length} voices` : 'Loading...'}
                </span>
                <button
                    onClick={() => {
                        setIsExpanded(false);
                        // Stop audio when collapsing
                        if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current.removeAttribute('src');
                            audioRef.current = null;
                            setPlayingVoiceId(null);
                        }
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    <ChevronUp className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search voices..."
                        className="pl-7 h-8 text-xs"
                    />
                </div>
                <div className="flex rounded-md border border-input overflow-hidden">
                    {GENDER_FILTERS.map(g => (
                        <button
                            key={g}
                            onClick={() => setGenderFilter(g)}
                            className={`px-2 py-1 text-[10px] font-medium capitalize transition-colors ${
                                genderFilter === g
                                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                                    : 'bg-background text-muted-foreground hover:bg-muted'
                            }`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
            </div>

            {/* Voice List */}
            <div className="max-h-[240px] overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-xs text-muted-foreground">Loading voices...</span>
                    </div>
                ) : fetchError ? (
                    <div className="text-center py-6 px-3 text-xs text-red-500">
                        {fetchError}
                    </div>
                ) : filteredVoices.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                        {searchQuery ? 'No voices match your search' : 'No voices available'}
                    </div>
                ) : (
                    filteredVoices.map(voice => {
                        const isSelected = voice.id === selectedVoiceId;
                        const isPlaying = playingVoiceId === voice.id;

                        return (
                            <div
                                key={voice.id}
                                onClick={() => onVoiceSelect(voice.id, voice.name)}
                                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                                    isSelected
                                        ? 'bg-violet-50 dark:bg-violet-900/20'
                                        : 'hover:bg-muted/50'
                                }`}
                            >
                                {/* Selection indicator */}
                                <div
                                    className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                                        isSelected
                                            ? 'bg-violet-500 text-white'
                                            : 'border border-muted-foreground/30'
                                    }`}
                                >
                                    {isSelected && <Check className="h-2.5 w-2.5" />}
                                </div>

                                {/* Voice info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium truncate">{voice.name}</span>
                                        {voice.gender && (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight">
                                                {voice.gender}
                                            </Badge>
                                        )}
                                        {voice.accent && (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight">
                                                {voice.accent}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Preview button */}
                                {voice.preview_url && (
                                    <button
                                        onClick={(e) => handlePlayPreview(e, voice)}
                                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                            isPlaying
                                                ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300'
                                                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                        }`}
                                        aria-label={isPlaying ? `Stop preview for ${voice.name}` : `Play preview for ${voice.name}`}
                                    >
                                        {isPlaying ? (
                                            <Pause className="h-2.5 w-2.5" />
                                        ) : (
                                            <Play className="h-2.5 w-2.5 ml-px" />
                                        )}
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
