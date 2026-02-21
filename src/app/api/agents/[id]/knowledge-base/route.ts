import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import * as retell from '@/lib/providers/retell';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/agents/[id]/knowledge-base - Get KB for agent
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: agentId } = await params;
        const supabase = createServiceClient();

        // Verify agent belongs to agency
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, name, agency_id, client_id, provider, external_id, config')
            .eq('id', agentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // For client users, verify they have access to this agent
        if (user.profile.client_id && agent.client_id !== user.profile.client_id) {
            return NextResponse.json({ error: 'You do not have access to this agent' }, { status: 403 });
        }

        // Get agency API key
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'No Retell API key configured' }, { status: 400 });
        }

        // Check if agent has a knowledge base ID in config
        const kbId = agent.config?.knowledge_base_id;

        if (!kbId) {
            return NextResponse.json({
                data: null,
                message: 'No knowledge base configured for this agent'
            });
        }

        // Fetch KB from Retell
        try {
            const kb = await retell.getRetellKnowledgeBase(agency.retell_api_key, kbId);
            return NextResponse.json({ data: kb });
        } catch (err) {
            console.error('Error fetching KB:', err);
            return NextResponse.json({
                data: null,
                message: 'Knowledge base not found in Retell'
            });
        }
    } catch (error) {
        console.error('Error in KB GET:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/agents/[id]/knowledge-base - Create KB for agent
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: agentId } = await params;
        const supabase = createServiceClient();

        // Verify agent
        const { data: agent } = await supabase
            .from('agents')
            .select('id, name, agency_id, config')
            .eq('id', agentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Get agency API key
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'No Retell API key configured' }, { status: 400 });
        }

        // Create KB in Retell (name must be ≤40 chars)
        const kbName = `${agent.name} KB`.slice(0, 40);
        const kb = await retell.createRetellKnowledgeBase(agency.retell_api_key, {
            knowledge_base_name: kbName,
        });

        // Update agent config with KB ID
        const updatedConfig = {
            ...agent.config,
            knowledge_base_id: kb.knowledge_base_id,
        };

        await supabase
            .from('agents')
            .update({ config: updatedConfig })
            .eq('id', agentId);

        return NextResponse.json({
            data: kb,
            message: 'Knowledge base created successfully'
        });
    } catch (error: unknown) {
        console.error('Error creating KB:', error);
        return NextResponse.json({ error: 'Failed to create knowledge base' }, { status: 500 });
    }
}

// DELETE /api/agents/[id]/knowledge-base - Delete KB for agent
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: agentId } = await params;
        const supabase = createServiceClient();

        const { data: agent } = await supabase
            .from('agents')
            .select('id, config, agency_id')
            .eq('id', agentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        const kbId = agent.config?.knowledge_base_id;
        if (!kbId) {
            return NextResponse.json({ error: 'No knowledge base to delete' }, { status: 400 });
        }

        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'No Retell API key configured' }, { status: 400 });
        }

        // Delete from Retell
        try {
            await retell.deleteRetellKnowledgeBase(agency.retell_api_key, kbId);
        } catch (err) {
            console.error('Error deleting KB from Retell:', err);
        }

        // Remove KB ID from agent config
        const updatedConfig = { ...agent.config };
        delete updatedConfig.knowledge_base_id;

        await supabase
            .from('agents')
            .update({ config: updatedConfig })
            .eq('id', agentId);

        return NextResponse.json({ message: 'Knowledge base deleted' });
    } catch (error) {
        console.error('Error deleting KB:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
