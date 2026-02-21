'use client';

import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface CallPlayerProps {
    audioUrl?: string;
    transcript?: string;
    summary?: string;
}

export function CallPlayer({ audioUrl, transcript, summary }: CallPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.play().then(
                    () => setIsPlaying(true),
                    () => { /* playback blocked or unavailable */ }
                );
            }
        }
    };

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const progress =
                (audioRef.current.currentTime / audioRef.current.duration) * 100;
            setProgress(progress);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (audioRef.current) {
            const time = (parseFloat(e.target.value) / 100) * audioRef.current.duration;
            audioRef.current.currentTime = time;
            setProgress(parseFloat(e.target.value));
        }
    };

    return (
        <div className="space-y-4">
            {/* Audio Player */}
            {audioUrl && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Call Recording</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <audio
                            ref={audioRef}
                            src={audioUrl}
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={() => setIsPlaying(false)}
                        />
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={togglePlay}>
                                {isPlaying ? (
                                    <Pause className="h-4 w-4" />
                                ) : (
                                    <Play className="h-4 w-4" />
                                )}
                            </Button>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={progress}
                                onChange={handleSeek}
                                aria-label="Call playback progress"
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                            />
                            <Button variant="ghost" size="icon" onClick={toggleMute}>
                                {isMuted ? (
                                    <VolumeX className="h-4 w-4" />
                                ) : (
                                    <Volume2 className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary */}
            {summary && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Call Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground whitespace-pre-wrap">{summary}</p>
                    </CardContent>
                </Card>
            )}

            {/* Transcript */}
            {transcript && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Transcript</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-96 overflow-y-auto">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                                {transcript}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
