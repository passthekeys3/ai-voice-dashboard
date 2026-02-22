import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { purchaseBlandInboundNumber } from '@/lib/providers/bland';

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
            .select(`
                *,
                inbound_agent:agents!phone_numbers_inbound_agent_id_fkey(id, name),
                outbound_agent:agents!phone_numbers_outbound_agent_id_fkey(id, name)
            `)
            .eq('agency_id', user.agency.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching phone numbers:', error.code);
            return NextResponse.json({ error: 'Failed to fetch phone numbers' }, { status: 500 });
        }

        return NextResponse.json({ data: phoneNumbers });
    } catch (error) {
        console.error('Error fetching phone numbers:', error instanceof Error ? error.message : 'Unknown error');
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
        const { area_code, agent_id, provider: requestedProvider } = body;

        if (!area_code) {
            return NextResponse.json({ error: 'Area code is required' }, { status: 400 });
        }

        // Validate area code format (3-digit, 200-999)
        const areaCodeStr = String(area_code).trim();
        if (!/^[2-9]\d{2}$/.test(areaCodeStr)) {
            return NextResponse.json({ error: 'Area code must be a valid 3-digit code (e.g., 415)' }, { status: 400 });
        }

        const supabase = await createClient();

        // Validate agent belongs to this agency (prevent cross-tenant assignment)
        if (agent_id) {
            const { data: agentCheck } = await supabase
                .from('agents')
                .select('id')
                .eq('id', agent_id)
                .eq('agency_id', user.agency.id)
                .single();
            if (!agentCheck) {
                return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
            }
        }

        // Get API keys for all providers
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key, vapi_api_key, bland_api_key')
            .eq('id', user.agency.id)
            .single();

        // Determine which provider to use
        const provider = requestedProvider || (agency?.retell_api_key ? 'retell' : agency?.vapi_api_key ? 'vapi' : agency?.bland_api_key ? 'bland' : null);

        if (provider === 'retell' && agency?.retell_api_key) {
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
                console.error('Retell phone number error:', retellResponse.status);
                return NextResponse.json({ error: 'Failed to purchase phone number from provider' }, { status: 500 });
            }

            const retellNumber = await retellResponse.json();

            const { data: phoneNumber, error } = await supabase
                .from('phone_numbers')
                .insert({
                    agency_id: user.agency.id,
                    external_id: retellNumber.phone_number_id,
                    phone_number: retellNumber.phone_number,
                    provider: 'retell',
                    agent_id: agent_id || null,
                    monthly_cost_cents: 200,
                    purchased_at: new Date().toISOString(),
                })
                .select('*, agent:agents(id, name)')
                .single();

            if (error) {
                console.error('Error saving phone number:', error.code);
                return NextResponse.json({ error: 'Failed to import phone number' }, { status: 500 });
            }

            return NextResponse.json({ data: phoneNumber }, { status: 201 });
        } else if (provider === 'vapi' && agency?.vapi_api_key) {
            // Purchase number from Vapi (Vapi uses Twilio under the hood)
            const vapiResponse = await fetch('https://api.vapi.ai/phone-number', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${agency.vapi_api_key}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: 'vapi',
                    areaCode: area_code,
                    ...(agent_id ? {} : {}), // assistantId assigned separately
                }),
            });

            if (!vapiResponse.ok) {
                console.error('Vapi phone number error:', vapiResponse.status);
                return NextResponse.json({ error: 'Failed to purchase phone number from provider' }, { status: 500 });
            }

            const vapiNumber = await vapiResponse.json();

            const { data: phoneNumber, error } = await supabase
                .from('phone_numbers')
                .insert({
                    agency_id: user.agency.id,
                    external_id: vapiNumber.id,
                    phone_number: vapiNumber.number,
                    provider: 'vapi',
                    agent_id: agent_id || null,
                    monthly_cost_cents: 200,
                    purchased_at: new Date().toISOString(),
                })
                .select('*, agent:agents(id, name)')
                .single();

            if (error) {
                console.error('Error saving Vapi phone number:', error.code);
                return NextResponse.json({ error: 'Failed to import phone number' }, { status: 500 });
            }

            return NextResponse.json({ data: phoneNumber }, { status: 201 });
        } else if (provider === 'bland' && agency?.bland_api_key) {
            // Purchase inbound number from Bland
            const blandResult = await purchaseBlandInboundNumber(agency.bland_api_key, area_code);

            const { data: phoneNumber, error } = await supabase
                .from('phone_numbers')
                .insert({
                    agency_id: user.agency.id,
                    external_id: blandResult.phone_number,
                    phone_number: blandResult.phone_number,
                    provider: 'bland',
                    agent_id: agent_id || null,
                    monthly_cost_cents: 200,
                    purchased_at: new Date().toISOString(),
                })
                .select('*, agent:agents(id, name)')
                .single();

            if (error) {
                console.error('Error saving Bland phone number:', error.code);
                return NextResponse.json({ error: 'Failed to import phone number' }, { status: 500 });
            }

            return NextResponse.json({ data: phoneNumber }, { status: 201 });
        } else {
            return NextResponse.json({ error: 'No voice provider API key configured for phone number purchase' }, { status: 400 });
        }
    } catch (error) {
        console.error('Error purchasing phone number:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
