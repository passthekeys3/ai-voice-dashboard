'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
    Sparkles, Phone, BarChart3, FlaskConical, Zap, Shield,
    ArrowRight, Check, ChevronDown, Mic, Bot, Users,
    MessageSquare, Globe, Play, Wrench, Stethoscope,
    Building2, Scale, Car, Home,
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

// ─── Simulated Agent Builder ─────────────────────────────────────────────────

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

// ─── Interactive Demo ────────────────────────────────────────────────────────

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
        await new Promise(r => setTimeout(r, 900));
        const result = simulateAgentBuild(userMessage);
        setAgent(result);
        const assistantMessage = `Built **${result.name}** for you.\n\n**Voice:** ${result.voice}\n**Provider:** ${result.provider}\n**Greeting:** "${result.firstMessage}"\n\nThe agent handles calls, collects info, and books appointments. Want to adjust anything?`;
        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
        setIsTyping(false);
    };

    return (
        <div className="relative rounded-2xl border border-white/[0.08] bg-[#0c0c0f] overflow-hidden shadow-[0_0_80px_-20px_rgba(124,58,237,0.15)]">
            {/* Glow effect */}
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-5 h-[580px] relative">
                {/* Chat Side */}
                <div className="lg:col-span-3 flex flex-col border-r border-white/[0.06]">
                    <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-[13px] font-semibold text-white">Agent Builder</p>
                            <p className="text-[11px] text-white/40">Describe what you need</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {messages.length === 0 && (
                            <div className="space-y-5">
                                <div className="text-center pt-8 pb-4">
                                    <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                                        <Bot className="w-5 h-5 text-violet-400" />
                                    </div>
                                    <p className="text-[13px] font-medium text-white/80">What kind of agent do you need?</p>
                                    <p className="text-[11px] text-white/30 mt-1">Pick a template or describe from scratch</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                                    {DEMO_TEMPLATES.map((t) => (
                                        <button
                                            key={t.label}
                                            onClick={() => handleSubmit(t.prompt)}
                                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/30 transition-all text-left group"
                                        >
                                            <t.icon className="w-3.5 h-3.5 text-white/30 group-hover:text-violet-400 shrink-0 transition-colors" />
                                            <span className="text-[12px] text-white/60 group-hover:text-white/80 transition-colors">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-up`}>
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-white/[0.04] border border-white/[0.06] text-white/70'
                                    }`}
                                >
                                    {msg.content.split('\n').map((line, j) => {
                                        const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-medium">$1</strong>');
                                        return <p key={j} className={j > 0 ? 'mt-1' : ''} dangerouslySetInnerHTML={{ __html: boldLine }} />;
                                    })}
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex justify-start animate-fade-up">
                                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3 flex gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 border-t border-white/[0.06]">
                        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }} className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder='Describe your agent...'
                                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/30 transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isTyping}
                                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-[13px] font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>

                {/* Preview Side */}
                <div className="lg:col-span-2 bg-white/[0.015] flex flex-col">
                    <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-white/30" />
                        <p className="text-[13px] font-semibold text-white/60">Agent Preview</p>
                    </div>

                    {!agent ? (
                        <div className="flex-1 flex items-center justify-center p-6">
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                                    <Bot className="w-5 h-5 text-white/15" />
                                </div>
                                <p className="text-[12px] text-white/25">Your agent will appear here</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-5 space-y-3 animate-fade-up">
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                                        <Mic className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold text-white">{agent.name}</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-subtle" />
                                            <span className="text-[11px] text-emerald-400">Ready</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-white/[0.04]">
                                    {[
                                        ['Voice', agent.voice.split(' — ')[0]],
                                        ['Provider', agent.provider],
                                        ['Language', 'English (US)'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-center justify-between text-[11px]">
                                            <span className="text-white/30">{label}</span>
                                            <span className="text-white/60 font-medium">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                <p className="text-[11px] font-medium text-white/30 mb-2">Opening Line</p>
                                <p className="text-[13px] text-white/50 italic leading-relaxed">&ldquo;{agent.firstMessage}&rdquo;</p>
                            </div>

                            <button
                                onClick={() => setShowPrompt(!showPrompt)}
                                className="w-full flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
                            >
                                <span className="text-[11px] font-medium text-white/30">System Prompt</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-white/20 transition-transform ${showPrompt ? 'rotate-180' : ''}`} />
                            </button>
                            {showPrompt && (
                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 -mt-1">
                                    <pre className="text-[11px] text-white/35 whitespace-pre-wrap font-mono leading-relaxed">{agent.prompt}</pre>
                                </div>
                            )}

                            <Link
                                href="/signup"
                                className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white rounded-xl text-[13px] font-semibold transition-all"
                            >
                                <Play className="w-3.5 h-3.5" />
                                Deploy This Agent
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Animated Number ─────────────────────────────────────────────────────────

function AnimatedStat({ value, label, suffix = '' }: { value: string; label: string; suffix?: string }) {
    return (
        <div className="text-center">
            <p className="text-4xl font-bold text-white tracking-tight">{value}<span className="text-violet-400">{suffix}</span></p>
            <p className="text-[13px] text-white/30 mt-2">{label}</p>
        </div>
    );
}

// ─── Feature Block ───────────────────────────────────────────────────────────

function FeatureBlock({
    icon: Icon,
    title,
    description,
    gradient,
}: {
    icon: typeof Sparkles;
    title: string;
    description: string;
    gradient: string;
}) {
    return (
        <div className="group relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
            <div className={`w-10 h-10 rounded-xl ${gradient} flex items-center justify-center mb-4`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-[15px] font-semibold text-white mb-2">{title}</h3>
            <p className="text-[13px] text-white/40 leading-relaxed">{description}</p>
        </div>
    );
}

// ─── FAQ Item ────────────────────────────────────────────────────────────────

function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-white/[0.06]">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left group">
                <span className="text-[14px] font-medium text-white/80 group-hover:text-white transition-colors pr-4">{question}</span>
                <ChevronDown className={`w-4 h-4 text-white/20 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-40 pb-5' : 'max-h-0'}`}>
                <p className="text-[13px] text-white/35 leading-relaxed">{answer}</p>
            </div>
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
        <div className={`relative p-8 rounded-2xl border transition-all duration-300 ${
            highlight
                ? 'border-violet-500/40 bg-violet-500/[0.04]'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]'
        }`}>
            {highlight && (
                <div className="absolute -top-3 left-6 px-3 py-0.5 bg-gradient-to-r from-violet-600 to-violet-400 text-white text-[11px] font-semibold rounded-full">
                    Most Popular
                </div>
            )}
            <p className="text-[12px] font-medium text-white/40 uppercase tracking-wider">{name}</p>
            <p className="text-3xl font-bold text-white mt-2">{price}</p>
            <p className="text-[13px] text-white/30 mt-1">{description}</p>
            <Link
                href="/signup"
                className={`block w-full text-center py-3 rounded-xl text-[13px] font-semibold transition-all mt-6 mb-6 ${
                    highlight
                        ? 'bg-gradient-to-r from-violet-600 to-violet-500 text-white hover:from-violet-500 hover:to-violet-400'
                        : 'bg-white/[0.06] text-white hover:bg-white/[0.1]'
                }`}
            >
                {cta}
            </Link>
            <div className="space-y-3">
                {features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[13px]">
                        <Check className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                        <span className="text-white/40">{f}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Comparison Row ──────────────────────────────────────────────────────────

function CompRow({ feature, us, them }: { feature: string; us: string; them: string }) {
    return (
        <div className="grid grid-cols-3 py-3.5 border-b border-white/[0.04] text-[13px]">
            <span className="text-white/50">{feature}</span>
            <span className="text-center text-white font-medium">{us}</span>
            <span className="text-center text-white/25">{them}</span>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function LandingPage() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handler);
        return () => window.removeEventListener('scroll', handler);
    }, []);

    return (
        <div className="min-h-screen bg-[#09090b] text-white antialiased">
            {/* ── Nav ── */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
                scrolled ? 'bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.06]' : ''
            }`}>
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
                            <Mic className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[15px] font-bold tracking-tight">BuildVoiceAI</span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-[13px] text-white/40">
                        <a href="#demo" className="hover:text-white transition-colors">Demo</a>
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
                        <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login" className="text-[13px] text-white/40 hover:text-white transition-colors hidden sm:block">
                            Log In
                        </Link>
                        <Link href="/signup" className="px-4 py-2 bg-white text-[#09090b] text-[13px] font-semibold rounded-lg hover:bg-white/90 transition-colors">
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="relative pt-32 pb-12 px-6 overflow-hidden">
                {/* Background glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/8 blur-[150px] rounded-full pointer-events-none" />
                <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />

                <div className="max-w-4xl mx-auto text-center relative">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[12px] text-white/50 mb-8">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse-subtle" />
                        4 Voice AI Providers. One Platform.
                    </div>

                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
                        Build voice agents
                        <br />
                        <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
                            that actually work
                        </span>
                    </h1>

                    <p className="mt-6 text-[17px] text-white/35 max-w-xl mx-auto leading-relaxed">
                        Describe what you need in plain English. Deploy to a phone number in one click.
                        Retell, Vapi, Bland, and ElevenLabs under one roof.
                    </p>

                    <div className="mt-10 flex items-center justify-center gap-4">
                        <a
                            href="#demo"
                            className="group px-6 py-3 bg-white text-[#09090b] text-[14px] font-semibold rounded-xl hover:bg-white/90 transition-all flex items-center gap-2"
                        >
                            Try the Builder
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </a>
                        <Link
                            href="/signup"
                            className="px-6 py-3 border border-white/[0.1] text-white/70 text-[14px] font-medium rounded-xl hover:bg-white/[0.04] hover:text-white transition-all"
                        >
                            Start Free Trial
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Providers ── */}
            <section className="py-10 px-6">
                <div className="max-w-3xl mx-auto">
                    <p className="text-center text-[11px] font-medium text-white/20 uppercase tracking-[0.15em] mb-6">Built on the best voice infrastructure</p>
                    <div className="flex flex-wrap items-center justify-center gap-8 text-[14px] font-medium text-white/20">
                        {['Retell', 'Vapi', 'Bland AI', 'ElevenLabs'].map(name => (
                            <span key={name} className="hover:text-white/40 transition-colors cursor-default">{name}</span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Demo ── */}
            <section id="demo" className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-10">
                        <p className="text-[12px] font-medium text-violet-400 uppercase tracking-[0.15em] mb-3">Interactive Demo</p>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">See it in action</h2>
                        <p className="text-[14px] text-white/30 mt-3">Pick a template or describe your agent. No signup required.</p>
                    </div>
                    <AgentBuilderDemo />
                </div>
            </section>

            {/* ── Stats ── */}
            <section className="py-16 px-6 border-y border-white/[0.04]">
                <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
                    <AnimatedStat value="4" label="Voice Providers" />
                    <AnimatedStat value="30" label="Seconds to Build" suffix="s" />
                    <AnimatedStat value="<800" label="Response Latency" suffix="ms" />
                    <AnimatedStat value="99.9" label="Uptime" suffix="%" />
                </div>
            </section>

            {/* ── Features ── */}
            <section id="features" className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <p className="text-[12px] font-medium text-violet-400 uppercase tracking-[0.15em] mb-3">Platform</p>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything agencies need</h2>
                        <p className="text-[14px] text-white/30 mt-3 max-w-lg mx-auto">From building agents to billing clients. One platform, no duct tape.</p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FeatureBlock icon={Sparkles} gradient="bg-gradient-to-br from-violet-500 to-violet-700" title="Natural Language Builder" description="Describe your agent in plain English. AI generates the prompt, picks a voice, and wires up integrations." />
                        <FeatureBlock icon={FlaskConical} gradient="bg-gradient-to-br from-amber-500 to-orange-600" title="A/B Experiments" description="Test different prompts and voices side by side. See which version books more appointments." />
                        <FeatureBlock icon={Shield} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" title="Agent Testing" description="AI generates realistic test scenarios. Validate agent behavior before a single real call." />
                        <FeatureBlock icon={BarChart3} gradient="bg-gradient-to-br from-blue-500 to-blue-700" title="Call Insights" description="Sentiment analysis, topic extraction, objection detection. Know what callers are really saying." />
                        <FeatureBlock icon={Zap} gradient="bg-gradient-to-br from-pink-500 to-rose-600" title="Post-Call Workflows" description="Auto-log to your CRM, book appointments, create contacts, and send follow-ups after every call." />
                        <FeatureBlock icon={Users} gradient="bg-gradient-to-br from-cyan-500 to-cyan-700" title="White-Label Portal" description="Each client gets their own branded login. Your logo, your domain, their agents and analytics." />
                        <FeatureBlock icon={Phone} gradient="bg-gradient-to-br from-indigo-500 to-indigo-700" title="Phone Numbers" description="Buy, assign, and manage numbers directly from the dashboard. Inbound and outbound." />
                        <FeatureBlock icon={MessageSquare} gradient="bg-gradient-to-br from-fuchsia-500 to-fuchsia-700" title="CRM Integrations" description="GoHighLevel, HubSpot, Google Calendar, Calendly, Slack. Connect in two clicks." />
                        <FeatureBlock icon={Globe} gradient="bg-gradient-to-br from-violet-500 to-fuchsia-600" title="Multi-Provider" description="Retell, Vapi, or Bland per agent. Switch providers without rebuilding. Never locked in." />
                    </div>
                </div>
            </section>

            {/* ── Comparison ── */}
            <section className="py-20 px-6">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-10">
                        <p className="text-[12px] font-medium text-violet-400 uppercase tracking-[0.15em] mb-3">Comparison</p>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Built different</h2>
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
                        <div className="grid grid-cols-3 pb-3 border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider">
                            <span className="text-white/25">Feature</span>
                            <span className="text-center text-violet-400">BuildVoiceAI</span>
                            <span className="text-center text-white/15">Others</span>
                        </div>
                        <CompRow feature="Agent Builder" us="Natural Language" them="Manual Config" />
                        <CompRow feature="Providers" us="4 Under One Roof" them="Single Provider" />
                        <CompRow feature="A/B Testing" us="Built-in" them="Not Available" />
                        <CompRow feature="Agent Testing" us="AI Test Suites" them="Manual" />
                        <CompRow feature="Client Portal" us="Full White-Label" them="Shared Login" />
                        <CompRow feature="Insights" us="AI-Powered" them="Basic Logs" />
                        <CompRow feature="CRM" us="Native GHL + HubSpot" them="Zapier" />
                        <CompRow feature="Custom Domain" us="Full Branding" them="Subdomain" />
                    </div>
                </div>
            </section>

            {/* ── How It Works ── */}
            <section className="py-20 px-6 border-y border-white/[0.04]">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-14">
                        <p className="text-[12px] font-medium text-violet-400 uppercase tracking-[0.15em] mb-3">How It Works</p>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Live in minutes</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-12">
                        {[
                            { step: '01', title: 'Describe', desc: 'Tell the builder what your agent should do. Or pick a template.' },
                            { step: '02', title: 'Connect', desc: 'Link your CRM, calendar, and phone numbers. Two clicks each.' },
                            { step: '03', title: 'Deploy', desc: 'Assign a number and go live. Your agent starts taking calls.' },
                        ].map((s) => (
                            <div key={s.step} className="text-center">
                                <p className="text-[48px] font-bold text-white/[0.04] leading-none mb-4">{s.step}</p>
                                <h3 className="text-[16px] font-semibold text-white mb-2">{s.title}</h3>
                                <p className="text-[13px] text-white/30 leading-relaxed">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Pricing ── */}
            <section id="pricing" className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <p className="text-[12px] font-medium text-violet-400 uppercase tracking-[0.15em] mb-3">Pricing</p>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Simple pricing, no surprises</h2>
                        <p className="text-[14px] text-white/30 mt-3">Voice provider costs are pass-through at your negotiated rates.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-5">
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
                            ]}
                        />
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section id="faq" className="py-20 px-6 border-t border-white/[0.04]">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold tracking-tight">Questions</h2>
                    </div>
                    <FAQItem question="Do I need my own Retell/Vapi account?" answer="Yes, you bring your own API keys. This gives you full control over costs and provider relationships. We never touch your provider billing." />
                    <FAQItem question="Can my clients see the platform?" answer="Each client gets their own portal where they only see their agents, calls, and analytics. Fully white-labeled with your branding." />
                    <FAQItem question="How does the agent builder work?" answer="Describe what you want in plain English. Our AI generates a production-ready prompt, picks the right voice, and recommends integrations. Refine through conversation, then deploy with one click." />
                    <FAQItem question="Can I use different providers per agent?" answer="Yes. Run your receptionist on Retell and your outbound agent on Vapi. Mix and match based on what works best." />
                    <FAQItem question="What CRM integrations are supported?" answer="Native GoHighLevel, HubSpot, Google Calendar, Calendly, and Slack. Workflows auto-log calls, create contacts, and book appointments." />
                    <FAQItem question="Is there a free trial?" answer="14 days, no credit card required. You just need a voice provider API key to make test calls." />
                    <FAQItem question="Can I white-label the entire platform?" answer="On Scale, you get custom domains, your logo, your colors. Your clients never see our brand." />
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="py-24 px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-violet-600/5 to-transparent pointer-events-none" />
                <div className="max-w-2xl mx-auto text-center relative">
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Start building today</h2>
                    <p className="text-[14px] text-white/30 mt-4">Your first agent is 30 seconds away. No credit card required.</p>
                    <div className="mt-8">
                        <Link
                            href="/signup"
                            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-white text-[#09090b] text-[14px] font-semibold rounded-xl hover:bg-white/90 transition-all"
                        >
                            Get Started Free
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="border-t border-white/[0.04] py-10 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
                            <Mic className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-[13px] font-semibold text-white/60">BuildVoiceAI</span>
                    </div>
                    <div className="flex items-center gap-6 text-[12px] text-white/25">
                        <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-white/50 transition-colors">Terms</Link>
                        <a href="mailto:support@buildvoiceai.com" className="hover:text-white/50 transition-colors">Contact</a>
                    </div>
                    <p className="text-[11px] text-white/15">&copy; 2025 BuildVoiceAI</p>
                </div>
            </footer>
        </div>
    );
}
