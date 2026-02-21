import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/scheduled-calls/[id] - Get a scheduled call
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const supabase = await createClient();

        const { data: scheduledCall, error } = await supabase
            .from('scheduled_calls')
            .select('*, agent:agents(name, external_id)')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (error || !scheduledCall) {
            return NextResponse.json({ error: 'Scheduled call not found' }, { status: 404 });
        }

        return NextResponse.json({ data: scheduledCall });
    } catch (error) {
        console.error('Error fetching scheduled call:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/scheduled-calls/[id] - Update a scheduled call
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const supabase = await createClient();

        // Check if the call can be modified
        const { data: existingCall } = await supabase
            .from('scheduled_calls')
            .select('status')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (!existingCall) {
            return NextResponse.json({ error: 'Scheduled call not found' }, { status: 404 });
        }

        if (existingCall.status !== 'pending') {
            return NextResponse.json({ error: 'Can only modify pending calls' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (body.to_number !== undefined) updateData.to_number = body.to_number;
        if (body.contact_name !== undefined) updateData.contact_name = body.contact_name;
        if (body.scheduled_at !== undefined) {
            const scheduledDate = new Date(body.scheduled_at);
            if (scheduledDate < new Date()) {
                return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
            }
            updateData.scheduled_at = scheduledDate.toISOString();
        }
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.status !== undefined) {
            const ALLOWED_STATUSES = ['pending', 'completed', 'cancelled', 'in_progress', 'failed'];
            if (!ALLOWED_STATUSES.includes(body.status)) {
                return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
            }
            updateData.status = body.status;
        }

        const { data: scheduledCall, error } = await supabase
            .from('scheduled_calls')
            .update(updateData)
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .select('*, agent:agents(name, external_id)')
            .single();

        if (error) {
            console.error('Error updating scheduled call:', error);
            return NextResponse.json({ error: 'Failed to update scheduled call' }, { status: 500 });
        }

        return NextResponse.json({ data: scheduledCall });
    } catch (error) {
        console.error('Error updating scheduled call:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/scheduled-calls/[id] - Cancel/delete a scheduled call
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const supabase = await createClient();

        // Check if call is pending
        const { data: existingCall } = await supabase
            .from('scheduled_calls')
            .select('status')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (!existingCall) {
            return NextResponse.json({ error: 'Scheduled call not found' }, { status: 404 });
        }

        if (existingCall.status === 'in_progress') {
            return NextResponse.json({ error: 'Cannot cancel a call in progress' }, { status: 400 });
        }

        // Mark as cancelled instead of deleting for audit
        const { error } = await supabase
            .from('scheduled_calls')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('agency_id', user.agency.id);

        if (error) {
            console.error('Error cancelling scheduled call:', error);
            return NextResponse.json({ error: 'Failed to delete scheduled call' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error cancelling scheduled call:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
