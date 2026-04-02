import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { OnboardingWizard } from '@/components/dashboard/OnboardingWizard';

export default async function OnboardingPage() {
    const user = await requireAuth();

    // Only agency admins can complete onboarding
    if (!isAgencyAdmin(user)) {
        redirect('/');
    }

    // Check if agency is already set up (has API key)
    const isOnboarded = !!user.agency.retell_api_key || !!user.agency.vapi_api_key || !!user.agency.bland_api_key || !!user.agency.elevenlabs_api_key;

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div>
                <OnboardingWizard
                    agency={{ name: user.agency.name }}
                    userName={user.profile.full_name}
                    isOnboarded={isOnboarded}
                />
            </div>
        </div>
    );
}
