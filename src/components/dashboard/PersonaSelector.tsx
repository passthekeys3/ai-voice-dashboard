'use client';

import { useEffect, useState } from 'react';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { TestPersona } from '@/types';

interface PersonaSelectorProps {
    value: string | null;
    onChange: (personaId: string | null) => void;
    personas?: TestPersona[];
}

const TEMPERAMENT_EMOJI: Record<string, string> = {
    angry: '\uD83D\uDE20',
    friendly: '\uD83D\uDE0A',
    confused: '\uD83D\uDE15',
    impatient: '\u23F1\uFE0F',
    skeptical: '\uD83E\uDD28',
    neutral: '\uD83D\uDE10',
};

export function PersonaSelector({ value, onChange, personas: externalPersonas }: PersonaSelectorProps) {
    const [personas, setPersonas] = useState<TestPersona[]>(externalPersonas || []);
    const [loading, setLoading] = useState(!externalPersonas);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (externalPersonas) {
            setPersonas(externalPersonas);
            setError(null);
            return;
        }

        async function fetchPersonas() {
            try {
                setError(null);
                const res = await fetch('/api/test-personas');
                if (!res.ok) {
                    throw new Error('Failed to load personas');
                }
                const data = await res.json();
                if (data.data) setPersonas(data.data);
            } catch (err) {
                console.error('Failed to load personas:', err);
                setError('Could not load personas');
            } finally {
                setLoading(false);
            }
        }
        fetchPersonas();
    }, [externalPersonas]);

    const presets = personas.filter((p) => p.is_preset);
    const custom = personas.filter((p) => !p.is_preset);

    if (error) {
        return (
            <Select disabled>
                <SelectTrigger className="w-full border-red-300 dark:border-red-700">
                    <SelectValue placeholder={error} />
                </SelectTrigger>
                <SelectContent />
            </Select>
        );
    }

    return (
        <Select
            value={value || 'none'}
            onValueChange={(v: string) => onChange(v === 'none' ? null : v)}
            disabled={loading}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder={loading ? 'Loading...' : 'Select persona'} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="none">No persona (default caller)</SelectItem>

                {presets.length > 0 && (
                    <SelectGroup>
                        <SelectLabel>Presets</SelectLabel>
                        {presets.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                                {TEMPERAMENT_EMOJI[p.traits.temperament] || ''} {p.name}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                )}

                {custom.length > 0 && (
                    <SelectGroup>
                        <SelectLabel>Custom</SelectLabel>
                        {custom.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                                {TEMPERAMENT_EMOJI[p.traits.temperament] || ''} {p.name}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                )}
            </SelectContent>
        </Select>
    );
}
