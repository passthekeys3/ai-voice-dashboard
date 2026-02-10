'use client';

import { useEffect, useRef, useState } from 'react';
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
    const [internalValue, setInternalValue] = useState(controlledValue ?? '');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync internal value when controlled value changes externally
    useEffect(() => {
        if (controlledValue !== undefined) {
            setInternalValue(controlledValue);
        }
    }, [controlledValue]);

    const handleChange = (newValue: string) => {
        setInternalValue(newValue);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            onChange(newValue);
        }, debounceMs);
    };

    const handleClear = () => {
        setInternalValue('');
        onChange('');
    };

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
                value={internalValue}
                onChange={(e) => handleChange(e.target.value)}
                className="pl-9 pr-8"
            />
            {internalValue && (
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
