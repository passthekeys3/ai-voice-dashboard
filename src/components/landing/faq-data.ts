import { PLATFORM_PER_MINUTE_RATE } from '@/lib/billing/tiers';

/**
 * Landing page FAQ. Rendered by FAQSection and mirrored into the page's
 * FAQPage JSON-LD, so both stay in sync. Keep answers to things the product
 * actually does today.
 */
export const faqs = [
    {
        question: 'How long does it take to set up a voice agent?',
        answer: 'Describe what your agent should do in plain English and the builder writes the prompt, picks a voice, and sets up the agent on your voice provider. Make a test call, adjust anything, and connect a phone number when you are ready to go live.',
    },
    {
        question: 'Can I use my own phone numbers?',
        answer: 'Yes. Buy new numbers directly from the dashboard, or sync the numbers you already have in your voice provider account.',
    },
    {
        question: 'Which CRMs do you integrate with?',
        answer: 'GoHighLevel and HubSpot are natively supported. When a call ends, workflows can update contacts, book appointments, and trigger follow-ups automatically. Calendly, Google Calendar, and Slack are supported too.',
    },
    {
        question: 'How does white-labeling work?',
        answer: 'On the Growth and Agency plans, you get a fully branded dashboard — your logo, your colors, your domain. Your clients log into their own portal and only see their data. They never see BuildVoiceAI.',
    },
    {
        question: 'Which voice providers can I use?',
        answer: 'Retell AI, Vapi, Bland, and ElevenLabs. You can preview voices before going live and mix providers across clients.',
    },
    {
        question: 'Is my data private and secure?',
        answer: 'All data is encrypted at rest and in transit. Call recordings and transcripts are scoped per account with row-level security. We never share your data or use it to train models.',
    },
    {
        question: "What happens if the AI can't answer a question?",
        answer: 'You define fallback behavior when building your agent — for example, transferring to a human or taking a message. You stay in control of every edge case.',
    },
    {
        question: 'Can I try it before committing to a plan?',
        answer: 'Yes. Every plan starts with a 7-day free trial, and no credit card is needed to sign up. Build agents, make test calls, and explore the full platform first.',
    },
    {
        question: 'How are calls billed?',
        answer: `Plans are priced by number of clients, with unlimited agents. Bring your own provider API keys and you pay the provider directly for call minutes, or use our platform keys at $${PLATFORM_PER_MINUTE_RATE}/min. The dashboard tracks call costs in real time.`,
    },
    {
        question: 'Is the platform HIPAA or SOC 2 compliant?',
        answer: 'Not yet. Call data is encrypted at rest and in transit, and access controls are enforced at the row level. If you work in healthcare or another regulated industry, contact us before handling protected data.',
    },
];
