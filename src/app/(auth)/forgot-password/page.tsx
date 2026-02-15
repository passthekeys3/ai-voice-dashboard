'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Mail, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ''}/reset-password`,
            });

            if (error) {
                setError(error.message);
            } else {
                setSent(true);
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="w-full max-w-md text-center">
                <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Check Your Email</h1>
                <p className="text-muted-foreground mt-2">
                    We&apos;ve sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-6">
                    Click the link in the email to reset your password.
                    If you don&apos;t see it, check your spam folder.
                </p>
                <Button variant="outline" className="w-full mt-6 rounded-full" asChild>
                    <Link href="/login">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Login
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md">
            <div className="text-center mb-8">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-6">
                    <Mail className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
                <p className="text-muted-foreground mt-1">
                    Enter your email and we&apos;ll send you a reset link
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                    />
                </div>

                <Button type="submit" className="w-full rounded-full" disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        'Send Reset Link'
                    )}
                </Button>

                <Button variant="ghost" className="w-full" asChild>
                    <Link href="/login">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Login
                    </Link>
                </Button>
            </form>
        </div>
    );
}
