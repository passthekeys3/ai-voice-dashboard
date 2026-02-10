import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

// GET /api/phone-numbers - List owned phone numbers
export async function GET(_request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();

        const { data: phoneNumbers, error } = await supabase
            .from('phone_numbers')
            .select('*, agent:agents(id, name)')
            .eq('agency_id', user.agency.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching phone numbers:', error);
            return NextResponse.json({ error: 'Failed to fetch phone numbers' }, { status: 500 });
        }

        return NextResponse.json({ data: phoneNumbers });
    } catch (error) {
        console.error('Error fetching phone numbers:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/phone-numbers - Purchase a phone number
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { area_code, agent_id } = body;

        if (!area_code) {
            return NextResponse.json({ error: 'Area code is required' }, { status: 400 });
        }

        const supabase = await createClient();

        // Get Retell API key
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'Retell API key not configured' }, { status: 400 });
        }

        // Purchase number from Retell
        const retellResponse = await fetch('https://api.retellai.com/v2/create-phone-number', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${agency.retell_api_key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                area_code: parseInt(area_code),
            }),
        });

        if (!retellResponse.ok) {
            const errorData = await retellResponse.json().catch(() => ({}));
            console.error('Retell phone number error:', errorData);
            return NextResponse.json({
                error: errorData.message || 'Failed to purchase phone number'
            }, { status: 500 });
        }

        const retellNumber = await retellResponse.json();

        // Store in our database
        const { data: phoneNumber, error } = await supabase
            .from('phone_numbers')
            .insert({
                agency_id: user.agency.id,
                external_id: retellNumber.phone_number_id,
                phone_number: retellNumber.phone_number,
                provider: 'retell',
                agent_id: agent_id || null,
                monthly_cost_cents: 200, // $2/month typical
                purchased_at: new Date().toISOString(),
            })
            .select('*, agent:agents(id, name)')
            .single();

        if (error) {
            console.error('Error saving phone number:', error);
            return NextResponse.json({ error: 'Failed to import phone number' }, { status: 500 });
        }

        return NextResponse.json({ data: phoneNumber }, { status: 201 });
    } catch (error) {
        console.error('Error purchasing phone number:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
