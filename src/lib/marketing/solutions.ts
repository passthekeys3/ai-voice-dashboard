/**
 * Content for the industry solution pages (/solutions/[slug]).
 *
 * Only describe what the product does today: post-call workflows (CRM updates,
 * GoHighLevel/HubSpot/Google Calendar booking, SMS, email,
 * Slack, webhooks), CRM-triggered and scheduled outbound calls with calling
 * windows, knowledge bases, call transfer, transcripts and analytics.
 * No invented results or statistics.
 */
import { Phone, TrendingUp, Users, Headphones, type LucideIcon } from 'lucide-react';
import type { SolutionSlug } from './solution-links';

export interface Solution {
    slug: SolutionSlug;
    /** Short industry name, e.g. "Dental practices" */
    name: string;
    title: string;
    headline: string;
    description: string;
    metaDescription: string;
    icon: LucideIcon;
    /** Why calls go wrong today, in the reader's terms */
    problem: string;
    benefits: { title: string; description: string }[];
    callFlow: { title: string; description: string }[];
    /** Illustrative only; rendered with an "example" label */
    sampleConversation: { speaker: 'agent' | 'caller'; text: string }[];
    useCases: string[];
    setup: string[];
    /** Honest limits and caveats */
    goodToKnow: string[];
    faqs: { question: string; answer: string }[];
    examplePrompt: string;
}

export const SOLUTIONS: Record<SolutionSlug, Solution> = {
    dental: {
        slug: 'dental',
        name: 'Dental practices',
        title: 'AI Voice Agents for Dental Practices',
        headline: 'Answer every patient call, even after hours',
        description: 'An AI receptionist that answers questions about your practice, takes new-patient and appointment requests, and hands your front desk a clean summary of every call.',
        metaDescription: 'AI voice agents for dental practices: answer patient calls 24/7, capture appointment requests, book follow-ups in your calendar, and transfer emergencies to on-call staff.',
        icon: Phone,
        problem: 'The phone rings while your front desk is checking someone in, during lunch, and after you close. Callers who reach voicemail often call the next practice on the list. An AI receptionist picks up every call, answers the routine questions, and makes sure nothing waits until the morning without a record.',
        benefits: [
            { title: 'Every call answered', description: 'The agent picks up during busy hours, lunch, evenings and weekends, so patients never land in voicemail.' },
            { title: 'Answers from your own information', description: 'Upload your hours, services, accepted insurance carriers, location and policies. The agent answers from that knowledge base instead of guessing.' },
            { title: 'Appointment requests captured', description: 'The agent collects the caller’s name, number and what they need. A workflow then books the next open slot in GoHighLevel, HubSpot or Google Calendar, or alerts your team to call back.' },
            { title: 'Emergencies go to a person', description: 'Tell the agent what counts as urgent. Those calls transfer straight to your on-call number.' },
            { title: 'Recall and reminder calls', description: 'Schedule outbound calls for cleanings and follow-ups. Calls only go out inside the calling hours you set, in the patient’s time zone.' },
            { title: 'A summary for your front desk', description: 'Every call is logged with a transcript and summary, and can post to Slack or update the contact in your CRM.' },
        ],
        callFlow: [
            { title: 'Patient calls', description: 'The call rings through to your AI receptionist on your existing or new number, 24/7.' },
            { title: 'Agent handles the conversation', description: 'It answers questions from your knowledge base, takes the appointment request, and transfers anything urgent.' },
            { title: 'Workflows run after the call', description: 'The contact is created or updated, the appointment is booked, and your team is notified.' },
            { title: 'Your team reviews', description: 'Transcripts, recordings and summaries are in the dashboard so nothing gets lost between shifts.' },
        ],
        sampleConversation: [
            { speaker: 'agent', text: 'Thanks for calling Bright Smile Dental, this is Ava. How can I help?' },
            { speaker: 'caller', text: 'Hi, I’m new to the area and looking for a cleaning. Do you take Delta Dental?' },
            { speaker: 'agent', text: 'We do accept Delta Dental. I can get you set up as a new patient. Can I have your full name and the best number to reach you?' },
            { speaker: 'caller', text: 'Jordan Lee, 555-0142. Mornings work best.' },
            { speaker: 'agent', text: 'Got it, Jordan. I’ve noted mornings, and our team will call you first thing tomorrow to confirm a time.' },
        ],
        useCases: ['After-hours calls', 'New-patient requests', 'Appointment requests', 'Office hours and directions', 'Insurance questions', 'Recall reminders', 'Emergency routing'],
        setup: [
            'A phone number: buy one in the dashboard or use one you already have with your voice provider',
            'Your practice details for the knowledge base: hours, services, insurance carriers, location, policies',
            'The calendar or CRM you book into (GoHighLevel, HubSpot or Google Calendar)',
            'An on-call number for urgent transfers',
        ],
        goodToKnow: [
            'BuildVoiceAI is not HIPAA compliant yet and does not sign BAAs. Talk to your compliance advisor before using it for calls that involve patient health information.',
            'There is no direct integration with practice-management software such as Dentrix or Open Dental. Bookings go to GoHighLevel, HubSpot or Google Calendar.',
            'The agent can say which insurance carriers you accept, but it does not check a patient’s eligibility or coverage.',
        ],
        faqs: [
            { question: 'Can the AI book directly into my schedule?', answer: 'After the call, a workflow can book the next open slot in GoHighLevel, HubSpot or Google Calendar. It does not write to practice-management systems like Dentrix or Open Dental.' },
            { question: 'What happens with dental emergencies?', answer: 'You define what counts as urgent in the agent’s instructions. Those calls are transferred to the number you choose, such as your on-call dentist.' },
            { question: 'Will patients know they are talking to an AI?', answer: 'You control the greeting. Many practices have the agent introduce itself as a virtual receptionist so callers know what to expect.' },
            { question: 'Is it HIPAA compliant?', answer: 'Not yet, and we do not sign BAAs. Data is encrypted at rest and in transit, but check with your compliance advisor before handling patient health information.' },
        ],
        examplePrompt: 'A friendly dental receptionist that answers questions about our hours, services and accepted insurance, takes appointment requests with the caller’s name and number, and transfers emergencies to the on-call dentist.',
    },
    'real-estate': {
        slug: 'real-estate',
        name: 'Real estate',
        title: 'AI Voice Agents for Real Estate',
        headline: 'Qualify every lead while you’re out showing homes',
        description: 'An AI assistant that answers listing calls, qualifies buyers and sellers, schedules showings, and puts every lead in your CRM with notes and tags.',
        metaDescription: 'AI voice agents for real estate: answer listing inquiries instantly, qualify buyers on budget and timeline, schedule showings, and update GoHighLevel or HubSpot after every call.',
        icon: TrendingUp,
        problem: 'Leads call when they see the sign or the listing, which is usually when you’re in a showing, at a closing or driving. Speed matters: the first agent to have a real conversation often wins the client. An AI assistant answers right away, asks the qualifying questions, and leaves you a lead that is ready for a callback.',
        benefits: [
            { title: 'Instant answer on every inquiry', description: 'Sign calls, listing calls and portal leads get a real conversation immediately instead of voicemail.' },
            { title: 'Buyer and seller qualification', description: 'The agent asks your questions: budget, timeline, pre-approval, areas, whether they’re working with an agent, and what they need to sell.' },
            { title: 'Listing details on hand', description: 'Load your listings, neighborhoods and FAQs into the knowledge base so the agent can answer price, size and feature questions.' },
            { title: 'Showings scheduled', description: 'A workflow books the next open showing slot in your GoHighLevel, HubSpot or Google calendar.' },
            { title: 'Leads organized in your CRM', description: 'Contacts are created or updated with call notes, tags and a lead score, and moved to the right pipeline stage.' },
            { title: 'Speed-to-lead calls', description: 'When a new lead lands in GoHighLevel or HubSpot, a trigger can start an outbound call within your calling hours.' },
        ],
        callFlow: [
            { title: 'Lead calls or comes in', description: 'Inbound calls ring to your AI assistant, and new CRM leads can trigger an outbound call.' },
            { title: 'Agent qualifies', description: 'It answers listing questions and works through your qualification questions naturally.' },
            { title: 'CRM updates itself', description: 'Contact, notes, tags, lead score and pipeline stage are written to GoHighLevel or HubSpot.' },
            { title: 'You follow up with context', description: 'Hot leads can ping you in Slack, and every transcript is in the dashboard before you call back.' },
        ],
        sampleConversation: [
            { speaker: 'agent', text: 'Hi, you’ve reached Maple Street Realty. I can help with questions about our listings. Which property are you calling about?' },
            { speaker: 'caller', text: 'The three-bedroom on Oak Avenue. Is it still available?' },
            { speaker: 'agent', text: 'It is. Are you already pre-approved, and when are you hoping to move?' },
            { speaker: 'caller', text: 'Pre-approved, and we’d like to be in by spring.' },
            { speaker: 'agent', text: 'Great. I’ll pass this to Sam, the listing agent, who will call you today to set up a showing.' },
        ],
        useCases: ['Sign and listing calls', 'Buyer qualification', 'Seller leads', 'Showing scheduling', 'Open house follow-up', 'Speed-to-lead calls', 'Past-client check-ins'],
        setup: [
            'A phone number for your listings or sign riders',
            'Your listings, neighborhoods and common questions for the knowledge base',
            'Your qualification questions and what makes a lead “hot”',
            'GoHighLevel or HubSpot (optional, for automatic CRM updates and lead triggers)',
        ],
        goodToKnow: [
            'Listing details come from the knowledge base you maintain. There is no direct MLS feed, so update it when listings change.',
            'Outbound calls must follow your local telemarketing rules (such as consent and do-not-call lists). Calling windows help, but compliance is your responsibility.',
        ],
        faqs: [
            { question: 'Can it call new leads automatically?', answer: 'Yes. A GoHighLevel or HubSpot trigger can start an outbound call when a new lead arrives, and calls only go out inside the calling hours you set for the lead’s time zone.' },
            { question: 'Does it connect to the MLS?', answer: 'Not directly. The agent answers from the listings and details you add to its knowledge base.' },
            { question: 'How do showings get booked?', answer: 'After the call, a workflow books the next open slot in GoHighLevel, HubSpot or Google Calendar. You can also have it notify you in Slack to call the lead back.' },
            { question: 'Can each agent on my team have their own assistant?', answer: 'Yes. Plans include unlimited agents, so you can set one up per listing agent, team or market.' },
        ],
        examplePrompt: 'A professional real estate assistant that answers questions about our listings, qualifies buyers on budget, timeline and pre-approval, and books showings.',
    },
    sales: {
        slug: 'sales',
        name: 'Sales teams',
        title: 'AI Voice Agents for Sales Teams',
        headline: 'Follow up with every lead, automatically',
        description: 'AI agents that call new and cold leads, qualify them, book meetings, and log every conversation in your CRM.',
        metaDescription: 'AI voice agents for sales teams: CRM-triggered and scheduled outbound calls, lead qualification, meeting booking, and automatic call logging in GoHighLevel or HubSpot.',
        icon: Users,
        problem: 'Most leads never get a second call. Reps prioritize the hottest deals, and everyone else goes cold in the CRM. An AI agent calls every lead on time, has the first qualifying conversation, and only sends the ones worth a rep’s time back to your team.',
        benefits: [
            { title: 'Calls that start themselves', description: 'Trigger a call when a lead is created or changes stage in GoHighLevel or HubSpot, or schedule calls ahead of time.' },
            { title: 'Respectful calling hours', description: 'Set calling windows and the agent only dials inside them, in each lead’s local time zone.' },
            { title: 'Qualification on your terms', description: 'Write your qualifying questions and objection handling in plain English. The agent follows them and records the answers.' },
            { title: 'Meetings booked', description: 'A workflow books the meeting in your GoHighLevel, HubSpot or Google calendar, then tells your rep in Slack.' },
            { title: 'Every call logged', description: 'Transcripts, summaries, tags, lead scores and pipeline updates are written to the contact in your CRM.' },
            { title: 'Test your scripts', description: 'Run A/B experiments on prompts to see which version gets better outcomes before rolling it out.' },
        ],
        callFlow: [
            { title: 'A lead is ready', description: 'A CRM trigger, a schedule or an API call starts the outbound call.' },
            { title: 'Agent has the conversation', description: 'It introduces your offer, asks your qualifying questions and handles common objections.' },
            { title: 'Outcome is recorded', description: 'Tags, lead score, notes and pipeline stage update in GoHighLevel or HubSpot.' },
            { title: 'Reps take it from there', description: 'Qualified leads get a booked meeting and a Slack ping; the rest stay organized for later.' },
        ],
        sampleConversation: [
            { speaker: 'agent', text: 'Hi Morgan, this is Alex from Northwind. You asked about our scheduling software yesterday. Is now a good time?' },
            { speaker: 'caller', text: 'Sure, I have a couple of minutes.' },
            { speaker: 'agent', text: 'Thanks. How many people on your team handle scheduling today, and what are you using?' },
            { speaker: 'caller', text: 'About eight of us, mostly spreadsheets.' },
            { speaker: 'agent', text: 'That’s exactly what we help with. Would a 20-minute demo with our team this week be useful? I’ll have someone reach out to set it up.' },
        ],
        useCases: ['New-lead follow-up', 'Appointment setting', 'Lead qualification', 'Cold-lead re-engagement', 'Event and webinar reminders', 'Customer check-ins'],
        setup: [
            'Retell AI, Vapi or Bland for outbound calls (ElevenLabs agents are inbound and web only in BuildVoiceAI)',
            'A phone number to call from',
            'Your pitch, qualifying questions and common objections',
            'GoHighLevel or HubSpot for triggers and logging (optional; you can also schedule calls or use the API)',
        ],
        goodToKnow: [
            'Outbound calling is regulated (for example, consent rules for AI voices and do-not-call lists in the US). Only call leads you have permission to contact.',
            'There is no CSV list dialer. Calls start from CRM triggers, schedules or the API.',
        ],
        faqs: [
            { question: 'How do outbound calls get started?', answer: 'From a GoHighLevel or HubSpot trigger (for example, a new lead or a stage change), from a scheduled call, or through the API.' },
            { question: 'Can I upload a list to call?', answer: 'There is no CSV upload. Add the leads to your CRM and let a trigger start the calls, or schedule them through the API.' },
            { question: 'Will it call people at night?', answer: 'Not if you set calling windows. Calls outside the window are moved to the next allowed time in the lead’s time zone.' },
            { question: 'Which voice providers support outbound?', answer: 'Retell AI, Vapi and Bland. ElevenLabs agents in BuildVoiceAI handle inbound and web calls.' },
        ],
        examplePrompt: 'A sales agent that follows up with new leads, asks about their team size, current tools and budget, handles common objections, and books a demo.',
    },
    'customer-support': {
        slug: 'customer-support',
        name: 'Customer support',
        title: 'AI Voice Agents for Customer Support',
        headline: 'Resolve routine calls, escalate the rest with context',
        description: 'AI agents that answer common support questions from your help content, hand complex calls to your team, and log every conversation where your team works.',
        metaDescription: 'AI voice agents for customer support: answer FAQs from your knowledge base 24/7, transfer complex calls to a human, and log transcripts to your CRM, Slack or helpdesk.',
        icon: Headphones,
        problem: 'A large share of support calls ask the same questions: hours, order status, how to reset something, what the policy is. Your team answers them over and over while harder issues wait in the queue. An AI agent takes the routine calls around the clock and passes the rest to a person.',
        benefits: [
            { title: 'Answers from your help content', description: 'Add your FAQs, policies and help articles to the knowledge base. The agent answers from them in natural conversation.' },
            { title: 'Open 24/7', description: 'Nights, weekends and holidays get answered, with no hold music.' },
            { title: 'Hand-off to a human', description: 'Define when to escalate, such as billing disputes or upset callers, and the agent transfers the call to your team.' },
            { title: 'Issues logged where you work', description: 'After each call, the transcript and summary go to the contact in your CRM, a Slack channel, or any helpdesk that accepts webhooks.' },
            { title: 'Callbacks and follow-ups', description: 'Schedule a callback or send an SMS or email follow-up when the caller needs one.' },
            { title: 'See what callers ask', description: 'Call analytics and transcripts show which questions come up most, so you can improve your help content.' },
        ],
        callFlow: [
            { title: 'Customer calls', description: 'Your support line rings to the AI agent first, any time of day.' },
            { title: 'Agent answers or escalates', description: 'Routine questions are answered from your knowledge base; complex ones transfer to your team.' },
            { title: 'Everything is logged', description: 'Transcript, summary and sentiment go to your CRM, Slack or helpdesk via webhook.' },
            { title: 'You improve over time', description: 'Review calls, update the knowledge base, and test prompt changes with A/B experiments.' },
        ],
        sampleConversation: [
            { speaker: 'agent', text: 'Thanks for calling Acme support. What can I help you with today?' },
            { speaker: 'caller', text: 'I need to return a jacket I bought last week.' },
            { speaker: 'agent', text: 'No problem. Returns are free within 30 days. You can start one from the Orders page on our website, and the label is emailed to you. Anything else?' },
            { speaker: 'caller', text: 'Actually, I was also charged twice.' },
            { speaker: 'agent', text: 'I’m sorry about that. Let me connect you with our billing team now. They’ll have the details of this call.' },
        ],
        useCases: ['FAQ answers', 'Policy questions', 'Return and order help', 'After-hours support', 'Callback requests', 'Escalation to humans'],
        setup: [
            'Your FAQs, policies and help articles for the knowledge base',
            'Escalation rules and the number to transfer to',
            'Where call logs should go: CRM, Slack, or your helpdesk via webhook',
            'A support phone number',
        ],
        goodToKnow: [
            'Order status and account lookups need data the agent can reach. Without a custom integration, it can only answer from the knowledge base and take a message.',
            'There is no native helpdesk integration (such as Zendesk). Use the webhook action to create tickets in tools that accept webhooks.',
        ],
        faqs: [
            { question: 'Can it create support tickets?', answer: 'There is no native helpdesk integration, but a post-call webhook can send the transcript and summary to any helpdesk or automation tool that accepts webhooks. It can also post to Slack or log to your CRM.' },
            { question: 'How does escalation work?', answer: 'You describe when to escalate in the agent’s instructions. Those calls are transferred to the number you choose.' },
            { question: 'Where does the agent get its answers?', answer: 'From the knowledge base you upload: FAQs, policies and help articles. Update it any time.' },
            { question: 'Can I see what customers are calling about?', answer: 'Yes. Every call has a transcript and summary, and the analytics dashboard shows volume, duration, outcomes and sentiment.' },
        ],
        examplePrompt: 'A customer support agent that answers questions about returns, shipping and billing from our help articles, and transfers billing disputes or upset callers to a manager.',
    },
};

export const ALL_SOLUTIONS = Object.values(SOLUTIONS);
