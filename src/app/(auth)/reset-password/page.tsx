'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, Lock, CheckCircle } from 'lucide-react';

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Check for access token in URL (Supabase magic link)
    useEffect(() => {
        const accessToken = searchParams.get('access_token');
        const type = searchParams.get('type');

        if (accessToken && type === 'recovery') {
            // Supabase will handle the session automatically
            console.log('Recovery token detected');
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            setLoading(false);
            return;
        }

        try {
            const supabase = createClient();

            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) {
                setError(error.message);
            } else {
                setSuccess(true);
                setTimeout(() => {
                    router.push('/login');
                }, 3000);
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <Card className="w-full max-w-md border-l-4 border-l-green-500 text-center">
                <CardContent className="pt-6">
                    <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Password Updated!</h1>
                    <p className="text-muted-foreground mt-2">
                        Your password has been successfully reset. Redirecting to login...
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md border-l-4 border-l-purple-500">
            <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-6">
                    <Lock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Set New Password</h1>
                <p className="text-muted-foreground mt-1">
                    Enter your new password below
                </p>
            </CardHeader>

            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="password">New Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={8}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={8}
                        />
                    </div>

                    <Button type="submit" className="w-full rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            'Update Password'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <Card className="w-full max-w-md border-l-4 border-l-purple-500 text-center animate-pulse">
                <CardHeader>
                    <div className="mx-auto w-12 h-12 bg-muted rounded-full mb-6" />
                    <div className="h-7 bg-muted rounded w-48 mx-auto" />
                </CardHeader>
            </Card>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}
