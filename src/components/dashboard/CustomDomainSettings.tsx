'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Globe,
    CheckCircle,
    XCircle,
    Loader2,
    Copy,
    ExternalLink,
    RefreshCw,
    Trash2,
    AlertCircle,
} from 'lucide-react';

interface DomainConfig {
    custom_domain: string | null;
    domain_verified: boolean;
    domain_verified_at: string | null;
    verification_token: string | null;
    slug: string | null;
}

interface VerificationInstructions {
    txt_record: {
        name: string;
        type: string;
        value: string;
        description?: string;
    };
    cname_record: {
        name: string;
        type: string;
        value: string;
        description?: string;
    };
}

interface VerificationResult {
    verified: boolean;
    message: string;
    verification_result?: {
        dns_configured: boolean;
        txt_record_found: boolean;
        cname_configured: boolean;
        errors: string[];
    };
    instructions?: VerificationInstructions;
}

export function CustomDomainSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [config, setConfig] = useState<DomainConfig | null>(null);
    const [newDomain, setNewDomain] = useState('');
    const [newSlug, setNewSlug] = useState('');
    const [instructions, setInstructions] = useState<VerificationInstructions | null>(null);

    const fetchConfig = useCallback(async () => {
        try {
            const response = await fetch('/api/domains');
            if (response.ok) {
                const data = await response.json();
                setConfig(data.data);
                setNewDomain(data.data.custom_domain || '');
                setNewSlug(data.data.slug || '');
            }
        } catch (err) {
            console.error('Failed to fetch domain config:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchVerificationStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/domains/verify');
            if (response.ok) {
                const data = await response.json();
                if (data.data.instructions) {
                    setInstructions(data.data.instructions);
                }
            }
        } catch (err) {
            console.error('Failed to fetch verification status:', err);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    useEffect(() => {
        if (config?.custom_domain && !config?.domain_verified) {
            fetchVerificationStatus();
        }
    }, [config, fetchVerificationStatus]);

    const handleSaveDomain = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/domains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ custom_domain: newDomain || null }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to save domain');
                return;
            }

            setConfig(prev => prev ? {
                ...prev,
                custom_domain: data.data.custom_domain,
                domain_verified: data.data.domain_verified,
                verification_token: data.data.verification_token,
            } : null);

            setSuccess(data.message);
            if (data.data.custom_domain) {
                fetchVerificationStatus();
            } else {
                setInstructions(null);
            }
        } catch (err) {
            setError('An unexpected error occurred');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSlug = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/domains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: newSlug || null }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to save subdomain');
                return;
            }

            setConfig(prev => prev ? { ...prev, slug: data.data.slug } : null);
            setSuccess(data.message);
        } catch (err) {
            setError('An unexpected error occurred');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleVerify = async () => {
        setVerifying(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/domains/verify', {
                method: 'POST',
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Verification failed');
                return;
            }

            const result: VerificationResult = data.data;

            if (result.verified) {
                setSuccess(result.message);
                setConfig(prev => prev ? { ...prev, domain_verified: true } : null);
                setInstructions(null);
            } else {
                if (result.instructions) {
                    setInstructions(result.instructions);
                }
                const errors = result.verification_result?.errors || [];
                setError(`Verification failed: ${errors.join(', ') || result.message}`);
            }
        } catch (err) {
            setError('An unexpected error occurred');
            console.error(err);
        } finally {
            setVerifying(false);
        }
    };

    const handleRemoveDomain = async () => {
        if (!confirm('Are you sure you want to remove your custom domain?')) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const response = await fetch('/api/domains', {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || 'Failed to remove domain');
                return;
            }

            setConfig(prev => prev ? {
                ...prev,
                custom_domain: null,
                domain_verified: false,
                verification_token: null,
            } : null);
            setNewDomain('');
            setInstructions(null);
            setSuccess('Custom domain removed successfully');
        } catch (err) {
            setError('An unexpected error occurred');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).catch(() => { /* clipboard unavailable */ });
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Custom Domain
                </CardTitle>
                <CardDescription>
                    Use your own domain for a fully white-labeled experience
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Success/Error Messages */}
                {success && (
                    <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 rounded-lg flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {success}
                    </div>
                )}
                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400 rounded-lg flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        {error}
                    </div>
                )}

                {/* Subdomain Slug */}
                <div className="space-y-3">
                    <Label htmlFor="slug">Subdomain Slug</Label>
                    <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-2">
                            <Input
                                id="slug"
                                value={newSlug}
                                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                placeholder="your-agency"
                                className="flex-1"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                                .buildvoiceai.com
                            </span>
                        </div>
                        <Button
                            onClick={handleSaveSlug}
                            disabled={saving || newSlug === config?.slug}
                            variant="outline"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Your clients can access the dashboard at this subdomain
                    </p>
                </div>

                <Separator />

                {/* Custom Domain */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="customDomain">Custom Domain</Label>
                        {config?.domain_verified && (
                            <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                            </Badge>
                        )}
                        {config?.custom_domain && !config?.domain_verified && (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Pending Verification
                            </Badge>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Input
                            id="customDomain"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                            placeholder="dashboard.yourcompany.com"
                            disabled={config?.domain_verified}
                            className="flex-1"
                        />
                        {!config?.custom_domain ? (
                            <Button onClick={handleSaveDomain} disabled={saving || !newDomain}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Domain'}
                            </Button>
                        ) : config?.domain_verified ? (
                            <Button variant="destructive" onClick={handleRemoveDomain} disabled={saving}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        ) : (
                            <>
                                <Button onClick={handleVerify} disabled={verifying}>
                                    {verifying ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Verify
                                        </>
                                    )}
                                </Button>
                                <Button variant="destructive" onClick={handleRemoveDomain} disabled={saving}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* DNS Instructions */}
                {instructions && !config?.domain_verified && (
                    <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <h4 className="font-medium flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            DNS Configuration Required
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            Add the following DNS records to your domain to complete verification:
                        </p>

                        {/* TXT Record */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">TXT Record</Badge>
                                <span className="text-sm text-muted-foreground">For ownership verification</span>
                            </div>
                            <div className="grid grid-cols-[auto,1fr,auto] gap-2 text-sm bg-white dark:bg-slate-800 p-3 rounded border">
                                <span className="font-medium">Name:</span>
                                <code className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                    {instructions.txt_record.name}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(instructions.txt_record.name)}
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>

                                <span className="font-medium">Type:</span>
                                <code className="font-mono text-xs">TXT</code>
                                <div />

                                <span className="font-medium">Value:</span>
                                <code className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded break-all">
                                    {instructions.txt_record.value}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(instructions.txt_record.value)}
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        {/* CNAME Record */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">CNAME Record</Badge>
                                <span className="text-sm text-muted-foreground">To point your domain to us</span>
                            </div>
                            <div className="grid grid-cols-[auto,1fr,auto] gap-2 text-sm bg-white dark:bg-slate-800 p-3 rounded border">
                                <span className="font-medium">Name:</span>
                                <code className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                    {instructions.cname_record.name}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(instructions.cname_record.name)}
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>

                                <span className="font-medium">Type:</span>
                                <code className="font-mono text-xs">CNAME</code>
                                <div />

                                <span className="font-medium">Value:</span>
                                <code className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                    {instructions.cname_record.value}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(instructions.cname_record.value)}
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            DNS changes can take up to 48 hours to propagate. Click &quot;Verify&quot; once you&apos;ve added the records.
                        </p>
                    </div>
                )}

                {/* Verified Domain Info */}
                {config?.domain_verified && config?.custom_domain && (
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg space-y-2">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">Your custom domain is active!</span>
                        </div>
                        <p className="text-sm text-green-600 dark:text-green-400">
                            Clients can now access your dashboard at{' '}
                            <a
                                href={`https://${config.custom_domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline font-medium"
                            >
                                https://{config.custom_domain}
                            </a>
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
