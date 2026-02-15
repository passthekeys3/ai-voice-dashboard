'use client';

import { useState } from 'react';
import { Sparkles, BarChart3, Zap, LayoutDashboard } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

const tabs = [
    {
        id: 'builder',
        label: 'Agent Builder',
        icon: Sparkles,
        headline: 'Build agents with natural language',
        description: 'Describe what your agent should do and our AI generates a complete configuration — system prompt, voice, and integrations.',
        gradient: 'from-violet-500/20 to-purple-500/20',
        accentColor: 'bg-violet-500',
        mockElements: [
            { type: 'chat', text: 'Create a dental receptionist that books appointments...' },
            { type: 'response', text: 'I\'ve created "Dr. Smith\'s Dental Assistant" with appointment booking...' },
            { type: 'card', text: 'Voice: Sarah (Female, Professional, American)' },
        ],
    },
    {
        id: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
        headline: 'Monitor every call in real time',
        description: 'Track call volume, duration, success rates, and costs across all agents. Drill into individual calls for full transcripts.',
        gradient: 'from-blue-500/20 to-cyan-500/20',
        accentColor: 'bg-blue-500',
        mockElements: [
            { type: 'stat', text: '1,247 calls this month' },
            { type: 'stat', text: '94% success rate' },
            { type: 'chart', text: 'Call volume trend' },
        ],
    },
    {
        id: 'workflows',
        label: 'Workflows',
        icon: Zap,
        headline: 'Automate post-call actions',
        description: 'Create workflows that trigger automatically after calls — log to CRM, book appointments, send Slack notifications, and more.',
        gradient: 'from-amber-500/20 to-orange-500/20',
        accentColor: 'bg-amber-500',
        mockElements: [
            { type: 'node', text: 'When call ends' },
            { type: 'node', text: 'Create CRM contact' },
            { type: 'node', text: 'Book appointment' },
        ],
    },
    {
        id: 'portal',
        label: 'Client Portal',
        icon: LayoutDashboard,
        headline: 'White-label for your clients',
        description: 'Each client gets their own branded portal to view calls, analytics, and agents. Your logo, your domain, your brand.',
        gradient: 'from-green-500/20 to-emerald-500/20',
        accentColor: 'bg-green-500',
        mockElements: [
            { type: 'brand', text: 'Custom logo & colors' },
            { type: 'stat', text: 'Client dashboard view' },
            { type: 'card', text: 'Permission-based access' },
        ],
    },
];

export function ProductShowcase() {
    const [activeTab, setActiveTab] = useState('builder');
    const { ref, isInView } = useInView();
    const activeData = tabs.find((t) => t.id === activeTab)!;

    return (
        <section className="py-24 px-4 sm:px-6">
            <div ref={ref} className="max-w-6xl mx-auto">
                <div className={`text-center mb-12 transition-all duration-700 ${isInView ? 'animate-fade-up' : 'opacity-0'}`}>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        See it in action
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                        A complete platform for building, managing, and scaling AI voice agents.
                    </p>
                </div>

                {/* Tab buttons */}
                <div className={`flex flex-wrap justify-center gap-2 mb-8 transition-all duration-700 ${isInView ? 'animate-fade-up' : 'opacity-0'}`}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.id
                                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                                    : 'bg-muted hover:bg-accent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Showcase area */}
                <div
                    className={`grid md:grid-cols-2 gap-8 items-center transition-all duration-700 ${isInView ? 'animate-fade-up' : 'opacity-0'}`}
                    style={{ animationDelay: '200ms' }}
                >
                    {/* Description */}
                    <div className="space-y-4">
                        <h3 className="text-2xl font-semibold">{activeData.headline}</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            {activeData.description}
                        </p>
                    </div>

                    {/* Mock screenshot */}
                    <div className={`rounded-xl border border-border bg-gradient-to-br ${activeData.gradient} dark:bg-gradient-to-br p-1`}>
                        <div className="rounded-lg bg-card border border-border overflow-hidden">
                            {/* Mock window chrome */}
                            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/50">
                                <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
                                <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
                                <div className="flex-1 mx-8">
                                    <div className="h-4 w-full max-w-[200px] mx-auto rounded bg-muted" />
                                </div>
                            </div>

                            {/* Mock content */}
                            <div className="p-4 space-y-3 min-h-[250px]">
                                {activeData.mockElements.map((el, i) => (
                                    <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                                        {el.type === 'chat' && (
                                            <div className="flex justify-end">
                                                <div className="bg-violet-600 text-white text-xs px-3 py-2 rounded-lg rounded-br-none max-w-[80%]">
                                                    {el.text}
                                                </div>
                                            </div>
                                        )}
                                        {el.type === 'response' && (
                                            <div className="flex justify-start">
                                                <div className="bg-muted text-xs px-3 py-2 rounded-lg rounded-bl-none max-w-[80%]">
                                                    {el.text}
                                                </div>
                                            </div>
                                        )}
                                        {el.type === 'card' && (
                                            <div className="border border-border rounded-lg p-2 text-xs text-muted-foreground">
                                                {el.text}
                                            </div>
                                        )}
                                        {el.type === 'stat' && (
                                            <div className="bg-muted/50 rounded-lg p-3">
                                                <div className="text-xs text-muted-foreground mb-1">Metric</div>
                                                <div className="text-sm font-semibold">{el.text}</div>
                                            </div>
                                        )}
                                        {el.type === 'chart' && (
                                            <div className="bg-muted/30 rounded-lg p-3 h-24 flex items-end gap-1">
                                                {Array.from({ length: 12 }, (_, j) => (
                                                    <div
                                                        key={j}
                                                        className={`flex-1 ${activeData.accentColor} opacity-60 rounded-t`}
                                                        style={{ height: `${20 + Math.random() * 80}%` }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        {el.type === 'node' && (
                                            <div className="flex items-center gap-2">
                                                <div className={`h-2 w-2 rounded-full ${activeData.accentColor}`} />
                                                <div className="border border-border rounded px-3 py-1.5 text-xs flex-1">
                                                    {el.text}
                                                </div>
                                                {i < activeData.mockElements.length - 1 && (
                                                    <div className="text-muted-foreground text-xs">&rarr;</div>
                                                )}
                                            </div>
                                        )}
                                        {el.type === 'brand' && (
                                            <div className="flex items-center gap-3 border border-border rounded-lg p-3">
                                                <div className="h-8 w-8 rounded bg-gradient-to-br from-violet-500 to-purple-600" />
                                                <div>
                                                    <div className="text-xs font-medium">{el.text}</div>
                                                    <div className="text-xs text-muted-foreground">Fully white-labeled</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
