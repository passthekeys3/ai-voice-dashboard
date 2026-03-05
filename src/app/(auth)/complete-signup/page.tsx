'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function CompleteSignupPage() {
    const [agencyName, setAgencyName] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [showPromo, setShowPromo] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await fetch('/api/auth/complete-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agencyName,
                    ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to complete signup');
                return;
            }

            router.push('/');
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md border-l-4 border-l-green-500">
            <CardHeader className="text-center pb-2">
                <h1 className="text-2xl font-bold tracking-tight">One more step</h1>
                <p className="text-muted-foreground mt-1">Set up your agency to get started</p>
            </CardHeader>

            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-md">
                            {error}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="agencyName">Agency Name</Label>
                        <Input
                            id="agencyName"
                            type="text"
                            placeholder="Acme Voice AI"
                            value={agencyName}
                            onChange={(e) => setAgencyName(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowPromo(!showPromo)}
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showPromo ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            Have a promo code?
                        </button>
                        {showPromo && (
                            <div className="mt-2">
                                <Input
                                    id="promoCode"
                                    type="text"
                                    placeholder="Enter promo code"
                                    value={promoCode}
                                    onChange={(e) => setPromoCode(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>
                        )}
                    </div>
                    <Button
                        type="submit"
                        className="w-full rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Setting up...
                            </>
                        ) : (
                            'Get started'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
