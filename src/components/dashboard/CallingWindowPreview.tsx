'use client';

/**
 * Visual calling window timeline showing the configured hours
 * with current time markers for common US timezones.
 */

interface CallingWindowPreviewProps {
    startHour: number;
    endHour: number;
    daysOfWeek: number[];
}

const TIMEZONE_MARKERS = [
    { label: 'ET', timezone: 'America/New_York' },
    { label: 'CT', timezone: 'America/Chicago' },
    { label: 'MT', timezone: 'America/Denver' },
    { label: 'PT', timezone: 'America/Los_Angeles' },
];

function getCurrentHour(timezone: string): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
    });
    return parseInt(formatter.format(new Date()), 10);
}

export function CallingWindowPreview({ startHour, endHour, daysOfWeek }: CallingWindowPreviewProps) {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="space-y-3">
            {/* Timeline bar */}
            <div className="space-y-1">
                <div className="flex text-[10px] text-muted-foreground">
                    {[0, 6, 12, 18, 23].map(h => (
                        <span key={h} className="flex-1 text-center">
                            {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                        </span>
                    ))}
                </div>
                <div className="flex h-6 rounded overflow-hidden border">
                    {hours.map(h => {
                        const isActive = startHour <= endHour
                            ? h >= startHour && h < endHour
                            : h >= startHour || h < endHour;
                        return (
                            <div
                                key={h}
                                className={`flex-1 ${isActive ? 'bg-green-500/30' : 'bg-muted/30'}`}
                            />
                        );
                    })}
                </div>

                {/* Timezone current time markers */}
                <div className="flex gap-3 mt-1">
                    {TIMEZONE_MARKERS.map(tz => {
                        const hour = getCurrentHour(tz.timezone);
                        return (
                            <span key={tz.label} className="text-[10px] text-muted-foreground">
                                {tz.label}: {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Active days */}
            <div className="flex gap-1">
                {dayLabels.map((day, i) => (
                    <span
                        key={i}
                        className={`px-1.5 py-0.5 text-[10px] rounded ${
                            daysOfWeek.includes(i)
                                ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                                : 'bg-muted/50 text-muted-foreground line-through'
                        }`}
                    >
                        {day}
                    </span>
                ))}
            </div>
        </div>
    );
}
