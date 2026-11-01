/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  doc, getDoc, updateDoc, setDoc, arrayUnion, increment,
  collection, getDocs, deleteDoc, query, where, writeBatch, serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile, ZoomParticipantLog } from '../types';
import { getMemberWhatsAppCommunity } from './whatsapp';

/**
 * Get current date string in YYYY-MM-DD format (WAT timezone)
 */
export function getTodayDateString(): string {
  const now = new Date();
  // WAT is UTC+1
  const watOffsetMs = 1 * 60 * 60 * 1000;
  const watTime = new Date(now.getTime() + watOffsetMs);
  return watTime.toISOString().split('T')[0];
}

/**
 * Get start date string for current year (Jan 1st)
 */
export function getYearStartDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

/**
 * Get start date string for current week (Monday)
 */
export function getWeekStartDateString(): string {
  const now = new Date();
  const day = now.getDay(); // 0 is Sun, 1 is Mon...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * Log 1 minute of active prayer time for a logged-in user in Firestore
 */
export async function logPrayerMinute(userId: string) {
  if (!userId) return;

  const todayStr = getTodayDateString();
  const userRef = doc(db, 'users', userId);

  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const existingDays: string[] = data.attendanceDaysList || [];
    const dailyMinutesMap: Record<string, number> = data.dailyMinutes || {};
    const todayMinutes = (dailyMinutesMap[todayStr] || 0) + 1;
    
    // Check if this is a new day attended
    const isNewDay = !existingDays.includes(todayStr);
    const updatedDaysList = isNewDay ? [...existingDays, todayStr] : existingDays;

    // Recalculate this year's & week's minutes
    const yearStart = getYearStartDateString();
    const weekStart = getWeekStartDateString();
    let thisYearMinutes = 0;
    let thisWeekMinutes = 0;

    Object.entries(dailyMinutesMap).forEach(([dateStr, mins]) => {
      if (dateStr >= yearStart) {
        thisYearMinutes += mins;
      }
      if (dateStr >= weekStart) {
        thisWeekMinutes += mins;
      }
    });
    thisYearMinutes += 1;
    thisWeekMinutes += 1; // including current minute

    const updatedDailyMap = { ...dailyMinutesMap, [todayStr]: todayMinutes };

    await updateDoc(userRef, {
      totalMinutes: increment(1),
      dailyMinutes: updatedDailyMap,
      todayMinutes: todayMinutes,
      thisYearMinutes: thisYearMinutes,
      thisWeekMinutes: thisWeekMinutes,
      lastAttendedDate: todayStr,
      attendanceDaysList: isNewDay ? arrayUnion(todayStr) : existingDays,
      attendanceCount: updatedDaysList.length
    });
  } catch (error) {
    console.error('Error logging prayer minute:', error);
  }
}

/**
 * Sync exact total prayer minutes for today for a logged-in user in Firestore
 */
export async function syncExactPrayerMinutes(userId: string, targetMinutes: number) {
  if (!userId || targetMinutes <= 0) return;

  const todayStr = getTodayDateString();
  const userRef = doc(db, 'users', userId);

  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const existingDays: string[] = data.attendanceDaysList || [];
    const dailyMinutesMap: Record<string, number> = data.dailyMinutes || {};
    const existingTodayMinutes = dailyMinutesMap[todayStr] || 0;

    // Only update if targetMinutes is higher than what was already saved
    const newTodayMinutes = Math.max(existingTodayMinutes, targetMinutes);
    const updatedDailyMap = { ...dailyMinutesMap, [todayStr]: newTodayMinutes };

    // Check if this is a new day attended
    const isNewDay = !existingDays.includes(todayStr);
    const updatedDaysList = isNewDay ? [...existingDays, todayStr] : existingDays;

    // Recalculate this year's, week's, and total minutes
    const yearStart = getYearStartDateString();
    const weekStart = getWeekStartDateString();
    let thisYearMinutes = 0;
    let thisWeekMinutes = 0;
    let totalMinutes = 0;

    Object.entries(updatedDailyMap).forEach(([dateStr, mins]) => {
      totalMinutes += mins;
      if (dateStr >= yearStart) {
        thisYearMinutes += mins;
      }
      if (dateStr >= weekStart) {
        thisWeekMinutes += mins;
      }
    });

    await updateDoc(userRef, {
      totalMinutes: totalMinutes,
      dailyMinutes: updatedDailyMap,
      todayMinutes: newTodayMinutes,
      thisYearMinutes: thisYearMinutes,
      thisWeekMinutes: thisWeekMinutes,
      lastAttendedDate: todayStr,
      attendanceDaysList: isNewDay ? arrayUnion(todayStr) : existingDays,
      attendanceCount: updatedDaysList.length
    });
  } catch (error) {
    console.error('Error syncing exact prayer minutes:', error);
  }
}

/**
 * Explicitly mark/record attendance for today (e.g. when launching Zoom or clicking Mark Attendance)
 */
export async function markAttendanceForToday(userId: string): Promise<{ success: boolean; isNewDay: boolean; newCount: number; dateStr: string }> {
  if (!userId) {
    return { success: false, isNewDay: false, newCount: 0, dateStr: getTodayDateString() };
  }

  const todayStr = getTodayDateString();
  const userRef = doc(db, 'users', userId);

  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, isNewDay: false, newCount: 0, dateStr: todayStr };
    }

    const data = userSnap.data();
    const existingDays: string[] = data.attendanceDaysList || [];
    const dailyMinutesMap: Record<string, number> = data.dailyMinutes || {};
    const currentTodayMinutes = dailyMinutesMap[todayStr] || 0;
    const todayMinutes = currentTodayMinutes > 0 ? currentTodayMinutes : 1; // ensure at least 1 minute logged for today
    
    // Check if this is a new day attended
    const isNewDay = !existingDays.includes(todayStr);
    const updatedDaysList = isNewDay ? [...existingDays, todayStr] : existingDays;

    // Recalculate this year's & week's minutes
    const yearStart = getYearStartDateString();
    const weekStart = getWeekStartDateString();
    let thisYearMinutes = 0;
    let thisWeekMinutes = 0;

    const updatedDailyMap = { ...dailyMinutesMap, [todayStr]: todayMinutes };

    Object.entries(updatedDailyMap).forEach(([dateStr, mins]) => {
      if (dateStr >= yearStart) {
        thisYearMinutes += mins;
      }
      if (dateStr >= weekStart) {
        thisWeekMinutes += mins;
      }
    });

    await updateDoc(userRef, {
      totalMinutes: increment(currentTodayMinutes > 0 ? 0 : 1),
      dailyMinutes: updatedDailyMap,
      todayMinutes: todayMinutes,
      thisYearMinutes: thisYearMinutes,
      thisWeekMinutes: thisWeekMinutes,
      lastAttendedDate: todayStr,
      attendanceDaysList: isNewDay ? arrayUnion(todayStr) : existingDays,
      attendanceCount: updatedDaysList.length
    });

    return { 
      success: true, 
      isNewDay, 
      newCount: updatedDaysList.length, 
      dateStr: todayStr 
    };
  } catch (error) {
    console.error('Error marking attendance for today:', error);
    return { success: false, isNewDay: false, newCount: 0, dateStr: todayStr };
  }
}

/**
 * Normalizes attendee / member names for strict or fuzzy matching:
 * - strips emojis
 * - strips honorary titles: Pastor, Pst, Sis, Sister, Bro, Brother, Deacon, Deaconess, Mrs, Mr, Dr, Coach, etc.
 * - removes punctuation and extra whitespace
 * - converts to lowercase
 */
export function normalizeAttendeeName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ')
    .replace(/\b(pastor|pst|sister|sis|brother|bro|deacon|deaconess|mrs|mr|dr|elder|minister|apostle|rev|evang|prophet|coach)\b\.?/gi, ' ')
    .replace(/[^\w\s@.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes digits from phone strings for reliable phone matching
 */
export function normalizePhoneDigits(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Checks whether an attendee name, email, or phone matches a registered church member in any group
 */
export function isAttendeeMatchingMember(
  attendeeName: string,
  attendeeEmail: string | undefined,
  attendeePhone: string | undefined,
  member: UserProfile
): boolean {
  if (!member) return false;

  // 1. Match by Email
  const memberEmail = (member.email || '').toLowerCase().trim();
  const attEmail = (attendeeEmail || '').toLowerCase().trim();
  if (attEmail && memberEmail && attEmail === memberEmail) {
    return true;
  }
  // If attendeeName itself is an email (e.g. aenemary83@gmail.com)
  const cleanAttName = (attendeeName || '').toLowerCase().trim();
  if (cleanAttName.includes('@') && memberEmail && cleanAttName === memberEmail) {
    return true;
  }
  const memberDisplayName = (member.displayName || '').toLowerCase().trim();
  if (cleanAttName.includes('@') && memberDisplayName && cleanAttName === memberDisplayName) {
    return true;
  }

  // 2. Match by Phone Number (check last 7-10 digits)
  const attDigits = normalizePhoneDigits(attendeePhone || (attendeeName.match(/\+?\d[\d\s-]{7,}/)?.[0] || ''));
  const memDigits = normalizePhoneDigits(member.phone || (member as any).whatsappNumber || member.whatsappGroup);
  if (attDigits.length >= 7 && memDigits.length >= 7) {
    if (attDigits.endsWith(memDigits.slice(-7)) || memDigits.endsWith(attDigits.slice(-7))) {
      return true;
    }
  }

  // 3. Match by Normalized Name
  const normGuest = normalizeAttendeeName(attendeeName);
  const normMember = normalizeAttendeeName(member.displayName || (member as any).name || '');

  if (!normGuest || !normMember) return false;

  // Exact normalized match (case, punctuation, and title-agnostic)
  if (normGuest === normMember) {
    return true;
  }

  // Substring matching for names with length >= 4
  if (normGuest.length >= 4 && normMember.length >= 4) {
    if (normMember.includes(normGuest) || normGuest.includes(normMember)) {
      return true;
    }
  }

  // Word set comparison (e.g. "Aghedo Thomas Osariemhe" vs "Thomas Osariemhe Aghedo" or "Friday Aghedo" vs "Bro Friday Aghedo")
  const guestWords = normGuest.split(' ').filter(w => w.length >= 3);
  const memberWords = normMember.split(' ').filter(w => w.length >= 3);

  if (guestWords.length >= 2 && memberWords.length >= 2) {
    const commonWords = guestWords.filter(gw => memberWords.includes(gw));
    if (commonWords.length >= 2 || commonWords.length === Math.min(guestWords.length, memberWords.length)) {
      return true;
    }
  }

  // Single word nickname match when exact (e.g. "Joy" === "Joy", "Grace" === "Grace", "Loveth" === "Loveth")
  if (guestWords.length === 1 && memberWords.length === 1 && guestWords[0] === memberWords[0] && guestWords[0].length >= 3) {
    return true;
  }

  return false;
}

/**
 * Finds the corresponding registered member (belonging to any prayer group) for a guest log
 */
export function findMemberForGuestLog(
  log: { name?: string; email?: string; phone?: string },
  members: UserProfile[]
): UserProfile | null {
  if (!log || (!log.name && !log.email && !log.phone)) return null;

  for (const m of members) {
    if (isAttendeeMatchingMember(log.name || '', log.email, log.phone, m)) {
      return m;
    }
  }
  return null;
}

/**
 * AUTOMATIC PURGE:
 * Any member whose name is under guest/unregistered zoom log, once the name is found in any group,
 * is automatically deleted from the guest/unregistered zoom log in Firestore.
 */
export async function purgeDuplicateGuestZoomLogs(
  members: UserProfile[],
  targetDate?: string
): Promise<{ deletedCount: number; purgedGuestNames: string[] }> {
  if (!members || members.length === 0) return { deletedCount: 0, purgedGuestNames: [] };

  try {
    let logsQuery = query(collection(db, 'zoom_participant_logs'), where('isMember', '==', false));
    if (targetDate) {
      logsQuery = query(collection(db, 'zoom_participant_logs'), where('isMember', '==', false), where('date', '==', targetDate));
    }

    const snap = await getDocs(logsQuery);
    if (snap.empty) return { deletedCount: 0, purgedGuestNames: [] };

    const toDeleteDocs: { id: string; name: string; date: string; matchedMember: UserProfile }[] = [];

    snap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const matched = findMemberForGuestLog(
        { name: data.name, email: data.email, phone: (data as any).phone },
        members
      );
      if (matched) {
        toDeleteDocs.push({
          id: docSnap.id,
          name: data.name || 'Guest',
          date: data.date || getTodayDateString(),
          matchedMember: matched
        });
      }
    });

    if (toDeleteDocs.length === 0) return { deletedCount: 0, purgedGuestNames: [] };

    // Batch delete matching guest participant logs
    const batch = writeBatch(db);
    toDeleteDocs.forEach(item => {
      batch.delete(doc(db, 'zoom_participant_logs', item.id));
    });

    await batch.commit();

    // Also check and clean up any matching guest_attendance records
    try {
      const guestAttSnap = await getDocs(collection(db, 'guest_attendance'));
      if (!guestAttSnap.empty) {
        const guestBatch = writeBatch(db);
        let guestDeleteCount = 0;
        guestAttSnap.docs.forEach(d => {
          const gData = d.data();
          const isMatch = toDeleteDocs.some(del => 
            normalizeAttendeeName(gData.guestName || '') === normalizeAttendeeName(del.name)
          );
          if (isMatch) {
            guestBatch.delete(doc(db, 'guest_attendance', d.id));
            guestDeleteCount++;
          }
        });
        if (guestDeleteCount > 0) {
          await guestBatch.commit();
        }
      }
    } catch (e) {
      console.warn('Could not clean guest_attendance table:', e);
    }

    return {
      deletedCount: toDeleteDocs.length,
      purgedGuestNames: toDeleteDocs.map(d => `${d.name} -> ${d.matchedMember.displayName || d.matchedMember.email}`)
    };
  } catch (err) {
    console.error('Error purging duplicate guest zoom logs:', err);
    return { deletedCount: 0, purgedGuestNames: [] };
  }
}

