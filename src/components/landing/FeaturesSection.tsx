'use client';

import { Sparkles, BarChart3, Zap, Users, PhoneForwarded, Bot } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useInView } from '@/hooks/useInView';

const features = [
    {
        icon: Sparkles,
        title: 'NL Agent Builder',
        description:
            'Describe your agent in plain English. AI generates the system prompt, personality, and voice configuration in seconds.',
    },
    {
        icon: BarChart3,
        title: 'Call Analytics',
        description:
            'Track call volume, duration, success rates, and costs in real time across all your agents and clients.',
    },
    {
        icon: Zap,
        title: 'Workflow Automation',
        description:
            'Trigger CRM actions, book appointments, tag contacts, and send Slack notifications automatically after every call.',
    },
    {
        icon: Users,
        title: 'White-Label Platform',
        description:
            'Your brand, your domain, your login page. Give each client their own portal with custom branding and permissions.',
    },
    {
        icon: PhoneForwarded,
        title: 'Phone Number Management',
        description:
            'Buy, assign, and manage phone numbers directly from the dashboard. One click to connect a number to an agent.',
    },
    {
        icon: Bot,
        title: 'Multi-Provider Support',
        description:
            'Works with Retell AI and Vapi. Switch providers per-agent without changing your setup or losing your data.',
    },
];

export function FeaturesSection() {
    const { ref, isInView } = useInView();

    return (
        <section id="features" className="py-24 px-4 sm:px-6">
            <div ref={ref} className="max-w-6xl mx-auto">
                <div className={`text-center mb-16 transition-all duration-700 ${isInView ? 'animate-fade-up' : 'opacity-0'}`}>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        Everything you need to deploy voice AI
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                        From building agents to managing calls at scale, BuildVoiceAI gives you a
                        complete platform out of the box.
                    </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature, index) => (
                        <Card
                            key={feature.title}
                            className={`group hover:shadow-md transition-all duration-300 ${
                                isInView ? 'animate-fade-up' : 'opacity-0'
                            }`}
                            style={{ animationDelay: isInView ? `${index * 100}ms` : undefined }}
                        >
                            <CardContent className="p-6">
                                <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center mb-4 group-hover:bg-violet-200 dark:group-hover:bg-violet-900/50 transition-colors">
                                    <feature.icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                                </div>
                                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {feature.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
