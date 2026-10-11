/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

export type FollowUpStatus = 'pending' | 'contacted' | 'excused' | 'pastoral_care' | 'no_response';
export type FollowUpChannel = 'whatsapp' | 'call' | 'sms' | 'email';

export interface MemberFollowUpRecord {
  id: string; // `${dateStr}_${memberUid}`
  memberUid: string;
  memberName: string;
  memberPhone?: string;
  memberEmail?: string;
  groupName?: string;
  dateStr: string;
  status: FollowUpStatus;
  channel?: FollowUpChannel;
  notes?: string;
  contactedAt?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface FollowUpTemplate {
  id: string;
  title: string;
  description: string;
  message: string;
}

export const DEFAULT_FOLLOW_UP_TEMPLATES: FollowUpTemplate[] = [
  {
    id: 'warm-checkin',
    title: 'Warm Altar Check-in',
    description: 'Loving, gentle check-in from the prayer family',
    message: 'Beloved {name}, grace and peace in Christ Jesus! We missed you at the LightUp Prayer Altar today ({date}). We trust you and your loved ones are strong and in sound health. We are standing in prayer with you! 🙏🕊️'
  },
  {
    id: 'pastoral-care',
    title: 'Pastoral & Intercessory Care',
    description: 'For pastoral support, healing, or prayer burdens',
    message: 'Beloved {name}, our pastoral team noticed your absence from today\'s prayer altar ({date}). Is there any burden, challenge, or prayer request we can agree with you upon? Please let us know so we can stand in the gap for you. We love and care for you dearly! ❤️'
  },
  {
    id: 'replay-catchup',
    title: 'Catch-Up & Prayer Fire',
    description: 'Encourage member to connect with the prayer points',
    message: 'Peace and blessings {name}! We missed having you on the live prayer altar today ({date}). The presence of God was mighty! You can still connect with today\'s prayer scriptures and join the fire here: https://lightupprayer.org/join - Keep the fire burning! 🔥'
  },
  {
    id: 'upcoming-encouragement',
    title: 'Next Session Encouragement',
    description: 'Warm look forward to tomorrow\'s altar',
    message: 'Dearest {name}, hope your day is going well! Just checking on you from LightUp Prayer Altar. Looking forward to raising our voices and standing together in the gap in our next prayer session. You are deeply valued and blessed! ✨'
  }
];

const LOCAL_STORAGE_KEY_PREFIX = 'lightup_followups_';

/**
 * Get local cached follow-ups for a date
 */
export function getLocalFollowUps(dateStr: string): Record<string, MemberFollowUpRecord> {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${dateStr}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to read followups from localStorage:', err);
  }
  return {};
}

/**
 * Save to local cache
 */
export function setLocalFollowUps(dateStr: string, records: Record<string, MemberFollowUpRecord>) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${dateStr}`, JSON.stringify(records));
  } catch (err) {
    console.warn('Failed to write followups to localStorage:', err);
  }
}

/**
 * Subscribe to follow-up records for a given session date in Firestore
 */
export function subscribeDateFollowUps(
  dateStr: string,
  onUpdate: (records: Record<string, MemberFollowUpRecord>) => void
): () => void {
  // First emit local cache immediately
  const local = getLocalFollowUps(dateStr);
  onUpdate(local);

  try {
    const q = query(
      collection(db, 'attendance_followups'),
      where('dateStr', '==', dateStr)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: Record<string, MemberFollowUpRecord> = { ...getLocalFollowUps(dateStr) };
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as MemberFollowUpRecord;
          if (data && data.memberUid) {
            records[data.memberUid] = {
              ...data,
              id: docSnap.id
            };
          }
        });
        setLocalFollowUps(dateStr, records);
        onUpdate(records);
      },
      (error) => {
        console.warn('Firestore follow-up subscription warning (using local):', error.message);
        // Fallback to local
        onUpdate(getLocalFollowUps(dateStr));
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Error creating followups listener:', err);
    return () => {};
  }
}

/**
 * Save or update single follow-up record
 */
export async function saveFollowUpRecord(
  record: {
    dateStr: string;
    memberUid: string;
    memberName: string;
    memberPhone?: string;
    memberEmail?: string;
    groupName?: string;
    status: FollowUpStatus;
    channel?: FollowUpChannel;
    notes?: string;
    updatedBy?: string;
  }
): Promise<boolean> {
  const docId = `${record.dateStr}_${record.memberUid}`;
  
  // Update local cache immediately
  const currentLocal = getLocalFollowUps(record.dateStr);
  const updatedRecord: MemberFollowUpRecord = {
    ...currentLocal[record.memberUid],
    id: docId,
    memberUid: record.memberUid,
    memberName: record.memberName,
    memberPhone: record.memberPhone || currentLocal[record.memberUid]?.memberPhone,
    memberEmail: record.memberEmail || currentLocal[record.memberUid]?.memberEmail,
    groupName: record.groupName || currentLocal[record.memberUid]?.groupName,
    dateStr: record.dateStr,
    status: record.status,
    channel: record.channel || currentLocal[record.memberUid]?.channel,
    notes: record.notes !== undefined ? record.notes : (currentLocal[record.memberUid]?.notes || ''),
    contactedAt: record.status !== 'pending' ? (currentLocal[record.memberUid]?.contactedAt || new Date().toISOString()) : undefined,
    updatedAt: new Date().toISOString(),
    updatedBy: record.updatedBy || 'admin'
  };

  currentLocal[record.memberUid] = updatedRecord;
  setLocalFollowUps(record.dateStr, currentLocal);

  try {
    const docRef = doc(db, 'attendance_followups', docId);
    await setDoc(docRef, {
      ...updatedRecord,
      serverTimestamp: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Failed to save follow-up to Firestore (saved locally):', err);
    return true;
  }
}

/**
 * Batch mark members as contacted
 */
export async function batchSaveFollowUps(
  dateStr: string,
  members: Array<{
    memberUid: string;
    memberName: string;
    memberPhone?: string;
    memberEmail?: string;
    groupName?: string;
  }>,
  status: FollowUpStatus,
  channel: FollowUpChannel = 'whatsapp',
  notes = 'Batch followed up',
  updatedBy = 'admin'
): Promise<number> {
  if (!members.length) return 0;

  const currentLocal = getLocalFollowUps(dateStr);
  const nowStr = new Date().toISOString();

  members.forEach(m => {
    const docId = `${dateStr}_${m.memberUid}`;
    currentLocal[m.memberUid] = {
      id: docId,
      memberUid: m.memberUid,
      memberName: m.memberName,
      memberPhone: m.memberPhone,
      memberEmail: m.memberEmail,
      groupName: m.groupName,
      dateStr,
      status,
      channel,
      notes,
      contactedAt: nowStr,
      updatedAt: nowStr,
      updatedBy
    };
  });
  setLocalFollowUps(dateStr, currentLocal);

  try {
    const batch = writeBatch(db);
    members.forEach(m => {
      const docId = `${dateStr}_${m.memberUid}`;
      const docRef = doc(db, 'attendance_followups', docId);
      batch.set(docRef, {
        id: docId,
        memberUid: m.memberUid,
        memberName: m.memberName,
        memberPhone: m.memberPhone || '',
        memberEmail: m.memberEmail || '',
        groupName: m.groupName || '',
        dateStr,
        status,
        channel,
        notes,
        contactedAt: nowStr,
        serverTimestamp: serverTimestamp(),
        updatedBy
      }, { merge: true });
    });
    await batch.commit();
  } catch (err) {
    console.warn('Batch write to Firestore failed (local updated):', err);
  }

  return members.length;
}

/**
 * Format message by replacing placeholders
 */
export function formatFollowUpMessage(template: string, name: string, dateStr: string): string {
  const cleanName = name || 'Beloved';
  // Formatted date string, e.g. "Monday, October 11, 2026"
  let formattedDate = dateStr;
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      formattedDate = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch {
    formattedDate = dateStr;
  }

  return template
    .replace(/\{name\}/g, cleanName)
    .replace(/\{date\}/g, formattedDate);
}

/**
 * Clean phone number for international WhatsApp
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/[^\d+]/g, '');
  let full = clean.startsWith('+') ? clean.substring(1) : clean;
  // Default Nigeria prefix if 080... (11 digits starting with 0)
  if (full.startsWith('0') && full.length === 11) {
    full = '234' + full.substring(1);
  }
  return full;
}
