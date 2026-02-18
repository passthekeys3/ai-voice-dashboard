'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchInputProps {
    placeholder?: string;
    value?: string;
    onChange: (value: string) => void;
    className?: string;
    debounceMs?: number;
}

export function SearchInput({
    placeholder = 'Search...',
    value: controlledValue,
    onChange,
    className,
    debounceMs = 300,
}: SearchInputProps) {
    // Track local typing state separately from the controlled value
    const [typingValue, setTypingValue] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // The displayed value: use local typing value while typing, otherwise controlled value
    const displayValue = typingValue ?? controlledValue ?? '';

    const handleChange = useCallback((newValue: string) => {
        setTypingValue(newValue);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setTypingValue(null); // Hand control back to parent
            onChange(newValue);
        }, debounceMs);
    }, [onChange, debounceMs]);

    const handleClear = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setTypingValue(null);
        onChange('');
    }, [onChange]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <div className={cn('relative', className)}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                type="text"
                placeholder={placeholder}
                value={displayValue}
                onChange={(e) => handleChange(e.target.value)}
                className="pl-9 pr-8"
            />
            {displayValue && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
