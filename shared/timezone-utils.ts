/**
 * Timezone Utility Functions
 *
 * Centralized utilities for handling timezone conversions across the application.
 * All times are stored in UTC in the database and converted for display based on user timezone.
 */

import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

/**
 * Common US timezones for user selection
 */
export const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST, no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
] as const;

/**
 * Detect the user's timezone automatically from their browser
 */
export function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Failed to detect timezone:', error);
    return 'America/New_York'; // Default to ET
  }
}

/**
 * Format a UTC timestamp for display in a specific timezone
 *
 * @param timestampMs - Unix timestamp in milliseconds (UTC)
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 * @param formatStr - date-fns format string (default: 'PPpp' = "Apr 29, 2023, 9:00 AM")
 * @returns Formatted date string in the specified timezone
 */
export function formatSessionTime(
  timestampMs: number,
  timezone: string,
  formatStr: string = 'PPpp'
): string {
  try {
    return formatInTimeZone(timestampMs, timezone, formatStr);
  } catch (error) {
    console.error('Error formatting time:', error);
    return format(timestampMs, formatStr);
  }
}

/**
 * Format time with timezone abbreviation (e.g., "3:00 PM PDT")
 */
export function formatWithTimezoneAbbr(
  timestampMs: number,
  timezone: string
): string {
  try {
    return formatInTimeZone(timestampMs, timezone, 'p zzz');
  } catch (error) {
    console.error('Error formatting time with timezone:', error);
    return format(timestampMs, 'p');
  }
}

/**
 * Format time for email notifications (full date with timezone)
 */
export function formatEmailTime(
  timestampMs: number,
  timezone: string
): string {
  try {
    return formatInTimeZone(
      timestampMs,
      timezone,
      "EEEE, MMMM d, yyyy 'at' h:mm a zzz"
    );
  } catch (error) {
    console.error('Error formatting email time:', error);
    return format(timestampMs, "EEEE, MMMM d, yyyy 'at' h:mm a");
  }
}

/**
 * Convert a local date/time to UTC timestamp
 *
 * @param localDate - Date object in local time
 * @param timezone - User's timezone
 * @returns Unix timestamp in milliseconds (UTC)
 */
export function convertToUTC(localDate: Date, timezone: string): number {
  try {
    const utcDate = fromZonedTime(localDate, timezone);
    return utcDate.getTime();
  } catch (error) {
    console.error('Error converting to UTC:', error);
    return localDate.getTime();
  }
}

/**
 * Convert UTC timestamp to a Date object in a specific timezone
 */
export function convertFromUTC(timestampMs: number, timezone: string): Date {
  try {
    return toZonedTime(timestampMs, timezone);
  } catch (error) {
    console.error('Error converting from UTC:', error);
    return new Date(timestampMs);
  }
}

/**
 * Get the day of week (0-6) for a UTC timestamp in a specific timezone
 */
export function getDayOfWeekInTimezone(timestampMs: number, timezone: string): number {
  try {
    const zonedDate = toZonedTime(timestampMs, timezone);
    return zonedDate.getDay();
  } catch (error) {
    console.error('Error getting day of week:', error);
    return new Date(timestampMs).getDay();
  }
}

/**
 * Get hour and minute in a specific timezone
 */
export function getTimeInTimezone(timestampMs: number, timezone: string): { hour: number; minute: number } {
  try {
    const zonedDate = toZonedTime(timestampMs, timezone);
    return {
      hour: zonedDate.getHours(),
      minute: zonedDate.getMinutes(),
    };
  } catch (error) {
    console.error('Error getting time in timezone:', error);
    const fallbackDate = new Date(timestampMs);
    return {
      hour: fallbackDate.getHours(),
      minute: fallbackDate.getMinutes(),
    };
  }
}

/**
 * Create a UTC timestamp from date and time in a specific timezone
 */
export function createTimestamp(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): number {
  try {
    // Build an ISO-like string so fromZonedTime interprets it in the given timezone,
    // not the system's local timezone.
    const pad = (n: number) => String(n).padStart(2, '0');
    const localStr = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
    return fromZonedTime(localStr, timezone).getTime();
  } catch (error) {
    console.error('Error creating timestamp:', error);
    return new Date(year, month, day, hour, minute).getTime();
  }
}

/**
 * Check if a timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get timezone offset string (e.g., "UTC-7", "UTC-4")
 */
export function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatted = formatInTimeZone(now, timezone, 'XXX');
    return `UTC${formatted}`;
  } catch (error) {
    console.error('Error getting timezone offset:', error);
    return 'UTC';
  }
}
