'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MessageSquarePlus, Loader2, Bug, Lightbulb, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

type FeedbackType = 'bug' | 'feature_request' | 'general';

export function FeedbackWidget() {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [type, setType] = useState<FeedbackType>('general');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const resetForm = () => {
        setType('general');
        setTitle('');
        setDescription('');
        setError(null);
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            setError('Please enter a title');
            return;
        }
        if (!description.trim()) {
            setError('Please enter a description');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    title: title.trim(),
                    description: description.trim(),
                    page_url: window.location.href,
                    browser_info: navigator.userAgent,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || 'Failed to submit feedback');
            }

            setOpen(false);
            resetForm();
            toast.success('Feedback submitted — thank you!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {/* Floating trigger button */}
            <Button
                onClick={() => setOpen(true)}
                size="icon"
                className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                aria-label="Send feedback"
            >
                <MessageSquarePlus className="h-5 w-5" />
            </Button>

            {/* Feedback dialog */}
            <Dialog open={open} onOpenChange={(isOpen: boolean) => {
                setOpen(isOpen);
                if (!isOpen) resetForm();
            }}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquarePlus className="h-5 w-5" />
                            Send Feedback
                        </DialogTitle>
                        <DialogDescription>
                            Help us improve by reporting bugs, requesting features, or sharing your thoughts.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Feedback Type */}
                        <div className="space-y-2">
                            <Label htmlFor="feedback-type">Type</Label>
                            <Select value={type} onValueChange={(v: string) => setType(v as FeedbackType)}>
                                <SelectTrigger id="feedback-type" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bug">
                                        <span className="flex items-center gap-2">
                                            <Bug className="h-4 w-4" />
                                            Bug Report
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="feature_request">
                                        <span className="flex items-center gap-2">
                                            <Lightbulb className="h-4 w-4" />
                                            Feature Request
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="general">
                                        <span className="flex items-center gap-2">
                                            <MessageCircle className="h-4 w-4" />
                                            General Feedback
                                        </span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Title */}
                        <div className="space-y-2">
                            <Label htmlFor="feedback-title">Title</Label>
                            <Input
                                id="feedback-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Brief summary of your feedback"
                                maxLength={200}
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="feedback-description">Description</Label>
                            <Textarea
                                id="feedback-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={
                                    type === 'bug'
                                        ? 'What happened? What did you expect?'
                                        : type === 'feature_request'
                                        ? 'Describe the feature and why it would be useful'
                                        : 'Share your thoughts...'
                                }
                                rows={4}
                                maxLength={5000}
                            />
                        </div>

                        {/* Error display */}
                        {error && (
                            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                                {error}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                'Submit Feedback'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
