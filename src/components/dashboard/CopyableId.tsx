'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyableIdProps {
    label: string;
    value: string;
}

export function CopyableId({ label, value }: CopyableIdProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback: select text
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors group"
            title={`Copy ${label}`}
        >
            <span>{label}:</span>
            <span className="font-mono select-all">{value}</span>
            {copied ? (
                <Check className="h-3 w-3 text-green-500" />
            ) : (
                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
        </button>
    );
}
