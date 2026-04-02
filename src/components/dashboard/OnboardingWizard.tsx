'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    CheckCircle2,
    ArrowRight,
    Loader2,
    BookOpen,
    ExternalLink,
    Eye,
    EyeOff,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { VOICE_PROVIDERS, PROVIDER_KEY_MAP } from '@/lib/constants/config';
import type { VoiceProvider } from '@/types';
import Link from 'next/link';

interface OnboardingWizardProps {
    agency: { name: string };
    userName: string;
    isOnboarded: boolean;
}

type Step = 'welcome' | 'provider' | 'verify' | 'complete';

const STEPS: Step[] = ['welcome', 'provider', 'verify', 'complete'];

export function OnboardingWizard({ agency, userName, isOnboarded }: OnboardingWizardProps) {
    const [step, setStep] = useState<Step>(isOnboarded ? 'complete' : 'welcome');
    const [provider, setProvider] = useState<VoiceProvider>('retell');
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verified, setVerified] = useState(false);
    const [agentCount, setAgentCount] = useState(0);
    const stepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
        };
    }, []);

    const currentIndex = STEPS.indexOf(step);

    const handleSaveApiKey = async () => {
        if (!apiKey.trim()) {
            toast.error('Please enter your API key');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [PROVIDER_KEY_MAP[provider]]: apiKey,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save API key');
            }

            toast.success('API key saved');
            setStep('verify');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleVerify = async () => {
        setVerifying(true);
        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'agents' }),
            });

            if (!response.ok) {
                throw new Error('Verification failed. Please check your API key.');
            }

            const data = await response.json();
            const synced = data.synced || 0;
            setAgentCount(synced);
            setVerified(true);
            toast.success(`Connected! Found ${synced} agent${synced !== 1 ? 's' : ''}.`);

            stepTimeoutRef.current = setTimeout(() => setStep('complete'), 1500);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Verification failed');
        } finally {
            setVerifying(false);
        }
    };

    const providerName = provider === 'retell' ? 'Retell' : provider === 'vapi' ? 'VAPI' : provider === 'bland' ? 'Bland' : 'ElevenLabs';

    return (
        <div className="w-full max-w-lg">
            {/* Step indicator — single neutral color */}
            <div className="flex items-center justify-center gap-0 mb-8">
                {STEPS.map((s, i) => (
                    <div key={s} className="flex items-center">
                        <div
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                i <= currentIndex ? 'bg-foreground' : 'bg-muted-foreground/20'
                            }`}
                        />
                        {i < STEPS.length - 1 && (
                            <div
                                className={`w-10 h-px transition-all duration-300 ${
                                    i < currentIndex ? 'bg-foreground' : 'bg-muted-foreground/20'
                                }`}
                            />
                        )}
                    </div>
                ))}
            </div>

            <Card className="w-full">
                {/* ── Welcome ──────────────────────────────── */}
                {step === 'welcome' && (
                    <>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-2xl">
                                Welcome, {userName.split(' ')[0]}
                            </CardTitle>
                            <CardDescription>
                                Connect your voice AI provider to get {agency.name} up and running. Takes about 2 minutes.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <p className="text-sm text-muted-foreground">
                                You&apos;ll connect your Retell, VAPI, or Bland account, and we&apos;ll import your agents automatically.
                            </p>

                            <a
                                href="https://docs.buildvoiceai.com/docs/getting-started"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <BookOpen className="h-4 w-4" />
                                Getting started guide
                                <ExternalLink className="h-3 w-3" />
                            </a>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => { window.location.href = '/'; }}
                                >
                                    Skip for now
                                </Button>
                                <Button className="flex-1" onClick={() => setStep('provider')}>
                                    Get started
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}

                {/* ── Provider ─────────────────────────────── */}
                {step === 'provider' && (
                    <>
                        <CardHeader>
                            <CardTitle>Connect your provider</CardTitle>
                            <CardDescription>
                                Paste your API key — we&apos;ll encrypt and store it securely.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <Tabs value={provider} onValueChange={(v: string) => { setProvider(v as VoiceProvider); setApiKey(''); }}>
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="retell">Retell</TabsTrigger>
                                    <TabsTrigger value="vapi">VAPI</TabsTrigger>
                                    <TabsTrigger value="bland">Bland</TabsTrigger>
                                    <TabsTrigger value="elevenlabs">ElevenLabs</TabsTrigger>
                                </TabsList>

                                {VOICE_PROVIDERS.map((p) => {
                                    const urls = {
                                        retell: 'https://beta.retellai.com/dashboard',
                                        vapi: 'https://dashboard.vapi.ai',
                                        bland: 'https://app.bland.ai/dashboard',
                                        elevenlabs: 'https://elevenlabs.io/app/settings/api-keys',
                                    };
                                    const placeholders = { retell: 'key_...', vapi: 'vapi_...', bland: 'sk-...', elevenlabs: 'xi_...' };

                                    return (
                                        <TabsContent key={p} value={p} className="space-y-3 mt-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`${p}-key`}>API Key</Label>
                                                <div className="relative">
                                                    <Input
                                                        id={`${p}-key`}
                                                        type={showKey ? 'text' : 'password'}
                                                        placeholder={placeholders[p]}
                                                        value={apiKey}
                                                        onChange={(e) => setApiKey(e.target.value)}
                                                        className="pr-10"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowKey(!showKey)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                        tabIndex={-1}
                                                        aria-label={showKey ? 'Hide API key' : 'Show API key'}
                                                        aria-pressed={showKey}
                                                    >
                                                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Find it at{' '}
                                                    <a href={urls[p]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                        {urls[p].replace('https://', '')}
                                                    </a>
                                                </p>
                                            </div>
                                        </TabsContent>
                                    );
                                })}
                            </Tabs>

                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setStep('welcome')}>
                                    Back
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleSaveApiKey}
                                    disabled={saving || !apiKey.trim()}
                                >
                                    {saving ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                                    ) : (
                                        <>Save & Continue <ArrowRight className="h-4 w-4 ml-2" /></>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}

                {/* ── Verify ───────────────────────────────── */}
                {step === 'verify' && (
                    <>
                        <CardHeader>
                            <CardTitle>Verify connection</CardTitle>
                            <CardDescription>
                                We&apos;ll sync your {providerName} agents to confirm the key works.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="p-4 rounded-lg border bg-muted/50">
                                <div className="flex items-center gap-3">
                                    {verified ? (
                                        <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                                    ) : (
                                        <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 shrink-0" />
                                    )}
                                    <div>
                                        <p className="font-medium text-sm">
                                            {verified ? 'Connected' : 'Ready to verify'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {verified
                                                ? `${agentCount} agent${agentCount !== 1 ? 's' : ''} synced from ${providerName}`
                                                : `Click verify to import your ${providerName} agents`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setStep('provider')}>
                                    Back
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleVerify}
                                    disabled={verifying || verified}
                                >
                                    {verifying ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...</>
                                    ) : verified ? (
                                        <><CheckCircle2 className="h-4 w-4 mr-2" /> Verified</>
                                    ) : (
                                        'Verify connection'
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}

                {/* ── Complete — actionable next steps ──────── */}
                {step === 'complete' && (
                    <>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-2xl">You&apos;re set up</CardTitle>
                            <CardDescription>
                                {agency.name} is connected. Here&apos;s what to do next.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Link
                                    href="/agents"
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div>
                                        <p className="text-sm font-medium">View your agents</p>
                                        <p className="text-xs text-muted-foreground">Configure, test, and manage your voice agents</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </Link>
                                <Link
                                    href="/agent-builder"
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div>
                                        <p className="text-sm font-medium">Build a new agent</p>
                                        <p className="text-xs text-muted-foreground">Describe what you need — AI generates the config</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </Link>
                                <Link
                                    href="/clients"
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div>
                                        <p className="text-sm font-medium">Add your first client</p>
                                        <p className="text-xs text-muted-foreground">Set up a client account and assign agents</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </Link>
                            </div>

                            <Button
                                className="w-full"
                                size="lg"
                                onClick={() => { window.location.href = '/'; }}
                            >
                                Go to Dashboard
                            </Button>

                            <a
                                href="https://docs.buildvoiceai.com/docs"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <BookOpen className="h-4 w-4" />
                                Documentation
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </CardContent>
                    </>
                )}
            </Card>
        </div>
    );
}
