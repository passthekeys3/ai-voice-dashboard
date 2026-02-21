'use client';

import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { TranscriptMessage } from '@/types';

interface TestTranscriptProps {
    transcript: TranscriptMessage[];
}

export function TestTranscript({ transcript }: TestTranscriptProps) {
    const [copied, setCopied] = useState(false);

    // Auto-reset copied state with cleanup
    useEffect(() => {
        if (!copied) return;
        const id = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(id);
    }, [copied]);

    const handleCopy = () => {
        const text = transcript
            .map((m) => `[Turn ${m.turn}] ${m.role === 'agent' ? 'Agent' : 'Caller'}: ${m.content}`)
            .join('\n\n');
        navigator.clipboard.writeText(text).then(
            () => setCopied(true),
            () => { /* clipboard unavailable — silently fail */ }
        );
    };

    if (!transcript || transcript.length === 0) {
        return (
            <div className="text-center py-8 text-sm text-muted-foreground">
                No transcript available
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleCopy} aria-label="Copy transcript to clipboard">
                    {copied ? (
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                    ) : (
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-auto">
                {transcript.map((message, index) => (
                    <div
                        key={index}
                        className={`flex gap-3 ${
                            message.role === 'agent' ? '' : 'flex-row-reverse'
                        }`}
                    >
                        <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                                message.role === 'agent'
                                    ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                                    : 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span
                                    className={`text-xs font-medium ${
                                        message.role === 'agent'
                                            ? 'text-blue-700 dark:text-blue-300'
                                            : 'text-green-700 dark:text-green-300'
                                    }`}
                                >
                                    {message.role === 'agent' ? 'Agent' : 'Caller'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Turn {message.turn}
                                </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
