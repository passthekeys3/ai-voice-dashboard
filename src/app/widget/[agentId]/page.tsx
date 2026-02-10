import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { WidgetCallUI } from '@/components/widget/WidgetCallUI';

export default async function WidgetPage({
    params,
}: {
    params: Promise<{ agentId: string }>;
}) {
    const { agentId } = await params;
    const supabase = createServiceClient();

    // Fetch agent + agency branding for the widget
    const { data: agent } = await supabase
        .from('agents')
        .select('id, name, provider, is_active, widget_enabled, widget_config, agency_id')
        .eq('id', agentId)
        .single();

    if (!agent || !agent.is_active || !agent.widget_enabled) {
        notFound();
    }

    // Get agency branding for fallback colors
    const { data: agency } = await supabase
        .from('agencies')
        .select('branding')
        .eq('id', agent.agency_id)
        .single();

    const widgetConfig = {
        color: agent.widget_config?.color || agency?.branding?.primary_color || '#0f172a',
        position: agent.widget_config?.position || 'right',
        greeting: agent.widget_config?.greeting || `Talk to ${agent.name}`,
        avatar_url: agent.widget_config?.avatar_url || null,
    };

    return (
        <WidgetCallUI
            agentId={agent.id}
            agentName={agent.name}
            provider={agent.provider}
            widgetConfig={widgetConfig}
        />
    );
}
