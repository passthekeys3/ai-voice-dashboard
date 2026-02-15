'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function BillingUsage() {
    const [loading, setLoading] = useState(false);

    const openBillingPortal = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/billing/portal', {
                method: 'POST',
            });
            const data = await response.json();

            if (data.url) {
                window.open(data.url, '_blank');
            } else {
                toast.error(data.message || 'Billing portal not yet configured. Contact your agency administrator.');
            }
        } catch (error) {
            console.error('Error opening billing portal:', error);
            toast.error('Failed to open billing portal.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Method
                </CardTitle>
                <CardDescription>
                    Manage your payment method and view invoices
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Access the billing portal to update your payment method, view invoices, and manage your subscription.
                </p>
                <Button onClick={openBillingPortal} disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Opening...
                        </>
                    ) : (
                        <>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Manage Billing
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
