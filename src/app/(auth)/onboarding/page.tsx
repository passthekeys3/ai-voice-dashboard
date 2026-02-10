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
    const isOnboarded = !!user.agency.retell_api_key || !!user.agency.vapi_api_key;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <OnboardingWizard
                agency={user.agency}
                userName={user.profile.full_name}
                isOnboarded={isOnboarded}
            />
        </div>
    );
}
