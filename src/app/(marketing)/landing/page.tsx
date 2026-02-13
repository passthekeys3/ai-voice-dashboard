'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
    Sparkles, Phone, BarChart3, FlaskConical, Zap, Shield,
    ArrowRight, Check, ChevronDown, Mic, Bot, Users,
    MessageSquare, Globe, Play, Clock, TrendingUp,
    Building2, Wrench, Stethoscope, Scale, Car, Home,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DemoMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface DemoAgent {
    name: string;
    prompt: string;
    firstMessage: string;
    voice: string;
    provider: string;
}

// ─── Demo Templates ──────────────────────────────────────────────────────────

const DEMO_TEMPLATES = [
    {
        icon: Wrench,
        label: 'Home Services',
        prompt: 'A friendly receptionist for a plumbing company that books emergency and routine appointments',
    },
    {
        icon: Stethoscope,
        label: 'Dental Office',
        prompt: 'A professional receptionist for a dental practice that handles appointment scheduling and insurance questions',
    },
    {
        icon: Building2,
        label: 'Real Estate',
        prompt: 'A real estate assistant that qualifies buyer leads, schedules showings, and captures property preferences',
    },
    {
        icon: Scale,
        label: 'Law Firm',
        prompt: 'A law firm intake specialist that screens potential clients, captures case details, and schedules consultations',
    },
    {
        icon: Car,
        label: 'Auto Shop',
        prompt: 'An auto repair shop receptionist that books service appointments and provides basic repair estimates',
    },
    {
        icon: Home,
        label: 'Insurance',
        prompt: 'An insurance agency assistant that handles policy inquiries, captures quote requests, and schedules agent callbacks',
    },
];

// ─── Simulated Agent Builder Demo ────────────────────────────────────────────

function simulateAgentBuild(description: string): DemoAgent {
    const lower = description.toLowerCase();

    let name = 'AI Assistant';
    let voice = 'Sarah — Friendly, Professional';
    const provider = 'Retell';

    if (lower.includes('plumb') || lower.includes('hvac') || lower.includes('home service')) {
        name = 'Mike — Service Dispatcher';
        voice = 'Mike — Warm, Confident';
    } else if (lower.includes('dent') || lower.includes('medical') || lower.includes('health')) {
        name = 'Sarah — Patient Coordinator';
        voice = 'Sarah — Warm, Professional';
    } else if (lower.includes('real estate') || lower.includes('property') || lower.includes('showing')) {
        name = 'Jessica — Buyer Specialist';
        voice = 'Jessica — Energetic, Approachable';
    } else if (lower.includes('law') || lower.includes('legal') || lower.includes('attorney')) {
        name = 'James — Legal Intake';
        voice = 'James — Authoritative, Calm';
    } else if (lower.includes('auto') || lower.includes('car') || lower.includes('repair')) {
        name = 'Tony — Service Advisor';
        voice = 'Tony — Friendly, Knowledgeable';
    } else if (lower.includes('insurance') || lower.includes('policy') || lower.includes('quote')) {
        name = 'Rachel — Insurance Advisor';
        voice = 'Rachel — Reassuring, Clear';
    } else if (lower.includes('restaurant') || lower.includes('food')) {
        name = 'Lisa — Host';
        voice = 'Lisa — Cheerful, Efficient';
    } else if (lower.includes('sales') || lower.includes('outbound') || lower.includes('lead')) {
        name = 'Alex — Sales Rep';
        voice = 'Alex — Energetic, Persuasive';
    }

    const prompt = `You are ${name.split(' — ')[0]}, an AI voice agent. ${description}. 
    
Your responsibilities:
- Answer calls professionally and warmly
- Understand the caller's needs through natural conversation  
- Collect relevant information (name, phone, details of their request)
- Schedule appointments when appropriate
- Handle common questions about services and availability
- Transfer to a human when the situation requires it

Guidelines:
- Keep responses concise and conversational
- Confirm important details by repeating them back
- Always be helpful, never pushy
- If unsure about something, offer to have someone follow up`;

    const firstMessage = `Hi there! This is ${name.split(' — ')[0]}. How can I help you today?`;

    return { name, prompt, firstMessage, voice, provider };
}

// ─── Interactive Demo Component ──────────────────────────────────────────────

function AgentBuilderDemo() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<DemoMessage[]>([]);
    const [agent, setAgent] = useState<DemoAgent | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (text: string) => {
        if (!text.trim() || isTyping) return;

        const userMessage = text.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsTyping(true);

        // Simulate streaming delay
        await new Promise(r => setTimeout(r, 800));

        const result = simulateAgentBuild(userMessage);
        setAgent(result);

        const assistantMessage = `I've built **${result.name}** for you. Here's what I set up:

• **Voice:** ${result.voice}
• **Provider:** ${result.provider}
• **Opening line:** "${result.firstMessage}"

The agent will handle calls naturally, collect caller info, and book appointments. Want me to adjust the personality, add specific business hours, or change anything?`;

        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
        setIsTyping(false);
    };

    const handleTemplate = (prompt: string) => {
        handleSubmit(prompt);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl h-[560px]">
            {/* Chat Side */}
            <div className="lg:col-span-3 flex flex-col border-r border-slate-200 dark:border-slate-700">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">AI Agent Builder</p>
                        <p className="text-xs text-slate-500">Describe your agent and watch it come to life</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {messages.length === 0 && (
                        <div className="space-y-4">
                            <div className="text-center py-6">
                                <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-3">
                                    <Bot className="w-6 h-6 text-violet-600" />
                                </div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Build your AI voice agent</p>
                                <p className="text-xs text-slate-500 mt-1">Pick a template or describe what you need</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {DEMO_TEMPLATES.map((t) => (
                                    <button
                                        key={t.label}
                                        onClick={() => handleTemplate(t.prompt)}
                                        className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-all text-left group"
                                    >
                                        <t.icon className="w-4 h-4 text-slate-400 group-hover:text-violet-600 shrink-0" />
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                    msg.role === 'user'
                                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                {msg.content.split('\n').map((line, j) => {
                                    const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                                    return <p key={j} className={j > 0 ? 'mt-1' : ''} dangerouslySetInnerHTML={{ __html: boldLine }} />;
                                })}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3 flex gap-1">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }}
                        className="flex gap-2"
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder='Try "A receptionist for my HVAC company..."'
                            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isTyping}
                            className="px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </div>

            {/* Preview Side */}
            <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-800/50 flex flex-col">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Agent Preview</p>
                </div>

                {!agent ? (
                    <div className="flex-1 flex items-center justify-center p-6">
                        <div className="text-center">
                            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
                                <Bot className="w-6 h-6 text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-500">No agent configured yet</p>
                            <p className="text-xs text-slate-400 mt-1">Start chatting to build your agent</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {/* Agent Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <Mic className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{agent.name}</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        <span className="text-xs text-green-600">Active</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pt-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Voice</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{agent.voice.split(' — ')[0]}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Provider</span>
                                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">{agent.provider}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Language</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">English</span>
                                </div>
                            </div>
                        </div>

                        {/* First Message */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                            <p className="text-xs font-medium text-slate-500 mb-2">Opening Line</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{agent.firstMessage}"</p>
                        </div>

                        {/* System Prompt Toggle */}
                        <button
                            onClick={() => setShowPrompt(!showPrompt)}
                            className="w-full flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                            <span className="text-xs font-medium text-slate-500">System Prompt</span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPrompt ? 'rotate-180' : ''}`} />
                        </button>
                        {showPrompt && (
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 -mt-2">
                                <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">{agent.prompt}</pre>
                            </div>
                        )}

                        {/* CTA */}
                        <Link
                            href="/signup"
                            className="flex items-center justify-center gap-2 w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors"
                        >
                            <Play className="w-4 h-4" />
                            Deploy This Agent
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Feature Card ────────────────────────────────────────────────────────────

function FeatureCard({ icon: Icon, title, description }: { icon: typeof Sparkles; title: string; description: string }) {
    return (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-violet-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1.5">{title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
    );
}

// ─── Pricing Card ────────────────────────────────────────────────────────────

function PricingCard({
    name, price, description, features, highlight, cta,
}: {
    name: string; price: string; description: string; features: string[]; highlight?: boolean; cta: string;
}) {
    return (
        <div className={`p-8 rounded-2xl border ${highlight ? 'border-violet-500 ring-1 ring-violet-500 dark:border-violet-400 dark:ring-violet-400' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-800/50 relative`}>
            {highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-violet-600 text-white text-xs font-semibold rounded-full">
                    Most Popular
                </div>
            )}
            <p className="text-sm font-medium text-slate-500 mb-1">{name}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{price}</p>
            <p className="text-sm text-slate-500 mb-6">{description}</p>
            <Link
                href="/signup"
                className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-colors mb-6 ${
                    highlight
                        ? 'bg-violet-600 text-white hover:bg-violet-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                }`}
            >
                {cta}
            </Link>
            <ul className="space-y-3">
                {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        {f}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Stat ────────────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: string; label: string }) {
    return (
        <div className="text-center">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-sm text-slate-500 mt-1">{label}</p>
        </div>
    );
}

// ─── Comparison Row ──────────────────────────────────────────────────────────

function ComparisonRow({ feature, us, them }: { feature: string; us: string; them: string }) {
    return (
        <div className="grid grid-cols-3 py-3 border-b border-slate-100 dark:border-slate-800 text-sm">
            <span className="text-slate-700 dark:text-slate-300 font-medium">{feature}</span>
            <span className="text-center text-violet-600 font-semibold">{us}</span>
            <span className="text-center text-slate-400">{them}</span>
        </div>
    );
}

// ─── Provider Logo ───────────────────────────────────────────────────────────

function ProviderBadge({ name }: { name: string }) {
    return (
        <div className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
            <Globe className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{name}</span>
        </div>
    );
}

// ─── FAQ Item ────────────────────────────────────────────────────────────────

function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-slate-200 dark:border-slate-700">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between py-5 text-left"
            >
                <span className="text-sm font-semibold text-slate-900 dark:text-white pr-4">{question}</span>
                <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <p className="text-sm text-slate-500 pb-5 leading-relaxed">{answer}</p>
            )}
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-slate-950">
            {/* Nav */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                            <Mic className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">BuildVoiceAI</span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-sm text-slate-600 dark:text-slate-400">
                        <a href="#demo" className="hover:text-slate-900 dark:hover:text-white transition-colors">Demo</a>
                        <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors">Pricing</a>
                        <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">FAQ</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                            Log In
                        </Link>
                        <Link href="/signup" className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors">
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-32 pb-8 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium mb-6">
                        <Sparkles className="w-3 h-3" />
                        4 Voice AI Providers. One Dashboard.
                    </div>
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white tracking-tight leading-[1.1]">
                        Build voice AI agents<br />
                        <span className="text-violet-600">in 30 seconds</span>
                    </h1>
                    <p className="mt-5 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                        Describe what you need in plain English. We generate the agent, pick the perfect voice, and wire up your CRM. Deploy to a phone number in one click.
                    </p>
                    <div className="mt-8 flex items-center justify-center gap-4">
                        <a href="#demo" className="px-6 py-3 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors flex items-center gap-2">
                            Try the Builder
                            <ArrowRight className="w-4 h-4" />
                        </a>
                        <Link href="/signup" className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            Start Free Trial
                        </Link>
                    </div>
                </div>
            </section>

            {/* Interactive Demo */}
            <section id="demo" className="py-16 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Try It Right Now</h2>
                        <p className="text-sm text-slate-500 mt-2">Pick a template or describe your agent. No signup required.</p>
                    </div>
                    <AgentBuilderDemo />
                </div>
            </section>

            {/* Providers */}
            <section className="py-12 px-6 border-y border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <div className="max-w-4xl mx-auto">
                    <p className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider mb-6">Powered by the best voice AI infrastructure</p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <ProviderBadge name="Retell" />
                        <ProviderBadge name="Vapi" />
                        <ProviderBadge name="Bland AI" />
                        <ProviderBadge name="ElevenLabs" />
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
                    <Stat value="4" label="Voice Providers" />
                    <Stat value="30s" label="Agent Build Time" />
                    <Stat value="<800ms" label="Response Latency" />
                    <Stat value="24/7" label="Always Available" />
                </div>
            </section>

            {/* Features */}
            <section id="features" className="py-16 px-6 bg-slate-50 dark:bg-slate-900/50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Everything You Need to Run a Voice AI Business</h2>
                        <p className="text-sm text-slate-500 mt-3 max-w-xl mx-auto">From building agents to billing clients, all in one platform.</p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <FeatureCard
                            icon={Sparkles}
                            title="Natural Language Agent Builder"
                            description="Describe what your agent should do in plain English. AI generates the system prompt, picks a voice, and recommends integrations."
                        />
                        <FeatureCard
                            icon={FlaskConical}
                            title="A/B Experiments"
                            description="Test different prompts, voices, and configurations side by side. See which version converts more callers into appointments."
                        />
                        <FeatureCard
                            icon={Shield}
                            title="Agent Testing Suite"
                            description="Validate agent behavior before going live. AI generates realistic test scenarios and scores responses automatically."
                        />
                        <FeatureCard
                            icon={BarChart3}
                            title="AI Call Insights"
                            description="Sentiment analysis, topic extraction, and objection detection across every call. Know what callers are really thinking."
                        />
                        <FeatureCard
                            icon={Zap}
                            title="Post-Call Workflows"
                            description="Automatically log calls to your CRM, book appointments, create contacts, and send follow-ups. No Zapier needed."
                        />
                        <FeatureCard
                            icon={Users}
                            title="White-Label Client Portal"
                            description="Give each client their own branded login. They see only their agents, calls, and analytics. Your brand, their experience."
                        />
                        <FeatureCard
                            icon={Phone}
                            title="Phone Number Management"
                            description="Buy, assign, and manage phone numbers directly from the dashboard. Inbound and outbound on the same number."
                        />
                        <FeatureCard
                            icon={MessageSquare}
                            title="CRM Integrations"
                            description="Native GoHighLevel, HubSpot, Google Calendar, Calendly, and Slack integrations. Connect in two clicks."
                        />
                        <FeatureCard
                            icon={Globe}
                            title="Multi-Provider Freedom"
                            description="Use Retell, Vapi, or Bland under one roof. Switch providers per agent. Never locked in to a single vendor."
                        />
                    </div>
                </div>
            </section>

            {/* Comparison */}
            <section className="py-16 px-6">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Why Build Voice AI?</h2>
                    </div>
                    <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-8">
                        <div className="grid grid-cols-3 pb-3 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wider text-slate-400">
                            <span>Feature</span>
                            <span className="text-center text-violet-600">Build Voice AI</span>
                            <span className="text-center">Others</span>
                        </div>
                        <ComparisonRow feature="Agent Builder" us="Natural Language" them="Manual Config" />
                        <ComparisonRow feature="Providers" us="4 (Retell, Vapi, Bland, EL)" them="1 Provider" />
                        <ComparisonRow feature="A/B Testing" us="Built-in" them="Not Available" />
                        <ComparisonRow feature="Agent Testing" us="AI Test Suites" them="Manual Testing" />
                        <ComparisonRow feature="Client Portal" us="White-Label" them="Shared Dashboard" />
                        <ComparisonRow feature="Call Insights" us="AI-Powered" them="Basic Logs" />
                        <ComparisonRow feature="CRM Integration" us="Native (GHL, HubSpot)" them="Zapier Required" />
                        <ComparisonRow feature="Custom Domains" us="Full White-Label" them="Subdomain Only" />
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-16 px-6 bg-slate-50 dark:bg-slate-900/50">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Up and Running in Minutes</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: '1', icon: MessageSquare, title: 'Describe Your Agent', desc: 'Tell the AI builder what you need. Pick a template or describe from scratch.' },
                            { step: '2', icon: Zap, title: 'Connect Your Stack', desc: 'Link your CRM, calendar, and phone numbers. Two clicks per integration.' },
                            { step: '3', icon: Phone, title: 'Go Live', desc: 'Assign a phone number and your agent starts taking calls immediately.' },
                        ].map((s) => (
                            <div key={s.step} className="text-center">
                                <div className="w-12 h-12 rounded-full bg-violet-600 text-white text-lg font-bold flex items-center justify-center mx-auto mb-4">
                                    {s.step}
                                </div>
                                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{s.title}</h3>
                                <p className="text-sm text-slate-500">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="py-16 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Simple, Transparent Pricing</h2>
                        <p className="text-sm text-slate-500 mt-3">Pay for the platform. Voice provider costs are pass-through at your negotiated rates.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        <PricingCard
                            name="Starter"
                            price="$97/mo"
                            description="For agencies getting started"
                            cta="Start Free Trial"
                            features={[
                                'Up to 5 agents',
                                '1 voice provider',
                                'Agent builder',
                                'Call analytics',
                                'Email support',
                            ]}
                        />
                        <PricingCard
                            name="Growth"
                            price="$197/mo"
                            description="For growing agencies"
                            cta="Start Free Trial"
                            highlight
                            features={[
                                'Up to 25 agents',
                                'All voice providers',
                                'A/B experiments',
                                'Agent testing suites',
                                'AI call insights',
                                'Client portal (5 clients)',
                                'CRM integrations',
                                'Priority support',
                            ]}
                        />
                        <PricingCard
                            name="Scale"
                            price="$397/mo"
                            description="For established agencies"
                            cta="Contact Sales"
                            features={[
                                'Unlimited agents',
                                'All voice providers',
                                'Everything in Growth',
                                'Unlimited clients',
                                'Custom domain white-label',
                                'Stripe Connect billing',
                                'Dedicated account manager',
                                'Custom onboarding',
                            ]}
                        />
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="py-16 px-6 bg-slate-50 dark:bg-slate-900/50">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-10">Frequently Asked Questions</h2>
                    <FAQItem
                        question="Do I need my own Retell/Vapi/Bland account?"
                        answer="Yes, you bring your own API keys. This gives you full control over your costs and provider relationship. We never touch your provider billing. You pay them directly at whatever rate you've negotiated."
                    />
                    <FAQItem
                        question="Can my clients see the platform or just their agents?"
                        answer="Each client gets their own portal login where they only see their assigned agents, calls, and analytics. They never see your other clients or your agency-level settings. The portal is fully white-labeled with your branding."
                    />
                    <FAQItem
                        question="How does the AI agent builder work?"
                        answer="You describe what you want in plain English, like 'a receptionist for a plumbing company that books emergency appointments.' Our AI generates a production-ready system prompt, picks the right voice characteristics, and recommends CRM integrations. You can refine it through conversation, then deploy with one click."
                    />
                    <FAQItem
                        question="Can I switch voice providers per agent?"
                        answer="Absolutely. Each agent can use a different provider. Run your dental receptionist on Retell and your outbound sales agent on Vapi. Mix and match based on what works best for each use case."
                    />
                    <FAQItem
                        question="What CRM integrations are supported?"
                        answer="We have native integrations with GoHighLevel, HubSpot, Google Calendar, Calendly, and Slack. Workflows can automatically log calls, create contacts, book appointments, and send notifications after every call."
                    />
                    <FAQItem
                        question="Is there a free trial?"
                        answer="Yes, every plan comes with a 14-day free trial. No credit card required to start. You'll need your own voice provider API key to make test calls."
                    />
                    <FAQItem
                        question="Can I white-label the entire platform?"
                        answer="On the Scale plan, you get full white-label with custom domains, your logo, your colors, and your favicon. Your clients will never know our platform exists."
                    />
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Ready to build your voice AI business?</h2>
                    <p className="text-slate-500 mt-3">Start building agents in 30 seconds. No credit card required.</p>
                    <div className="mt-8">
                        <Link href="/signup" className="px-8 py-3.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors inline-flex items-center gap-2">
                            Get Started Free
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-800 py-12 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                            <Mic className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">BuildVoiceAI</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-slate-500">
                        <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</Link>
                        <a href="mailto:support@buildvoiceai.com" className="hover:text-slate-900 dark:hover:text-white transition-colors">Contact</a>
                    </div>
                    <p className="text-xs text-slate-400">© 2025 BuildVoiceAI. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
