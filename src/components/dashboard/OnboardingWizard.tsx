'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    CheckCircle2,
    ArrowRight,
    Loader2,
    Key,
    Sparkles,
    Phone,
    Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Agency } from '@/types';

interface OnboardingWizardProps {
    agency: Agency;
    userName: string;
    isOnboarded: boolean;
}

type Step = 'welcome' | 'provider' | 'verify' | 'complete';

const STEPS: Step[] = ['welcome', 'provider', 'verify', 'complete'];

const STEP_COLORS: Record<Step, string> = {
    welcome: 'bg-blue-500',
    provider: 'bg-green-500',
    verify: 'bg-amber-500',
    complete: 'bg-purple-500',
};

const STEP_BORDERS: Record<Step, string> = {
    welcome: 'border-l-blue-500',
    provider: 'border-l-green-500',
    verify: 'border-l-amber-500',
    complete: 'border-l-purple-500',
};

export function OnboardingWizard({ agency, userName, isOnboarded }: OnboardingWizardProps) {
    const router = useRouter();
    const [step, setStep] = useState<Step>(isOnboarded ? 'complete' : 'welcome');
    const [provider, setProvider] = useState<'retell' | 'vapi' | 'bland'>('retell');
    const [apiKey, setApiKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verified, setVerified] = useState(false);

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
                    [provider === 'retell' ? 'retell_api_key' : provider === 'vapi' ? 'vapi_api_key' : 'bland_api_key']: apiKey,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save API key');
            }

            toast.success('API key saved successfully');
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
            // Try to sync agents to verify the API key works
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'agents' }),
            });

            if (!response.ok) {
                throw new Error('API key verification failed. Please check your key.');
            }

            const data = await response.json();
            setVerified(true);
            toast.success(`Connected! Found ${data.synced || 0} agents.`);

            // Short delay then move to complete
            setTimeout(() => setStep('complete'), 1500);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Verification failed');
        } finally {
            setVerifying(false);
        }
    };

    const handleComplete = () => {
        router.push('/');
        router.refresh();
    };

    const handleSkip = () => {
        router.push('/');
    };

    return (
        <div className="w-full max-w-lg">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-0 mb-8">
                {STEPS.map((s, i) => (
                    <div key={s} className="flex items-center">
                        <div
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                                i <= currentIndex
                                    ? STEP_COLORS[s]
                                    : 'bg-muted-foreground/20'
                            }`}
                        />
                        {i < STEPS.length - 1 && (
                            <div
                                className={`w-10 h-px transition-all duration-300 ${
                                    i < currentIndex
                                        ? STEP_COLORS[STEPS[i]]
                                        : 'bg-muted-foreground/20'
                                }`}
                            />
                        )}
                    </div>
                ))}
            </div>

            <Card className={`w-full border-l-4 transition-colors duration-300 ${STEP_BORDERS[step]}`}>
                {step === 'welcome' && (
                    <>
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                                <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <CardTitle className="text-3xl">Welcome, {userName.split(' ')[0]}!</CardTitle>
                            <CardDescription className="text-base">
                                Let&apos;s get {agency.name} set up with your voice AI provider.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border-l-2 border-l-blue-500">
                                    <Key className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-sm">Connect your provider</p>
                                        <p className="text-sm text-muted-foreground">Add your Retell, VAPI, or Bland API key</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border-l-2 border-l-green-500">
                                    <Bot className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-sm">Sync your agents</p>
                                        <p className="text-sm text-muted-foreground">Import existing AI agents automatically</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border-l-2 border-l-amber-500">
                                    <Phone className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-sm">Manage everything</p>
                                        <p className="text-sm text-muted-foreground">Calls, analytics, clients - all in one place</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1 rounded-full" onClick={handleSkip}>
                                    Skip for now
                                </Button>
                                <Button className="flex-1 rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" onClick={() => setStep('provider')}>
                                    Get started
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}

                {step === 'provider' && (
                    <>
                        <CardHeader>
                            <CardTitle>Connect your provider</CardTitle>
                            <CardDescription>
                                Enter your API key to connect your voice AI provider
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Tabs value={provider} onValueChange={(v: string) => setProvider(v as 'retell' | 'vapi' | 'bland')}>
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="retell">Retell AI</TabsTrigger>
                                    <TabsTrigger value="vapi">VAPI</TabsTrigger>
                                    <TabsTrigger value="bland">Bland.ai</TabsTrigger>
                                </TabsList>
                                <TabsContent value="retell" className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="retell-key">Retell API Key</Label>
                                        <Input
                                            id="retell-key"
                                            type="password"
                                            placeholder="key_..."
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Find your API key at{' '}
                                            <a
                                                href="https://beta.retellai.com/dashboard"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline"
                                            >
                                                beta.retellai.com/dashboard
                                            </a>
                                        </p>
                                    </div>
                                </TabsContent>
                                <TabsContent value="vapi" className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="vapi-key">VAPI API Key</Label>
                                        <Input
                                            id="vapi-key"
                                            type="password"
                                            placeholder="vapi_..."
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Find your API key at{' '}
                                            <a
                                                href="https://dashboard.vapi.ai"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline"
                                            >
                                                dashboard.vapi.ai
                                            </a>
                                        </p>
                                    </div>
                                </TabsContent>
                                <TabsContent value="bland" className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="bland-key">Bland API Key</Label>
                                        <Input
                                            id="bland-key"
                                            type="password"
                                            placeholder="sk-..."
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Find your API key at{' '}
                                            <a
                                                href="https://app.bland.ai/dashboard"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline"
                                            >
                                                app.bland.ai/dashboard
                                            </a>
                                        </p>
                                    </div>
                                </TabsContent>
                            </Tabs>

                            <div className="flex gap-3">
                                <Button variant="outline" className="rounded-full" onClick={() => setStep('welcome')}>
                                    Back
                                </Button>
                                <Button
                                    className="flex-1 rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                                    onClick={handleSaveApiKey}
                                    disabled={saving || !apiKey.trim()}
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            Save & Continue
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}

                {step === 'verify' && (
                    <>
                        <CardHeader>
                            <CardTitle>Verify connection</CardTitle>
                            <CardDescription>
                                Let&apos;s make sure everything is connected properly
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="p-4 rounded-lg border bg-muted">
                                <div className="flex items-center gap-3">
                                    {verified ? (
                                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                                    ) : (
                                        <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30" />
                                    )}
                                    <div>
                                        <p className="font-medium">
                                            {verified ? 'Connection verified!' : 'Ready to verify'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {verified
                                                ? 'Your agents have been synced'
                                                : `We'll sync your ${provider === 'retell' ? 'Retell' : provider === 'vapi' ? 'VAPI' : 'Bland'} agents`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button variant="outline" className="rounded-full" onClick={() => setStep('provider')}>
                                    Back
                                </Button>
                                <Button
                                    className="flex-1 rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                                    onClick={handleVerify}
                                    disabled={verifying || verified}
                                >
                                    {verifying ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Verifying...
                                        </>
                                    ) : verified ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                            Verified
                                        </>
                                    ) : (
                                        'Verify connection'
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}

                {step === 'complete' && (
                    <>
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                            </div>
                            <CardTitle className="text-2xl">You&apos;re all set!</CardTitle>
                            <CardDescription className="text-base">
                                {agency.name} is ready to go. Start managing your voice AI agents.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button className="w-full rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" size="lg" onClick={handleComplete}>
                                Go to Dashboard
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        </CardContent>
                    </>
                )}
            </Card>
        </div>
    );
}
