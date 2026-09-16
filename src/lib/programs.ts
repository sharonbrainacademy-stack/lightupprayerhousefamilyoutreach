/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProgramItem } from '../types';

/**
 * Utility to check if a program date has expired.
 * Compares program date against the current date/time.
 * Returns true only if the program date has clearly passed in the past.
 */
export function isProgramExpired(dateStr?: string, isAlwaysVisible?: boolean): boolean {
  if (isAlwaysVisible === true) {
    return false;
  }
  if (!dateStr || !dateStr.trim()) return false;

  try {
    let cleanStr = dateStr.trim();

    // Check for indefinite or upcoming keywords
    const lower = cleanStr.toLowerCase();
    if (
      lower.includes('coming soon') ||
      lower.includes('upcoming') ||
      lower.includes('tbd') ||
      lower.includes('to be announced') ||
      lower.includes('every') ||
      lower.includes('weekly') ||
      lower.includes('daily')
    ) {
      return false;
    }

    // Strip ordinal suffixes (1st, 2nd, 3rd, 4th, 21st, etc.)
    cleanStr = cleanStr.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');

    let targetDate: Date | null = null;

    // Handle date ranges e.g. "August 17 – 21, 2026", "Sept 10 - 15, 2026", "Aug 28 to Sept 2, 2026", "August 17 - August 21, 2026"
    if (cleanStr.includes('–') || cleanStr.includes('—') || cleanStr.includes(' - ') || cleanStr.toLowerCase().includes(' to ')) {
      const parts = cleanStr.split(/–|—|\s+-\s+|\s+to\s+/i).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const firstPart = parts[0];
        let secondPart = parts[parts.length - 1];

        // Check if second part has a year (4 digits)
        const yearMatch = cleanStr.match(/\b(20\d\d)\b/);
        const year = yearMatch ? yearMatch[1] : `${new Date().getFullYear()}`;

        // Check if secondPart is just a day number e.g. "21, 2026" or "21"
        const monthMatch = firstPart.match(/([a-zA-Z]+)/);
        const month = monthMatch ? monthMatch[1] : '';

        if (/^\d{1,2}(,\s*\d{4})?$/.test(secondPart)) {
          const dayNum = secondPart.replace(/[^\d]/g, '');
          if (month) {
            secondPart = `${month} ${dayNum}, ${year}`;
          }
        } else if (!/\b(20\d\d)\b/.test(secondPart)) {
          secondPart = `${secondPart}, ${year}`;
        }

        const rangeParsed = new Date(secondPart);
        if (!isNaN(rangeParsed.getTime())) {
          targetDate = rangeParsed;
        }
      }
    }

    // 1. Direct JS Date parsing if not already found
    if (!targetDate) {
      const parsed = new Date(cleanStr);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      } else {
        // 2. If year is missing (e.g., "Aug 8" or "August 8"), append current year
        if (!/\d{4}/.test(cleanStr)) {
          const currentYear = new Date().getFullYear();
          const parsedWithYear = new Date(`${cleanStr}, ${currentYear}`);
          if (!isNaN(parsedWithYear.getTime())) {
            targetDate = parsedWithYear;
          }
        }
      }
    }

    if (!targetDate) {
      // If we couldn't parse the date format, do NOT assume it's expired - keep it visible
      return false;
    }

    // Program remains active until the end of its scheduled day (23:59:59.999)
    targetDate.setHours(23, 59, 59, 999);

    const now = new Date();
    return targetDate.getTime() < now.getTime();
  } catch (err) {
    return false;
  }
}

/**
 * Returns readable status badge text and styles for a program
 */
export function getProgramStatusInfo(dateStr?: string, isAlwaysVisible?: boolean) {
  const expired = isProgramExpired(dateStr, isAlwaysVisible);
  if (expired) {
    return {
      expired: true,
      label: 'Expired • Loading New Flyer',
      badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
      message: 'This program date has expired. Awaiting new program flyer upload from admin.'
    };
  }

  return {
    expired: false,
    label: 'Active Program',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    message: 'Active program visible on website.'
  };
}
