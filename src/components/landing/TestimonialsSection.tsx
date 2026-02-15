'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useInView } from '@/hooks/useInView';

const testimonials = [
    {
        quote:
            'We went from manually handling 200 calls a day to having AI agents qualify and route every single one. Our close rate doubled in the first month.',
        name: 'Sarah Chen',
        title: 'Operations Director',
        company: 'Apex Dental Group',
        initials: 'SC',
    },
    {
        quote:
            'The white-label portal is a game changer. Each of our clients thinks they have their own custom voice AI platform. It sells itself.',
        name: 'Marcus Rodriguez',
        title: 'Founder',
        company: 'VoiceScale Agency',
        initials: 'MR',
    },
    {
        quote:
            'Setting up a new agent used to take our team a full day. Now we describe what we need and it\'s live in minutes. The NL builder is incredible.',
        name: 'Emily Park',
        title: 'CTO',
        company: 'NextHome Realty',
        initials: 'EP',
    },
];

export function TestimonialsSection() {
    const { ref, isInView } = useInView();

    return (
        <section className="py-24 px-4 sm:px-6">
            <div ref={ref} className="max-w-6xl mx-auto">
                <div className={`text-center mb-16 transition-all duration-700 ${isInView ? 'animate-fade-up' : 'opacity-0'}`}>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        Trusted by agencies and businesses
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                        See how teams are using BuildVoiceAI to transform their call operations.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {testimonials.map((testimonial, index) => (
                        <Card
                            key={testimonial.name}
                            className={`transition-all duration-700 ${isInView ? 'animate-fade-up' : 'opacity-0'}`}
                            style={{ animationDelay: isInView ? `${index * 100}ms` : undefined }}
                        >
                            <CardContent className="p-6">
                                <blockquote className="text-sm leading-relaxed text-muted-foreground mb-4">
                                    &ldquo;{testimonial.quote}&rdquo;
                                </blockquote>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarFallback className="bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-xs font-medium">
                                            {testimonial.initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="text-sm font-medium">{testimonial.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {testimonial.title}, {testimonial.company}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
