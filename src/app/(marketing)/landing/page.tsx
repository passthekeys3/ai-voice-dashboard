'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
    Sparkles, Phone, ArrowRight, Check, ChevronDown, Mic, Bot,
    Wrench, Stethoscope, Building2, Scale, Car, Home, Play,
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
        await new Promise(r => setTimeout(r, 900));
        const a = buildAgent(text);
        setAgent(a);
        setMessages(p => [...p, {
            role: 'assistant',
            content: `Built **${a.name}**.\n\n**Voice:** ${a.voice}\n**Provider:** ${a.provider}\n**Greeting:** "${a.firstMessage}"\n\nReady to deploy. Want to adjust anything?`,
        }]);
        setTyping(false);
    };

    return (
        <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0c] overflow-hidden">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-violet-600/8 blur-[100px] pointer-events-none" />
            <div className="grid grid-cols-1 lg:grid-cols-5 h-[540px] relative">
                {/* Chat */}
                <div className="lg:col-span-3 flex flex-col border-r border-white/[0.06]">
                    <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-[13px] font-semibold text-white/90">Agent Builder</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {messages.length === 0 && (
                            <div className="pt-6 pb-2">
                                <p className="text-center text-[13px] text-white/40 mb-6">Pick a template or describe what you need.</p>
                                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                                    {TEMPLATES.map(t => (
                                        <button key={t.label} onClick={() => send(t.prompt)}
                                            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/[0.06] hover:border-violet-500/30 hover:bg-white/[0.03] transition-all text-left">
                                            <t.icon className="w-3.5 h-3.5 text-white/25 shrink-0" />
                                            <span className="text-[12px] text-white/50">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                                    m.role === 'user' ? 'bg-violet-600 text-white' : 'bg-white/[0.04] border border-white/[0.06] text-white/60'
                                }`}>
                                    {m.content.split('\n').map((line, j) => (
                                        <p key={j} className={j > 0 ? 'mt-1' : ''} dangerouslySetInnerHTML={{
                                            __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                                        }} />
                                    ))}
                                </div>
                            </div>
                        ))}
                        {typing && (
                            <div className="flex gap-1.5 px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-2xl w-fit">
                                {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 bg-violet-400/50 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>
                    <div className="p-4 border-t border-white/[0.06]">
                        <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
                            <input value={input} onChange={e => setInput(e.target.value)} placeholder='Describe your agent...'
                                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-violet-500/40" />
                            <button type="submit" disabled={!input.trim() || typing}
                                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl disabled:opacity-30 transition-colors">
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
                {/* Preview */}
                <div className="lg:col-span-2 bg-white/[0.01] flex flex-col">
                    <div className="px-5 py-3.5 border-b border-white/[0.06]">
                        <span className="text-[13px] font-semibold text-white/40">Preview</span>
                    </div>
                    {!agent ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-[12px] text-white/15">Your agent appears here</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-5 space-y-3">
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center">
                                        <Mic className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold text-white">{agent.name}</p>
                                        <p className="text-[11px] text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Ready</p>
                                    </div>
                                </div>
                                <div className="space-y-2 pt-3 border-t border-white/[0.04] text-[11px]">
                                    {[['Voice', agent.voice.split(' — ')[0]], ['Provider', agent.provider], ['Language', 'English']].map(([l,v]) => (
                                        <div key={l} className="flex justify-between"><span className="text-white/25">{l}</span><span className="text-white/50">{v}</span></div>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                <p className="text-[11px] text-white/25 mb-1.5">Opening Line</p>
                                <p className="text-[12px] text-white/45 italic">&ldquo;{agent.firstMessage}&rdquo;</p>
                            </div>
                            <button onClick={() => setShowPrompt(!showPrompt)}
                                className="w-full flex justify-between items-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
                                <span className="text-[11px] text-white/25">System Prompt</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-white/15 transition-transform ${showPrompt ? 'rotate-180' : ''}`} />
                            </button>
                            {showPrompt && (
                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 -mt-1">
                                    <pre className="text-[10px] text-white/30 whitespace-pre-wrap font-mono leading-relaxed">{agent.prompt}</pre>
                                </div>
                            )}
                            <Link href="/signup" className="flex items-center justify-center gap-2 w-full py-3 bg-white text-[#09090b] rounded-xl text-[13px] font-semibold hover:bg-white/90 transition-colors">
                                <Play className="w-3.5 h-3.5" /> Deploy This Agent
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Product Feature Section ─────────────────────────────────────────────────

function ProductSection({
    label, heading, description, features, reverse, children,
}: {
    label: string; heading: string; description: string; features: string[]; reverse?: boolean; children: React.ReactNode;
}) {
    return (
        <div className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${reverse ? 'direction-rtl' : ''}`}>
            <div className={reverse ? 'direction-ltr' : ''}>
                <p className="text-[12px] font-medium text-violet-400 uppercase tracking-[0.15em] mb-3">{label}</p>
                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">{heading}</h3>
                <p className="text-[15px] text-white/40 mt-4 leading-relaxed">{description}</p>
                <ul className="mt-6 space-y-3">
                    {features.map((f, i) => (
                        <li key={i} className="flex items-start gap-3 text-[14px] text-white/50">
                            <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                            {f}
                        </li>
                    ))}
                </ul>
            </div>
            <div className={reverse ? 'direction-ltr' : ''}>
                {children}
            </div>
        </div>
    );
}

// ─── Fake Product Screenshot ─────────────────────────────────────────────────

function MockDashboard() {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0f] overflow-hidden shadow-2xl">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
                <div className="flex gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-white/10" /><span className="w-2.5 h-2.5 rounded-full bg-white/10" /><span className="w-2.5 h-2.5 rounded-full bg-white/10" /></div>
                <div className="flex-1 mx-8"><div className="h-5 w-48 mx-auto rounded bg-white/[0.04]" /></div>
            </div>
            <div className="flex">
                {/* Sidebar */}
                <div className="w-44 border-r border-white/[0.06] p-3 space-y-1 hidden sm:block">
                    {['Dashboard', 'Agents', 'Calls', 'Analytics', 'Insights', 'Testing'].map((item, i) => (
                        <div key={item} className={`px-3 py-1.5 rounded-md text-[11px] ${i === 1 ? 'bg-violet-600/20 text-violet-300' : 'text-white/25'}`}>{item}</div>
                    ))}
                </div>
                {/* Main */}
                <div className="flex-1 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-[13px] font-semibold text-white/70">Agents</div>
                        <div className="px-3 py-1 rounded-md bg-violet-600 text-[10px] text-white font-medium">+ New Agent</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { name: 'HVAC Dispatcher', calls: '142', status: 'active' },
                            { name: 'Dental Receptionist', calls: '89', status: 'active' },
                            { name: 'Legal Intake', calls: '56', status: 'active' },
                            { name: 'Sales Qualifier', calls: '23', status: 'paused' },
                        ].map(a => (
                            <div key={a.name} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-medium text-white/60">{a.name}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300">retell</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-white/25">{a.calls} calls</span>
                                    <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MockInsights() {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0f] overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="text-[13px] font-semibold text-white/70">Call Insights</div>
            <div className="grid grid-cols-3 gap-3">
                {[['Positive', '87%', 'text-emerald-400'], ['Neutral', '11%', 'text-white/40'], ['Negative', '2%', 'text-rose-400']].map(([l,v,c]) => (
                    <div key={l} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                        <p className={`text-lg font-bold ${c}`}>{v}</p>
                        <p className="text-[10px] text-white/25 mt-1">{l}</p>
                    </div>
                ))}
            </div>
            <div className="space-y-2">
                <div className="text-[11px] text-white/30 font-medium">Top Topics</div>
                {['Appointment scheduling', 'Pricing questions', 'Emergency requests', 'Insurance verification'].map((t, i) => (
                    <div key={t} className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                            <div className="h-full rounded-full bg-violet-500/50" style={{ width: `${90 - i * 18}%` }} />
                        </div>
                        <span className="text-[10px] text-white/30 w-32 text-right">{t}</span>
                    </div>
                ))}
            </div>
            <div className="space-y-2">
                <div className="text-[11px] text-white/30 font-medium">Common Objections</div>
                {['Want to speak to a real person', 'Price too high', 'Need to check schedule'].map(o => (
                    <div key={o} className="text-[11px] text-white/20 px-3 py-2 rounded-md bg-white/[0.02] border border-white/[0.04]">{o}</div>
                ))}
            </div>
        </div>
    );
}

function MockTesting() {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0f] overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold text-white/70">Test Suite: HVAC Dispatcher</div>
                <div className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">8/8 Passed</div>
            </div>
            {[
                { scenario: 'Emergency call — burst pipe', result: 'pass', time: '1.2s' },
                { scenario: 'Schedule routine maintenance', result: 'pass', time: '0.9s' },
                { scenario: 'Ask about pricing', result: 'pass', time: '0.8s' },
                { scenario: 'Request to speak with manager', result: 'pass', time: '1.1s' },
                { scenario: 'After-hours call handling', result: 'pass', time: '0.7s' },
            ].map(t => (
                <div key={t.scenario} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-emerald-400" /></span>
                    <span className="text-[11px] text-white/50 flex-1">{t.scenario}</span>
                    <span className="text-[10px] text-white/20">{t.time}</span>
                </div>
            ))}
        </div>
    );
}

function MockExperiment() {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0f] overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="text-[13px] font-semibold text-white/70">A/B Experiment: Greeting Style</div>
            <div className="grid grid-cols-2 gap-3">
                {[
                    { variant: 'A: Formal', conversion: '34%', calls: 120, winner: false },
                    { variant: 'B: Casual', conversion: '41%', calls: 118, winner: true },
                ].map(v => (
                    <div key={v.variant} className={`rounded-lg p-4 border ${v.winner ? 'border-violet-500/30 bg-violet-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] text-white/50">{v.variant}</span>
                            {v.winner && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300">Winner</span>}
                        </div>
                        <p className="text-2xl font-bold text-white">{v.conversion}</p>
                        <p className="text-[10px] text-white/25 mt-1">{v.calls} calls</p>
                    </div>
                ))}
            </div>
            <div className="text-[11px] text-white/25 leading-relaxed">
                Variant B&apos;s casual greeting (&ldquo;Hey! This is Mike from Comfort Air. What&apos;s going on?&rdquo;) outperformed the formal version by 21% in appointment bookings.
            </div>
        </div>
    );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-white/[0.06]">
            <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center py-5 text-left">
                <span className="text-[14px] font-medium text-white/70 pr-4">{q}</span>
                <ChevronDown className={`w-4 h-4 text-white/15 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <p className="text-[13px] text-white/30 pb-5 leading-relaxed">{a}</p>}
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
        <div className="min-h-screen bg-[#09090b] text-white antialiased selection:bg-violet-500/30">
            {/* Nav */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.06]' : ''}`}>
                <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center"><Mic className="w-3.5 h-3.5 text-white" /></div>
                        <span className="text-[15px] font-bold tracking-tight">BuildVoiceAI</span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-[13px] text-white/35">
                        <a href="#features" className="hover:text-white/70 transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-white/70 transition-colors">Pricing</a>
                        <a href="#faq" className="hover:text-white/70 transition-colors">FAQ</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login" className="text-[13px] text-white/35 hover:text-white/70 transition-colors hidden sm:block">Log In</Link>
                        <Link href="/signup" className="px-4 py-1.5 bg-white text-[#09090b] text-[13px] font-semibold rounded-lg hover:bg-white/90 transition-colors">Get Started</Link>
                    </div>
                </div>
            </nav>

            {/* Hero — Product First */}
            <section className="relative pt-28 pb-4 px-6 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-violet-600/6 blur-[150px] pointer-events-none" />
                <div className="max-w-6xl mx-auto relative">
                    <div className="max-w-2xl">
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
                            The platform for<br />voice AI agencies
                        </h1>
                        <p className="mt-5 text-[16px] text-white/35 leading-relaxed max-w-lg">
                            Build, test, and deploy voice agents across Retell, Vapi, and Bland from a single dashboard. White-label it for your clients.
                        </p>
                        <div className="mt-8 flex items-center gap-4">
                            <Link href="/signup" className="group px-5 py-2.5 bg-white text-[#09090b] text-[13px] font-semibold rounded-lg hover:bg-white/90 transition-all flex items-center gap-2">
                                Start Building <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                            <a href="#demo" className="px-5 py-2.5 text-[13px] text-white/40 hover:text-white/70 transition-colors">Try the demo &darr;</a>
                        </div>
                    </div>
                    {/* Product Screenshot */}
                    <div className="mt-14">
                        <MockDashboard />
                    </div>
                </div>
            </section>

            {/* Social proof line */}
            <section className="py-10 px-6 border-b border-white/[0.04]">
                <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-[13px] text-white/15">
                    <span>Retell</span><span className="text-white/[0.06]">|</span>
                    <span>Vapi</span><span className="text-white/[0.06]">|</span>
                    <span>Bland AI</span><span className="text-white/[0.06]">|</span>
                    <span>ElevenLabs</span>
                </div>
            </section>

            {/* Demo */}
            <section id="demo" className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="max-w-lg mb-10">
                        <p className="text-[12px] font-medium text-violet-400 uppercase tracking-[0.15em] mb-3">Agent Builder</p>
                        <h2 className="text-3xl font-bold tracking-tight">Describe it. Deploy it.</h2>
                        <p className="text-[15px] text-white/30 mt-3">Tell the builder what your agent should do in plain English. It generates the prompt, picks a voice, and wires up your CRM.</p>
                    </div>
                    <AgentDemo />
                </div>
            </section>

            {/* Feature Sections — Alternating, with product visuals */}
            <section id="features" className="py-24 px-6 space-y-32">
                <div className="max-w-6xl mx-auto space-y-32">
                    <ProductSection
                        label="Insights"
                        heading="Know what callers are actually saying"
                        description="AI analyzes every call for sentiment, topics, and objections. Stop guessing why calls aren't converting."
                        features={[
                            'Sentiment breakdown across all calls',
                            'Auto-detected topics and patterns',
                            'Common objections surfaced automatically',
                            'Per-agent and per-client filtering',
                        ]}
                    >
                        <MockInsights />
                    </ProductSection>

                    <ProductSection
                        label="Testing"
                        heading="Ship agents that work on day one"
                        description="AI generates realistic test scenarios for your agent. Run them before a single real call hits the line."
                        features={[
                            'Auto-generated test scenarios per industry',
                            'Pass/fail scoring on every response',
                            'Test edge cases: after-hours, transfers, angry callers',
                            'Run full suites before every prompt change',
                        ]}
                        reverse
                    >
                        <MockTesting />
                    </ProductSection>

                    <ProductSection
                        label="Experiments"
                        heading="A/B test everything"
                        description="Run two prompt variants side by side. See which one books more appointments, with real data."
                        features={[
                            'Split traffic between prompt variants',
                            'Track conversion, duration, and sentiment per variant',
                            'Statistical significance indicators',
                            'One-click promote winner to production',
                        ]}
                    >
                        <MockExperiment />
                    </ProductSection>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="py-24 px-6 border-t border-white/[0.04]">
                <div className="max-w-5xl mx-auto">
                    <div className="max-w-lg mb-14">
                        <p className="text-[12px] font-medium text-violet-400 uppercase tracking-[0.15em] mb-3">Pricing</p>
                        <h2 className="text-3xl font-bold tracking-tight">Pay for the platform.<br />Provider costs are yours.</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-5">
                        {[
                            { name: 'Starter', price: '$97', desc: 'per month', features: ['5 agents', '1 provider', 'Agent builder', 'Call analytics', 'Email support'], cta: 'Start Free Trial' },
                            { name: 'Growth', price: '$197', desc: 'per month', features: ['25 agents', 'All providers', 'A/B experiments', 'Testing suites', 'AI insights', '5 client portals', 'CRM integrations'], cta: 'Start Free Trial', highlight: true },
                            { name: 'Scale', price: '$397', desc: 'per month', features: ['Unlimited agents', 'Unlimited clients', 'Custom domains', 'Stripe Connect', 'White-label', 'Priority support'], cta: 'Contact Sales' },
                        ].map(plan => (
                            <div key={plan.name} className={`p-7 rounded-xl border ${plan.highlight ? 'border-violet-500/30 bg-violet-500/[0.03]' : 'border-white/[0.06] bg-white/[0.015]'} relative`}>
                                {plan.highlight && <div className="absolute -top-2.5 left-5 px-2.5 py-0.5 bg-violet-600 text-[10px] text-white font-semibold rounded-full">Popular</div>}
                                <p className="text-[11px] text-white/30 uppercase tracking-wider font-medium">{plan.name}</p>
                                <p className="text-3xl font-bold text-white mt-2">{plan.price}<span className="text-[14px] text-white/25 font-normal"> /mo</span></p>
                                <Link href="/signup" className={`block w-full text-center py-2.5 rounded-lg text-[13px] font-semibold mt-5 mb-5 transition-colors ${
                                    plan.highlight ? 'bg-white text-[#09090b] hover:bg-white/90' : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]'
                                }`}>{plan.cta}</Link>
                                <div className="space-y-2.5">
                                    {plan.features.map(f => (
                                        <div key={f} className="flex items-center gap-2.5 text-[12px] text-white/35">
                                            <Check className="w-3 h-3 text-violet-400 shrink-0" />{f}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="py-24 px-6 border-t border-white/[0.04]">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold tracking-tight mb-10">FAQ</h2>
                    <FAQ q="Do I need my own voice provider account?" a="Yes. You bring your own Retell, Vapi, or Bland API keys. You control costs and provider relationships directly." />
                    <FAQ q="How does the agent builder work?" a="Describe your agent in plain English. AI generates a production-ready system prompt, picks a voice, and recommends CRM integrations. Refine through conversation, deploy with one click." />
                    <FAQ q="Can I use different providers per agent?" a="Yes. Run one agent on Retell and another on Vapi. Switch providers without rebuilding anything." />
                    <FAQ q="What about my clients?" a="Each client gets their own white-labeled portal. They see only their agents, calls, and analytics. Your branding, their experience." />
                    <FAQ q="What CRM integrations are available?" a="GoHighLevel, HubSpot, Google Calendar, Calendly, and Slack. All native, no Zapier needed." />
                    <FAQ q="Is there a free trial?" a="14 days, no credit card. You just need a voice provider API key to make test calls." />
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 px-6 border-t border-white/[0.04]">
                <div className="max-w-xl mx-auto text-center">
                    <h2 className="text-3xl font-bold tracking-tight">Start building today</h2>
                    <p className="text-[14px] text-white/30 mt-3">First agent in 30 seconds. No credit card required.</p>
                    <Link href="/signup" className="group inline-flex items-center gap-2 mt-8 px-6 py-3 bg-white text-[#09090b] text-[14px] font-semibold rounded-xl hover:bg-white/90 transition-all">
                        Get Started Free <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/[0.04] py-8 px-6">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-violet-600 flex items-center justify-center"><Mic className="w-2.5 h-2.5 text-white" /></div>
                        <span className="text-[12px] font-semibold text-white/40">BuildVoiceAI</span>
                    </div>
                    <div className="flex items-center gap-5 text-[11px] text-white/20">
                        <Link href="/privacy" className="hover:text-white/40">Privacy</Link>
                        <Link href="/terms" className="hover:text-white/40">Terms</Link>
                        <a href="mailto:support@buildvoiceai.com" className="hover:text-white/40">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
