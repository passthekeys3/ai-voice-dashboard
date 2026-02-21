'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawRedirect = searchParams.get('redirect') || '/';
    // Prevent open redirect: only allow relative paths
    const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';
    const message = searchParams.get('message');
    const urlError = searchParams.get('error');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const supabase = createClient();
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                // Friendly error messages
                if (authError.message?.includes('Email not confirmed')) {
                    setError('Please verify your email before signing in. Check your inbox for a verification link.');
                } else if (authError.message?.includes('Invalid login credentials')) {
                    setError('Invalid email or password. Please try again.');
                } else {
                    setError(authError.message);
                }
                return;
            }

            router.push(redirect);
            router.refresh();
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md border-l-4 border-l-blue-500">
            <CardHeader className="text-center pb-2">
                <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="text-muted-foreground mt-1">Sign in to your account to continue</p>
            </CardHeader>

            <CardContent>
                {message && (
                    <div className="mb-6 p-3 text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/50 rounded-md flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        {message}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    {(error || urlError) && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-md">
                            {error || urlError}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                                Forgot password?
                            </Link>
                        </div>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                tabIndex={-1}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    <Button type="submit" className="w-full rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            'Sign in'
                        )}
                    </Button>
                </form>

                <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{' '}
                    <Link href="/signup" className="text-primary hover:underline">
                        Sign up
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <Card className="w-full max-w-md border-l-4 border-l-blue-500 animate-pulse">
                <CardHeader className="text-center space-y-2">
                    <div className="h-7 bg-muted rounded w-48 mx-auto" />
                    <div className="h-4 bg-muted rounded w-64 mx-auto" />
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-12" />
                        <div className="h-10 bg-muted rounded" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-16" />
                        <div className="h-10 bg-muted rounded" />
                    </div>
                    <div className="h-10 bg-muted rounded-full" />
                </CardContent>
            </Card>
        }>
            <LoginForm />
        </Suspense>
    );
}
