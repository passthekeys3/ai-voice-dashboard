'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExportCallsButtonProps {
    startDate?: string;
    endDate?: string;
    agentId?: string;
}

export function ExportCallsButton({ startDate, endDate, agentId }: ExportCallsButtonProps) {
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.set('start', startDate);
            if (endDate) params.set('end', endDate);
            if (agentId) params.set('agent_id', agentId);

            const response = await fetch(`/api/calls/export?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Export failed');
            }

            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `calls-export-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export calls. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? (
                <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                </>
            ) : (
                <>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                </>
            )}
        </Button>
    );
}
