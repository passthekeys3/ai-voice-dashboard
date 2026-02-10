/**
 * Timezone Detection & Calling Window Enforcement
 *
 * Detects lead timezone from phone number area codes (NANP) or country codes,
 * enforces configurable calling windows with DST-correct time handling.
 *
 * Uses Node.js built-in Intl.DateTimeFormat for timezone conversion (handles DST natively).
 */

import { AREA_CODE_TIMEZONES } from './area-codes';
import { COUNTRY_CODE_TIMEZONES } from './country-codes';

export interface CallingWindow {
  startHour: number;      // 0-23, e.g. 9
  endHour: number;        // 0-23, e.g. 20
  daysOfWeek?: number[];  // 0=Sun, 1=Mon...6=Sat. Default: [1,2,3,4,5] (weekdays)
}

/**
 * Detect the IANA timezone for a phone number.
 *
 * For NANP numbers (+1): uses area code for precise US/Canada/Caribbean mapping.
 * For international numbers: uses country calling code for capital-city timezone.
 *
 * @param phoneNumber - E.164 format phone number (e.g., +14155551234)
 * @returns IANA timezone string or null if unrecognized
 */
export function detectTimezone(phoneNumber: string): string | null {
  // Strip all non-digit characters except leading +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // Ensure we have a + prefix or at least digits
  const digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;

  if (!digits || digits.length < 4) {
    return null;
  }

  // NANP numbers: country code 1 + 3-digit area code
  if (digits.startsWith('1') && digits.length >= 4) {
    const areaCode = digits.slice(1, 4);
    const tz = AREA_CODE_TIMEZONES[areaCode];
    if (tz) return tz;
  }

  // International: try matching country codes (longest first: 3, 2, 1 digit)
  for (const len of [3, 2, 1]) {
    const countryCode = digits.slice(0, len);
    const tz = COUNTRY_CODE_TIMEZONES[countryCode];
    if (tz) return tz;
  }

  return null;
}

/**
 * Get the current local time in a given IANA timezone.
 *
 * Uses Intl.DateTimeFormat which handles DST transitions automatically.
 *
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 * @returns Date object representing the current time (note: the Date object's
 *          internal timestamp is UTC, but the hours/minutes extracted via
 *          getLocalHour/getLocalDay reflect the target timezone)
 */
export function getLocalTime(timezone: string): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: timezone })
  );
}

/**
 * Extract the current hour (0-23) in a given timezone.
 */
export function getLocalHour(timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(formatter.format(new Date()), 10);
}

/**
 * Extract the current day of week (0=Sun, 6=Sat) in a given timezone.
 */
export function getLocalDay(timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const day = formatter.format(new Date());
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return dayMap[day] ?? 0;
}

/**
 * Check if the current time in the given timezone is within the calling window.
 *
 * @param timezone - IANA timezone string
 * @param window - Calling window configuration
 * @returns true if calls are allowed right now in the lead's timezone
 */
export function isWithinCallingWindow(
  timezone: string,
  window: CallingWindow,
): boolean {
  const hour = getLocalHour(timezone);
  const day = getLocalDay(timezone);
  const allowedDays = window.daysOfWeek ?? [1, 2, 3, 4, 5];

  // Check day of week
  if (!allowedDays.includes(day)) {
    return false;
  }

  // Check hour range (handles same-day ranges only, e.g. 9-20)
  if (window.startHour <= window.endHour) {
    return hour >= window.startHour && hour < window.endHour;
  }

  // Handle overnight ranges (e.g. 22-6) - unlikely but supported
  return hour >= window.startHour || hour < window.endHour;
}

/**
 * Calculate the next valid call time in the lead's timezone.
 *
 * If the current time is outside the calling window, returns the next
 * time the window opens (respecting day-of-week and DST).
 *
 * @param timezone - IANA timezone string
 * @param window - Calling window configuration
 * @returns Date (UTC) when the next valid calling time begins
 */
export function getNextValidCallTime(
  timezone: string,
  window: CallingWindow,
): Date {
  const allowedDays = window.daysOfWeek ?? [1, 2, 3, 4, 5];

  // Get current local time components in the target timezone
  const localNow = getLocalTime(timezone);
  const currentHour = localNow.getHours();
  const currentDay = localNow.getDay();

  // Check if we can still call today (later in the day)
  if (allowedDays.includes(currentDay) && currentHour < window.startHour) {
    // Today is an allowed day and we haven't reached the start hour yet
    // Schedule for today at startHour
    return buildDateInTimezone(timezone, localNow, window.startHour, 0);
  }

  // Otherwise, find the next allowed day
  for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
    const futureDay = (currentDay + daysAhead) % 7;
    if (allowedDays.includes(futureDay)) {
      // Build a date for daysAhead from now at startHour in the target timezone
      const futureLocal = new Date(localNow);
      futureLocal.setDate(futureLocal.getDate() + daysAhead);
      return buildDateInTimezone(timezone, futureLocal, window.startHour, 0);
    }
  }

  // Fallback: tomorrow at start hour (shouldn't reach here if daysOfWeek is valid)
  const tomorrow = new Date(localNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return buildDateInTimezone(timezone, tomorrow, window.startHour, 0);
}

/**
 * Build a UTC Date from a target timezone's local date/time.
 *
 * Given a reference date (for the correct day) and a target hour/minute
 * in the specified timezone, computes the corresponding UTC timestamp.
 */
function buildDateInTimezone(
  timezone: string,
  referenceDate: Date,
  targetHour: number,
  targetMinute: number,
): Date {
  // Format the target date/time as an ISO-like string in the target timezone
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');
  const hour = String(targetHour).padStart(2, '0');
  const minute = String(targetMinute).padStart(2, '0');

  const targetStr = `${year}-${month}-${day}T${hour}:${minute}:00`;

  // Use a binary search approach to find the UTC time that corresponds to
  // this local time in the target timezone. This handles DST correctly.
  // Start with a rough estimate (interpret the string as UTC and adjust).
  const rough = new Date(targetStr + 'Z');

  // Get the offset at that rough time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Iterate to converge on the correct UTC time
  let candidate = rough;
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(candidate);
    const localHour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const localMinute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);

    const diffMinutes = (targetHour * 60 + targetMinute) - (localHour * 60 + localMinute);

    if (diffMinutes === 0) break;

    // Handle day wraparound
    let adjustMinutes = diffMinutes;
    if (adjustMinutes > 720) adjustMinutes -= 1440;
    if (adjustMinutes < -720) adjustMinutes += 1440;

    candidate = new Date(candidate.getTime() + adjustMinutes * 60 * 1000);
  }

  return candidate;
}

/**
 * Format a timezone for display.
 *
 * @param timezone - IANA timezone string
 * @returns Formatted string like "EST (UTC-5)" or "PDT (UTC-7)"
 */
export function formatTimezoneDisplay(timezone: string): string {
  const now = new Date();
  const abbr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? timezone;

  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? '';

  return `${abbr} (${offset})`;
}

/**
 * Format the current local time in a timezone for display.
 *
 * @param timezone - IANA timezone string
 * @returns Formatted string like "2:30 PM"
 */
export function formatLocalTime(timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
}
