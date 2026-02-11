import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    notFound,
    badRequest,
    apiSuccess,
    validateRequest,
    withErrorHandling,
} from '@/lib/api/response';

// Use admin client to create users
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/clients/[id]/invite - Invite a user to a client account
export const POST = withErrorHandling(async (
    request: NextRequest,
    context?: RouteParams
) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    if (!isAgencyAdmin(user)) {
        return forbidden();
    }

    const { id: clientId } = await context!.params;
    const body = await request.json();
    const { email, full_name, role = 'client_admin' } = body;

    // Validate input
    const validationError = validateRequest([
        { field: 'email', value: email, required: true, type: 'email' },
        { field: 'full_name', value: full_name, required: true, type: 'string', minLength: 1, maxLength: 100 },
    ]);

    if (validationError) {
        return validationError;
    }

    // Validate role
    if (!['client_admin', 'client_member'].includes(role)) {
        return badRequest('Invalid role. Must be client_admin or client_member');
    }

    // Verify the client exists and belongs to this agency
    const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('id, name, agency_id')
        .eq('id', clientId)
        .eq('agency_id', user.agency.id)
        .single();

    if (clientError || !client) {
        return notFound('Client');
    }

    // Check if user already exists by looking up their profile first (efficient indexed query)
    const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, agency_id')
        .eq('email', email)
        .maybeSingle();

    // If they have a profile in our agency already, reject
    if (existingProfile?.agency_id === user.agency.id) {
        return badRequest('This user already has access to your agency');
    }

    // Check auth system for existing user (needed to determine if we create new or add to existing)
    let existingUser: { id: string; email?: string } | null = null;
    if (existingProfile) {
        // User exists in our system, get their auth record
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(existingProfile.id);
        existingUser = authUser?.user || null;
    }

    // Create the user with a cryptographically secure temporary password
    const tempPassword = randomBytes(16).toString('base64').slice(0, 16) + 'Aa1!';

    let authUserId: string;
    let inviteEmailFailed = false;

    if (existingUser) {
        // User exists in auth, just create profile
        authUserId = existingUser.id;
    } else {
        // Create new auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: false, // They need to confirm via email
            user_metadata: {
                full_name,
                client_name: client.name,
                role,
            },
        });

        if (authError) {
            console.error('Auth error:', authError);
            return badRequest('Failed to create user account');
        }

        authUserId = authData.user!.id;

        // Send password reset email so they can set their own password
        const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email,
            options: {
                redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
            },
        });

        if (resetError) {
            console.error('Failed to send invite email:', resetError);
            inviteEmailFailed = true;
        }
    }

    // Create profile linking user to client
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
            id: authUserId,
            email,
            full_name,
            agency_id: user.agency.id,
            client_id: clientId,
            role,
        })
        .select()
        .single();

    if (profileError) {
        console.error('Profile error:', profileError);
        // If profile creation fails and we created a new user, clean up
        if (!existingUser) {
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
        }
        return badRequest('Failed to create user profile');
    }

    // Return success with warning if email failed
    if (inviteEmailFailed) {
        return apiSuccess({
            message: 'User created but invite email failed to send. Please manually share login credentials or resend the invitation.',
            profile,
            warning: 'invite_email_failed',
        });
    }

    return apiSuccess({
        message: existingUser
            ? 'Existing user added to client successfully'
            : 'User invited successfully',
        profile,
    });
});
