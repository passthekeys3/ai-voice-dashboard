'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
    Sparkles, Phone, ArrowRight, Check, ChevronDown, Mic, Bot,
    Wrench, Stethoscope, Building2, Scale, Car, Home, Play,
    BarChart3, FlaskConical, Shield, Zap, Users, Layers,
    Globe, MessageSquare, TrendingUp, PhoneCall, Settings,
} from 'lucide-react';

// ─── Types & Data ────────────────────────────────────────────────────────────

interface DemoMessage { role: 'user' | 'assistant'; content: string; }
interface DemoAgent { name: string; prompt: string; firstMessage: string; voice: string; provider: string; }

const TEMPLATES = [
    { icon: Wrench, label: 'Home Services', prompt: 'A friendly receptionist for a plumbing company that books emergency and routine appointments' },
    { icon: Stethoscope, label: 'Dental Office', prompt: 'A professional receptionist for a dental practice that handles appointment scheduling and insurance questions' },
    { icon: Building2, label: 'Real Estate', prompt: 'A real estate assistant that qualifies buyer leads, schedules showings, and captures property preferences' },
    { icon: Scale, label: 'Law Firm', prompt: 'A law firm intake specialist that screens potential clients and schedules consultations' },
    { icon: Car, label: 'Auto Shop', prompt: 'An auto repair shop receptionist that books service appointments and provides estimates' },
    { icon: Home, label: 'Insurance', prompt: 'An insurance agency assistant that handles policy inquiries and schedules agent callbacks' },
];

function buildAgent(desc: string): DemoAgent {
    const d = desc.toLowerCase();
    const map: Record<string, [string, string]> = {
        plumb: ['Mike — Service Dispatcher', 'Mike — Warm, Confident'],
        hvac: ['Mike — Service Dispatcher', 'Mike — Warm, Confident'],
        dent: ['Sarah — Patient Coordinator', 'Sarah — Warm, Professional'],
        medical: ['Sarah — Patient Coordinator', 'Sarah — Warm, Professional'],
        'real estate': ['Jessica — Buyer Specialist', 'Jessica — Energetic, Approachable'],
        law: ['James — Legal Intake', 'James — Authoritative, Calm'],
        auto: ['Tony — Service Advisor', 'Tony — Friendly, Knowledgeable'],
        insurance: ['Rachel — Insurance Advisor', 'Rachel — Reassuring, Clear'],
        sales: ['Alex — Sales Rep', 'Alex — Energetic, Persuasive'],
    };
    const match = Object.entries(map).find(([k]) => d.includes(k));
    const [name, voice] = match?.[1] ?? ['AI Assistant', 'Sarah — Professional'];
    const firstName = name.split(' — ')[0];
    return {
        name, voice, provider: 'Retell',
        firstMessage: `Hi there! This is ${firstName}. How can I help you today?`,
        prompt: `You are ${firstName}, an AI voice agent. ${desc}.\n\nResponsibilities:\n- Answer calls professionally\n- Understand caller needs through conversation\n- Collect name, phone, and request details\n- Schedule appointments when appropriate\n- Transfer to a human when needed\n\nGuidelines:\n- Be concise and conversational\n- Confirm important details\n- Be helpful, never pushy`,
    };
}

// ─── Animated Number ─────────────────────────────────────────────────────────

function AnimatedStat({ value, suffix = '', label }: { value: string; suffix?: string; label: string }) {
    const [visible, setVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.3 });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return (
        <div ref={ref} className="text-center">
            <div className={`text-4xl sm:text-5xl font-semibold text-gray-900 tabular-nums transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                {value}{suffix}
            </div>
            <p className={`text-sm text-gray-500 mt-2 transition-all duration-700 delay-200 ${visible ? 'opacity-100' : 'opacity-0'}`}>{label}</p>
        </div>
    );
}

// ─── Interactive Demo ────────────────────────────────────────────────────────

function AgentDemo() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<DemoMessage[]>([]);
    const [agent, setAgent] = useState<DemoAgent | null>(null);
    const [typing, setTyping] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const send = async (text: string) => {
        if (!text.trim() || typing) return;
        setInput('');
        setMessages(p => [...p, { role: 'user', content: text.trim() }]);
        setTyping(true);
        await new Promise(r => setTimeout(r, 1200));
        const a = buildAgent(text);
        setAgent(a);
        setMessages(p => [...p, {
            role: 'assistant',
            content: `Built **${a.name}**.\n\n**Voice:** ${a.voice}\n**Provider:** ${a.provider}\n**Greeting:** "${a.firstMessage}"\n\nReady to deploy. Want to adjust anything?`,
        }]);
        setTyping(false);
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-xl shadow-gray-200/50">
            <div className="grid grid-cols-1 lg:grid-cols-5 h-[520px]">
                {/* Chat */}
                <div className="lg:col-span-3 flex flex-col border-r border-gray-100">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">Agent Builder</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/50">
                        {messages.length === 0 && (
                            <div className="pt-6 pb-2">
                                <p className="text-center text-sm text-gray-400 mb-6">Pick a template or describe what you need</p>
                                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                                    {TEMPLATES.map(t => (
                                        <button key={t.label} onClick={() => send(t.prompt)}
                                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-white bg-white/80 transition-all text-left group">
                                            <t.icon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 shrink-0 transition-colors" />
                                            <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                    m.role === 'user'
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-white border border-gray-200 text-gray-600 shadow-sm'
                                }`}>
                                    {m.content.split('\n').map((line, j) => (
                                        <p key={j} className={j > 0 ? 'mt-1' : ''} dangerouslySetInnerHTML={{
                                            __html: line.replace(/\*\*(.*?)\*\*/g, `<strong class="${m.role === 'user' ? 'text-white' : 'text-gray-900'}">$1</strong>`)
                                        }} />
                                    ))}
                                </div>
                            </div>
                        ))}
                        {typing && (
                            <div className="flex gap-1.5 px-4 py-3 bg-white border border-gray-200 rounded-2xl w-fit shadow-sm">
                                {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>
                    <div className="p-4 border-t border-gray-100 bg-white">
                        <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
                            <input value={input} onChange={e => setInput(e.target.value)} placeholder='Describe your agent...'
                                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all" />
                            <button type="submit" disabled={!input.trim() || typing}
                                className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl disabled:opacity-30 transition-colors">
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
                {/* Preview */}
                <div className="lg:col-span-2 bg-gray-50/50 flex flex-col">
                    <div className="px-5 py-3.5 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-400">Preview</span>
                    </div>
                    {!agent ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-xs text-gray-300">Your agent appears here</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-5 space-y-3">
                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center">
                                        <Mic className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{agent.name}</p>
                                        <p className="text-xs text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Ready</p>
                                    </div>
                                </div>
                                <div className="space-y-2 pt-3 border-t border-gray-100 text-xs">
                                    {[['Voice', agent.voice.split(' — ')[0]], ['Provider', agent.provider], ['Language', 'English']].map(([l,v]) => (
                                        <div key={l} className="flex justify-between"><span className="text-gray-400">{l}</span><span className="text-gray-600">{v}</span></div>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <p className="text-xs text-gray-400 mb-1.5">Opening Line</p>
                                <p className="text-xs text-gray-600 italic">&ldquo;{agent.firstMessage}&rdquo;</p>
                            </div>
                            <button onClick={() => setShowPrompt(!showPrompt)}
                                className="w-full flex justify-between items-center rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors shadow-sm">
                                <span className="text-xs text-gray-400">System Prompt</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform ${showPrompt ? 'rotate-180' : ''}`} />
                            </button>
                            {showPrompt && (
                                <div className="rounded-xl border border-gray-200 bg-white p-4 -mt-1 shadow-sm">
                                    <pre className="text-[10px] text-gray-500 whitespace-pre-wrap font-mono leading-relaxed">{agent.prompt}</pre>
                                </div>
                            )}
                            <Link href="/signup" className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">
                                <Play className="w-3.5 h-3.5" /> Deploy This Agent
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Feature Card ────────────────────────────────────────────────────────────

function FeatureCard({ icon: Icon, title, description }: { icon: typeof Zap; title: string; description: string }) {
    return (
        <div className="group p-6 rounded-2xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/80 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-gray-900 flex items-center justify-center mb-4 transition-colors duration-300">
                <Icon className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors duration-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
        </div>
    );
}

// ─── Product Mock: Dashboard ─────────────────────────────────────────────────

function MockDashboard() {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xl shadow-gray-200/60">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/80">
                <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-gray-200" />
                    <span className="w-3 h-3 rounded-full bg-gray-200" />
                    <span className="w-3 h-3 rounded-full bg-gray-200" />
                </div>
                <div className="flex-1 mx-8"><div className="h-5 w-52 mx-auto rounded-md bg-gray-100" /></div>
            </div>
            <div className="flex">
                {/* Sidebar */}
                <div className="w-48 border-r border-gray-100 p-3 space-y-0.5 hidden sm:block bg-gray-50/40">
                    {['Dashboard', 'Agents', 'Calls', 'Analytics', 'Insights', 'Testing'].map((item, i) => (
                        <div key={item} className={`px-3 py-2 rounded-lg text-xs font-medium ${i === 0 ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}>{item}</div>
                    ))}
                </div>
                {/* Main */}
                <div className="flex-1 p-5 space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'Total Calls', value: '2,847', change: '+12%' },
                            { label: 'Avg Duration', value: '3:24', change: '+5%' },
                            { label: 'Booking Rate', value: '68%', change: '+8%' },
                            { label: 'Active Agents', value: '12', change: '' },
                        ].map(s => (
                            <div key={s.label} className="rounded-xl border border-gray-100 p-3">
                                <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
                                <div className="flex items-baseline gap-1.5 mt-1">
                                    <span className="text-lg font-semibold text-gray-900">{s.value}</span>
                                    {s.change && <span className="text-[10px] text-emerald-600 font-medium">{s.change}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Agent list */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-gray-900">Your Agents</span>
                            <div className="px-3 py-1.5 rounded-lg bg-gray-900 text-[10px] text-white font-medium">+ New Agent</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            {[
                                { name: 'HVAC Dispatcher', calls: '142', status: 'active', provider: 'retell' },
                                { name: 'Dental Receptionist', calls: '89', status: 'active', provider: 'vapi' },
                                { name: 'Legal Intake', calls: '56', status: 'active', provider: 'retell' },
                                { name: 'Sales Qualifier', calls: '23', status: 'paused', provider: 'bland' },
                            ].map(a => (
                                <div key={a.name} className="rounded-xl border border-gray-100 bg-white p-3 hover:border-gray-200 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-gray-700">{a.name}</span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{a.provider}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-400">{a.calls} calls</span>
                                        <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'active' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Provider Logos ──────────────────────────────────────────────────────────

function ProviderBar() {
    return (
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14">
            {['Retell', 'Vapi', 'Bland AI', 'ElevenLabs'].map(name => (
                <div key={name} className="flex items-center gap-2 text-gray-300 hover:text-gray-500 transition-colors">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm font-medium tracking-tight">{name}</span>
                </div>
            ))}
        </div>
    );
}

// ─── How It Works ────────────────────────────────────────────────────────────

function HowItWorks() {
    const steps = [
        { num: '01', title: 'Connect Your Provider', desc: 'Add your Retell, Vapi, Bland, or ElevenLabs API key. Takes 30 seconds.' },
        { num: '02', title: 'Build Your Agent', desc: 'Describe what you need in plain English. The AI builder creates a production-ready agent.' },
        { num: '03', title: 'Test and Deploy', desc: 'Run AI-generated test scenarios. When it passes, deploy to a phone number with one click.' },
    ];
    return (
        <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
                <div key={s.num} className="relative">
                    {i < 2 && <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-gray-200 to-transparent -translate-x-8" />}
                    <div className="text-5xl font-bold text-gray-100 mb-4">{s.num}</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
            ))}
        </div>
    );
}

// ─── Comparison Table ────────────────────────────────────────────────────────

function ComparisonTable() {
    const rows = [
        ['Multi-provider support', true, false, false],
        ['Natural language agent builder', true, false, false],
        ['AI-powered call testing', true, false, false],
        ['A/B experiments', true, false, false],
        ['White-label client portals', true, true, false],
        ['CRM integrations', true, true, true],
        ['Call analytics', true, true, true],
    ];
    return (
        <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <div className="grid grid-cols-4 text-sm border-b border-gray-100 bg-gray-50">
                <div className="p-4 font-medium text-gray-500">Feature</div>
                <div className="p-4 font-semibold text-gray-900 text-center">BuildVoiceAI</div>
                <div className="p-4 font-medium text-gray-400 text-center">White-label resellers</div>
                <div className="p-4 font-medium text-gray-400 text-center">Direct providers</div>
            </div>
            {rows.map(([feature, us, resellers, direct], i) => (
                <div key={i} className={`grid grid-cols-4 text-sm ${i < rows.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="p-4 text-gray-600">{feature as string}</div>
                    <div className="p-4 text-center">{us ? <Check className="w-4 h-4 text-gray-900 mx-auto" /> : <span className="text-gray-300">—</span>}</div>
                    <div className="p-4 text-center">{resellers ? <Check className="w-4 h-4 text-gray-300 mx-auto" /> : <span className="text-gray-300">—</span>}</div>
                    <div className="p-4 text-center">{direct ? <Check className="w-4 h-4 text-gray-300 mx-auto" /> : <span className="text-gray-300">—</span>}</div>
                </div>
            ))}
        </div>
    );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-gray-100">
            <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center py-5 text-left group">
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 pr-4 transition-colors">{q}</span>
                <ChevronDown className={`w-4 h-4 text-gray-300 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <p className="text-sm text-gray-500 pb-5 leading-relaxed">{a}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const h = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', h);
        return () => window.removeEventListener('scroll', h);
    }, []);

    return (
        <div className="min-h-screen bg-white text-gray-900 antialiased selection:bg-gray-900/10">

            {/* ── Nav ── */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
                scrolled ? 'bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm' : 'bg-transparent'
            }`}>
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                            <Mic className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-base font-bold tracking-tight">BuildVoiceAI</span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
                        <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How It Works</a>
                        <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
                        <a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:block">Log In</Link>
                        <Link href="/signup" className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="relative pt-32 sm:pt-40 pb-8 px-6 overflow-hidden">
                {/* Subtle gradient */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-gray-50 to-transparent rounded-full blur-3xl pointer-events-none" />

                <div className="max-w-6xl mx-auto relative">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-xs text-gray-500 font-medium mb-8">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Now supporting Retell, Vapi, Bland, and ElevenLabs
                        </div>
                        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
                            The platform for{' '}
                            <span className="bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 bg-clip-text text-transparent">
                                voice AI agencies
                            </span>
                        </h1>
                        <p className="mt-6 text-lg sm:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
                            Build, test, and deploy voice agents across four providers from one dashboard. White-label it for your clients.
                        </p>
                        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/signup" className="group w-full sm:w-auto px-8 py-3.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10">
                                Start Building Free <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                            <a href="#demo" className="w-full sm:w-auto px-8 py-3.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2">
                                <Play className="w-3.5 h-3.5" /> Try the demo
                            </a>
                        </div>
                    </div>

                    {/* Product screenshot */}
                    <div className="mt-16 sm:mt-20">
                        <MockDashboard />
                    </div>
                </div>
            </section>

            {/* ── Providers ── */}
            <section className="py-16 px-6 border-b border-gray-100">
                <p className="text-center text-xs text-gray-400 font-medium uppercase tracking-widest mb-8">One dashboard. Four providers.</p>
                <ProviderBar />
            </section>

            {/* ── Stats ── */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
                    <AnimatedStat value="4" label="Voice providers" />
                    <AnimatedStat value="30" suffix="s" label="First agent deploy" />
                    <AnimatedStat value="99.9" suffix="%" label="Uptime SLA" />
                    <AnimatedStat value="0" suffix="¢" label="Platform markup on calls" />
                </div>
            </section>

            {/* ── Demo ── */}
            <section id="demo" className="py-24 px-6 bg-gray-50 border-y border-gray-100">
                <div className="max-w-5xl mx-auto">
                    <div className="max-w-xl mb-12">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Agent Builder</p>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Describe it. Deploy it.</h2>
                        <p className="text-base text-gray-500 mt-4 leading-relaxed">
                            Tell the builder what your agent should do in plain English. It generates the prompt, picks a voice, and wires up your CRM.
                        </p>
                    </div>
                    <AgentDemo />
                </div>
            </section>

            {/* ── Features Grid ── */}
            <section id="features" className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="max-w-xl mb-16">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Features</p>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything you need to run a voice AI agency</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FeatureCard icon={Sparkles} title="Natural Language Builder" description="Describe your agent in plain English. AI generates the prompt, picks a voice, and configures the workflow." />
                        <FeatureCard icon={Layers} title="Multi-Provider" description="Run agents across Retell, Vapi, Bland, and ElevenLabs. Switch providers without rebuilding." />
                        <FeatureCard icon={FlaskConical} title="AI Test Suites" description="Simulate real calls with AI personas. Catch issues before they reach a single customer." />
                        <FeatureCard icon={BarChart3} title="Call Analytics" description="Track duration, sentiment, booking rates, and conversion. Filter by agent, client, or time period." />
                        <FeatureCard icon={TrendingUp} title="A/B Experiments" description="Test prompt variants side by side. See which one books more appointments with real data." />
                        <FeatureCard icon={MessageSquare} title="Call Insights" description="AI analyzes every call for topics, objections, and sentiment. Know exactly why calls convert or don't." />
                        <FeatureCard icon={Users} title="Client Portals" description="Each client gets their own white-labeled dashboard. Your branding, their agents and data." />
                        <FeatureCard icon={Globe} title="White-Label" description="Custom domains, your logo, your colors. Clients never see BuildVoiceAI. It's your platform." />
                        <FeatureCard icon={Settings} title="CRM Integrations" description="Native GoHighLevel, HubSpot, Google Calendar, Calendly, and Slack. No Zapier needed." />
                    </div>
                </div>
            </section>

            {/* ── How It Works ── */}
            <section id="how-it-works" className="py-24 px-6 bg-gray-50 border-y border-gray-100">
                <div className="max-w-5xl mx-auto">
                    <div className="max-w-xl mb-16">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">How It Works</p>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Three steps to your first agent</h2>
                    </div>
                    <HowItWorks />
                </div>
            </section>

            {/* ── Comparison ── */}
            <section className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="max-w-xl mb-12">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Why BuildVoiceAI</p>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Built for agencies, not just agents</h2>
                        <p className="text-base text-gray-500 mt-4 leading-relaxed">
                            Provider dashboards give you agents. Resellers give you one provider. We give you the full platform.
                        </p>
                    </div>
                    <ComparisonTable />
                </div>
            </section>

            {/* ── Pricing ── */}
            <section id="pricing" className="py-24 px-6 bg-gray-50 border-y border-gray-100">
                <div className="max-w-5xl mx-auto">
                    <div className="max-w-xl mb-14">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Pricing</p>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                            Pay for the platform. Provider costs are yours.
                        </h2>
                        <p className="text-base text-gray-500 mt-4 leading-relaxed">No per-minute markups. You bring your own API keys and keep full control of provider costs.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { name: 'Starter', price: '$97', features: ['5 agents', '1 provider', 'Agent builder', 'Call analytics', 'Email support'], cta: 'Start Free Trial' },
                            { name: 'Growth', price: '$197', features: ['25 agents', 'All 4 providers', 'A/B experiments', 'Testing suites', 'AI call insights', '5 client portals', 'CRM integrations', 'Priority support'], cta: 'Start Free Trial', highlight: true },
                            { name: 'Scale', price: '$397', features: ['Unlimited agents', 'Unlimited clients', 'Custom domains', 'Stripe Connect billing', 'Full white-label', 'Dedicated support'], cta: 'Contact Sales' },
                        ].map(plan => (
                            <div key={plan.name} className={`p-8 rounded-2xl border relative ${
                                plan.highlight
                                    ? 'border-gray-900 bg-white shadow-xl shadow-gray-200/60'
                                    : 'border-gray-200 bg-white'
                            }`}>
                                {plan.highlight && (
                                    <div className="absolute -top-3 left-6 px-3 py-1 bg-gray-900 text-[11px] text-white font-semibold rounded-full">
                                        Most Popular
                                    </div>
                                )}
                                <p className="text-sm text-gray-500 font-medium">{plan.name}</p>
                                <div className="mt-3 mb-6">
                                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                                    <span className="text-sm text-gray-400 ml-1">/month</span>
                                </div>
                                <Link href="/signup" className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-colors ${
                                    plan.highlight
                                        ? 'bg-gray-900 text-white hover:bg-gray-800'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}>
                                    {plan.cta}
                                </Link>
                                <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                                    {plan.features.map(f => (
                                        <div key={f} className="flex items-center gap-3 text-sm text-gray-600">
                                            <Check className="w-4 h-4 text-gray-400 shrink-0" />{f}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section id="faq" className="py-24 px-6">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-12">Frequently Asked Questions</h2>
                    <FAQ q="Do I need my own voice provider account?" a="Yes. You bring your own Retell, Vapi, Bland, or ElevenLabs API key. You control costs and provider relationships directly. We never mark up your call minutes." />
                    <FAQ q="How does the agent builder work?" a="Describe your agent in plain English. AI generates a production-ready system prompt, picks a matching voice, and recommends CRM integrations. Refine through conversation, then deploy with one click." />
                    <FAQ q="Can I use different providers for different agents?" a="Absolutely. Run one agent on Retell and another on Vapi. Switch providers without rebuilding. Each agent is independent." />
                    <FAQ q="How do client portals work?" a="Each client gets their own white-labeled dashboard. They see only their agents, calls, and analytics. You control the branding. They never see BuildVoiceAI." />
                    <FAQ q="What CRM integrations are available?" a="GoHighLevel, HubSpot, Google Calendar, Calendly, and Slack. All native integrations, no Zapier or Make.com required." />
                    <FAQ q="Is there a free trial?" a="14 days, no credit card required. You just need a voice provider API key to make test calls." />
                    <FAQ q="What makes this different from Vapify or SynthFlow?" a="Multi-provider support (4 providers vs their 1), natural language agent builder, AI-powered testing suites, and A/B experiments. Those are either single-provider resellers or built-for-you services." />
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="py-24 px-6 border-t border-gray-100">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Start building today</h2>
                    <p className="text-base text-gray-500 mt-4 leading-relaxed">First agent in 30 seconds. 14-day free trial. No credit card required.</p>
                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/signup" className="group w-full sm:w-auto px-8 py-3.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10">
                            Get Started Free <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                        <a href="#demo" className="w-full sm:w-auto px-8 py-3.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                            Try the Demo
                        </a>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="border-t border-gray-100 py-12 px-6 bg-gray-50">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
                                    <Mic className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="text-sm font-bold">BuildVoiceAI</span>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed">The platform for voice AI agencies. Build, test, and deploy across providers.</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Product</p>
                            <div className="space-y-2.5">
                                <a href="#features" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Features</a>
                                <a href="#pricing" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Pricing</a>
                                <a href="#demo" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Demo</a>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Providers</p>
                            <div className="space-y-2.5">
                                <p className="text-sm text-gray-500">Retell</p>
                                <p className="text-sm text-gray-500">Vapi</p>
                                <p className="text-sm text-gray-500">Bland AI</p>
                                <p className="text-sm text-gray-500">ElevenLabs</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Company</p>
                            <div className="space-y-2.5">
                                <Link href="/privacy" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Privacy</Link>
                                <Link href="/terms" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Terms</Link>
                                <a href="mailto:support@buildvoiceai.com" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Contact</a>
                            </div>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} BuildVoiceAI. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
