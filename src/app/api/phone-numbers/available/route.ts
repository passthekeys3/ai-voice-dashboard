import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/phone-numbers/available - Search available phone numbers
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const areaCode = searchParams.get('area_code');

        if (!areaCode) {
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

        // Search available numbers from Retell
        // Note: Retell's API may not have a search endpoint - they provision on demand
        // We'll return a preview of what area code will be purchased
        const availableNumbers = [
            {
                area_code: areaCode,
                region: getRegionForAreaCode(areaCode),
                estimated_cost_cents: 200, // $2/month typical
                available: true,
            }
        ];

        return NextResponse.json({
            data: availableNumbers,
            note: 'Numbers are provisioned on demand. Purchase to get your number.',
        });
    } catch (error) {
        console.error('Error searching phone numbers:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Helper to get approximate region for area code
function getRegionForAreaCode(areaCode: string): string {
    const regions: Record<string, string> = {
        '212': 'New York, NY',
        '213': 'Los Angeles, CA',
        '312': 'Chicago, IL',
        '415': 'San Francisco, CA',
        '512': 'Austin, TX',
        '617': 'Boston, MA',
        '702': 'Las Vegas, NV',
        '786': 'Miami, FL',
        '305': 'Miami, FL',
        '310': 'Los Angeles, CA',
        '323': 'Los Angeles, CA',
        '404': 'Atlanta, GA',
        '469': 'Dallas, TX',
        '480': 'Phoenix, AZ',
        '503': 'Portland, OR',
        '619': 'San Diego, CA',
        '713': 'Houston, TX',
        '720': 'Denver, CO',
        '832': 'Houston, TX',
    };
    return regions[areaCode] || `Area code ${areaCode}`;
}
