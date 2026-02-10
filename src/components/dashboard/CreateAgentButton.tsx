'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, Bot, Volume2, Play, Pause } from 'lucide-react';

interface Voice {
    id: string;
    name: string;
    provider: string;
    gender?: string;
    accent?: string;
    age?: string;
    preview_url?: string;
}

interface PhoneNumber {
    id: string;
    phone_number: string;
    agent_id?: string;
}

interface CreateAgentButtonProps {
    clients: { id: string; name: string }[];
    phoneNumbers: PhoneNumber[];
}

export function CreateAgentButton({ clients, phoneNumbers }: CreateAgentButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Voice list
    const [voices, setVoices] = useState<Voice[]>([]);
    const [loadingVoices, setLoadingVoices] = useState(false);
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [voiceId, setVoiceId] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [firstMessage, setFirstMessage] = useState('');
    const [clientId, setClientId] = useState('');
    const [phoneNumberId, setPhoneNumberId] = useState('');

    // Fetch voices when dialog opens
    useEffect(() => {
        if (open && voices.length === 0) {
            fetchVoices();
        }
    }, [open, voices.length]);

    const fetchVoices = async () => {
        setLoadingVoices(true);
        try {
            const response = await fetch('/api/voices');
            const data = await response.json();
            if (data.data) {
                setVoices(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch voices:', err);
        } finally {
            setLoadingVoices(false);
        }
    };

    const playVoicePreview = (voice: Voice) => {
        if (!voice.preview_url) return;

        if (playingVoice === voice.id) {
            audio?.pause();
            setPlayingVoice(null);
            return;
        }

        audio?.pause();
        const newAudio = new Audio(voice.preview_url);
        newAudio.onended = () => setPlayingVoice(null);
        newAudio.play();
        setAudio(newAudio);
        setPlayingVoice(voice.id);
    };

    const resetForm = () => {
        setName('');
        setVoiceId('');
        setSystemPrompt('');
        setFirstMessage('');
        setClientId('');
        setPhoneNumberId('');
        setError(null);
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            setError('Please enter an agent name');
            return;
        }
        if (!voiceId) {
            setError('Please select a voice');
            return;
        }

        setCreating(true);
        setError(null);

        try {
            const response = await fetch('/api/agents/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    voice_id: voiceId,
                    system_prompt: systemPrompt || undefined,
                    first_message: firstMessage || undefined,
                    client_id: clientId || undefined,
                    phone_number_id: phoneNumberId || undefined,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create agent');
            }

            setOpen(false);
            resetForm();
            router.refresh();

            // Navigate to the new agent
            if (data.data?.id) {
                router.push(`/agents/${data.data.id}`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setCreating(false);
        }
    };

    // Filter to show only unassigned phone numbers
    const availablePhoneNumbers = phoneNumbers.filter(pn => !pn.agent_id);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) {
                audio?.pause();
                setPlayingVoice(null);
            }
        }}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Agent
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        Create AI Agent
                    </DialogTitle>
                    <DialogDescription>
                        Create a new voice AI agent with custom voice and prompt.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Agent Name */}
                    <div className="space-y-2">
                        <Label htmlFor="agent-name">Agent Name *</Label>
                        <Input
                            id="agent-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Sarah - Sales Assistant"
                        />
                    </div>

                    {/* Voice Selection */}
                    <div className="space-y-2">
                        <Label>Voice *</Label>
                        {loadingVoices ? (
                            <div className="flex items-center gap-2 p-3 border rounded-md">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm text-muted-foreground">Loading voices...</span>
                            </div>
                        ) : (
                            <Select value={voiceId} onValueChange={setVoiceId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a voice" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {voices.map((voice) => (
                                        <SelectItem key={voice.id} value={voice.id}>
                                            <div className="flex items-center gap-2">
                                                <Volume2 className="h-3 w-3" />
                                                <span>{voice.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    ({voice.provider})
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {/* Voice Preview */}
                        {voiceId && (
                            <div className="flex items-center gap-2">
                                {(() => {
                                    const selectedVoice = voices.find(v => v.id === voiceId);
                                    if (selectedVoice?.preview_url) {
                                        return (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => playVoicePreview(selectedVoice)}
                                            >
                                                {playingVoice === voiceId ? (
                                                    <><Pause className="h-3 w-3 mr-1" /> Stop</>
                                                ) : (
                                                    <><Play className="h-3 w-3 mr-1" /> Preview Voice</>
                                                )}
                                            </Button>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        )}
                    </div>

                    {/* First Message */}
                    <div className="space-y-2">
                        <Label htmlFor="first-message">First Message (Optional)</Label>
                        <Input
                            id="first-message"
                            value={firstMessage}
                            onChange={(e) => setFirstMessage(e.target.value)}
                            placeholder="e.g., Hi! Thanks for calling. How can I help you today?"
                        />
                        <p className="text-xs text-muted-foreground">
                            What the agent says when the call connects
                        </p>
                    </div>

                    {/* System Prompt */}
                    <div className="space-y-2">
                        <Label htmlFor="system-prompt">System Prompt (Optional)</Label>
                        <Textarea
                            id="system-prompt"
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="You are a helpful assistant for..."
                            rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                            Instructions that guide the agent&apos;s behavior
                        </p>
                    </div>

                    {/* Client Assignment */}
                    {clients.length > 0 && (
                        <div className="space-y-2">
                            <Label>Assign to Client (Optional)</Label>
                            <Select value={clientId || 'none'} onValueChange={(v) => setClientId(v === 'none' ? '' : v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select client" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No client</SelectItem>
                                    {clients.map((client) => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Phone Number Assignment */}
                    {availablePhoneNumbers.length > 0 && (
                        <div className="space-y-2">
                            <Label>Assign Phone Number (Optional)</Label>
                            <Select value={phoneNumberId || 'none'} onValueChange={(v) => setPhoneNumberId(v === 'none' ? '' : v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select phone number" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No phone number</SelectItem>
                                    {availablePhoneNumbers.map((pn) => (
                                        <SelectItem key={pn.id} value={pn.id}>
                                            {pn.phone_number}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {error && (
                        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={creating}>
                        {creating ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            'Create Agent'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
