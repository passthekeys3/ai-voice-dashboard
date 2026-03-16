import { redirect } from 'next/navigation';

// Integrations have moved to Settings — redirect for bookmarks/old links
export default function IntegrationsRoute() {
    redirect('/settings');
}
