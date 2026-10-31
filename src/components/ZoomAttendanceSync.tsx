/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  CheckCircle2, AlertTriangle, Users, Clock, RefreshCw, Trash2, 
  Search, Plus, Check, X, Filter, Calendar, ExternalLink, ArrowRight, 
  Video, Sparkles, Eye, MessageCircle, ClipboardPaste, Download,
  ChevronLeft, ChevronRight, UserCheck, RotateCcw, Edit3, UserX, 
  XCircle, HeartHandshake, Copy, Share2
} from 'lucide-react';
import { 
  collection, onSnapshot, doc, updateDoc, setDoc, addDoc, deleteDoc, 
  serverTimestamp, getDocs, writeBatch, query, where, orderBy, limit, 
  arrayRemove, arrayUnion, increment 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, ZoomSessionItem, ZoomParticipantLog } from '../types';
import { getTodayDateString } from '../lib/attendance';
import { cn } from '../lib/utils';
import { getMemberWhatsAppCommunity, WHATSAPP_COMMUNITY_OPTIONS } from '../lib/whatsapp';

export interface SyncedCorrectionRow {
  logId: string;
  name: string;
  email: string;
  durationMinutes: number;
  joinTime?: string;
  leaveTime?: string;
  isMember: boolean;
  memberUid: string;
  matchedMember: UserProfile | null;
  whatsappCommunity?: string;
  date: string;
  status: 'present' | 'reversed_absent';
  source?: 'zoom' | 'whatsapp' | 'both' | 'manual';
}

export interface SyncedSessionCorrection {
  sessionId: string;
  title: string;
  date: string;
  totalParticipants: number;
  totalMinutes: number;
  rows: SyncedCorrectionRow[];
}

interface ZoomAttendanceSyncProps {
  members: UserProfile[];
  onRefreshMembers?: () => void;
  onNavigateToReports?: (date?: string, subTab?: 'reports' | 'followup') => void;
}

export default function ZoomAttendanceSync({ members, onRefreshMembers, onNavigateToReports }: ZoomAttendanceSyncProps) {
  // Sub-tabs: Paste marking, Manual correction station, Past sessions history
  const [activeSubTab, setActiveSubTab] = useState<'paste' | 'correction' | 'history'>('paste');
  
  // Meeting Session Setup
  const [meetingTitle, setMeetingTitle] = useState('Daily Online Prayer Meeting');
  const [meetingDate, setMeetingDate] = useState(getTodayDateString());
  const [meetingDurationMinutes, setMeetingDurationMinutes] = useState(60);
  const [meetingNotes, setMeetingNotes] = useState('');

  // Pasting inputs
  const [zoomPastedText, setZoomPastedText] = useState('');
  const [whatsappPastedText, setWhatsappPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');
  const [syncErrorMsg, setSyncErrorMsg] = useState('');

  // Active Session for Manual Correction
  const [syncedSessionCorrection, setSyncedSessionCorrection] = useState<SyncedSessionCorrection | null>(null);
  const [correctionSearchFilter, setCorrectionSearchFilter] = useState('');
  const [correctionStatusFilter, setCorrectionStatusFilter] = useState<'all' | 'present' | 'absent' | 'guest'>('all');
  const [correctionCommunityFilter, setCorrectionCommunityFilter] = useState<string>('all');
  const [editingMinutesRowId, setEditingMinutesRowId] = useState<string | null>(null);
  const [editingMinutesValue, setEditingMinutesValue] = useState<number>(60);
  const [updatingRowId, setUpdatingRowId] = useState<string | null>(null);

  // Manual Add Missing Attendee Modal
  const [showAddAttendeeModal, setShowAddAttendeeModal] = useState(false);
  const [addAttendeeName, setAddAttendeeName] = useState('');
  const [addAttendeeSelectedMemberUid, setAddAttendeeSelectedMemberUid] = useState('');
  const [addAttendeeSearch, setAddAttendeeSearch] = useState('');
  const [addAttendeeDuration, setAddAttendeeDuration] = useState(60);

  // Past Session History State
  const [sessions, setSessions] = useState<ZoomSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ZoomSessionItem | null>(null);
  const [sessionLogs, setSessionLogs] = useState<ZoomParticipantLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [sessionLogsSearch, setSessionLogsSearch] = useState('');

  // Helper to extract clean titles (Pastor, Sister, Brother, Deacon, etc.)
  const cleanTitlePrefix = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/^(pastor|pst|sister|sis|brother|bro|deacon|deaconess|dr|elder|minister|apostle|rev|evang|prophet)\.?\s+/i, '')
      .replace(/[()|,:;[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Helper to normalize phone numbers for matching
  const normalizeDigits = (val?: string): string => {
    if (!val) return '';
    return val.replace(/\D/g, '');
  };

  // Helper to detect date in string
  const extractDateFromString = (val: string): string | null => {
    if (!val) return null;
    const isoMatch = val.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    const usMatch = val.match(/\b(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])[-/.](20\d{2})\b/);
    if (usMatch) {
      const month = usMatch[1].padStart(2, '0');
      const day = usMatch[2].padStart(2, '0');
      return `${usMatch[3]}-${month}-${day}`;
    }

    const dmyMatch = val.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      return `${dmyMatch[3]}-${month}-${day}`;
    }
    return null;
  };

  // 1. EXTRACT FROM ZOOM PASTED TEXT
  const parseZoomText = (text: string): { name: string; email: string; duration: number }[] => {
    if (!text.trim()) return [];
    const lines = text.split(/\r\n|\n|\r/).map(l => l.trim()).filter(l => l.length > 0);
    const results: { name: string; email: string; duration: number }[] = [];

    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const durationRegex = /\b(\d{1,3})\s*(?:mins?|minutes?|min)\b/i;

    lines.forEach(line => {
      // Ignore noise lines
      const lower = line.toLowerCase();
      if (
        lower.startsWith('topic:') ||
        lower.startsWith('meeting id:') ||
        lower.startsWith('report generated') ||
        lower.includes('user center') ||
        lower.includes('zoom video communications') ||
        (lower.includes('name') && lower.includes('email') && lower.includes('duration'))
      ) {
        return;
      }

      // Check for Zoom Chat line: "06:05:12 From Bro Emmanuel to Everyone : Present"
      const chatMatch = line.match(/(?:\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\s*)?From\s+([^:]+?)\s+to\s+[^:]+:(.*)/i);
      if (chatMatch) {
        const sender = chatMatch[1]
          .replace(/\(Host(?:,\s*me)?\)|\(Co-host\)|\(Guest\)|\(me\)/gi, '')
          .trim();
        if (sender.length >= 2) {
          results.push({ name: sender, email: '', duration: meetingDurationMinutes });
          return;
        }
      }

      // Extract Email
      const emailMatch = line.match(emailRegex);
      const email = emailMatch ? emailMatch[1].toLowerCase() : '';

      // Extract Duration
      let durMins = meetingDurationMinutes;
      const durMatch = line.match(durationRegex);
      if (durMatch) {
        durMins = parseInt(durMatch[1], 10) || meetingDurationMinutes;
      }

      // Clean line for participant name
      let clean = line;
      if (email) clean = clean.replace(email, ' ');
      clean = clean
        .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/gi, ' ')
        .replace(/\b\d{1,3}\s*(?:mins?|minutes?|min)\b/gi, ' ')
        .replace(/\(Host(?:,\s*me)?\)|\(Co-host\)|\(Guest\)|\(me\)|\(Participant\)/gi, ' ')
        .replace(/^[0-9]+[\.\)\-\:\s]+/, '')
        .replace(/[()|,:;[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (clean.length >= 2) {
        results.push({ name: clean, email, duration: durMins });
      } else if (email) {
        results.push({ name: email.split('@')[0].replace(/[._-]/g, ' '), email, duration: durMins });
      }
    });

    return results;
  };

  // 2. EXTRACT FROM WHATSAPP PASTED TEXT
  const parseWhatsAppText = (text: string): { name: string; phone: string; duration: number }[] => {
    if (!text.trim()) return [];
    const lines = text.split(/\r\n|\n|\r/).map(l => l.trim()).filter(l => l.length > 0);
    const results: { name: string; phone: string; duration: number }[] = [];

    const phoneRegex = /(?:\+?234|0)[789][01]\d{8}|\+?[1-9]\d{7,14}/;

    lines.forEach(line => {
      // 1. WhatsApp Chat format: "[10/26/26, 6:05:12 AM] Sis Blessing: Present 🙏"
      // or "10/26/26, 6:05 AM - Bro David (Lagos): Online for prayers"
      const chatRegex = /(?:\[?\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[,\s]+(?:\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\]?|\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[-:]?\s*([^:\n]+?)\s*:(.*)/i;
      const chatMatch = line.match(chatRegex);

      if (chatMatch) {
        const rawSender = chatMatch[1].trim();
        const rawMsg = chatMatch[2].trim();

        const phoneMatch = rawSender.match(phoneRegex);
        const phone = phoneMatch ? phoneMatch[0] : '';

        // If the sender is a name or phone
        let senderName = rawSender
          .replace(/^[+0-9\s\-()]+$/, '') // if pure phone, clear name
          .replace(/[()|,:;[\]]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Also check if message is a check-in list (e.g. "Present: Sis Mary, Bro John")
        if (rawMsg.toLowerCase().includes('present') || rawMsg.toLowerCase().includes('online') || rawMsg.toLowerCase().includes('amen') || rawMsg.toLowerCase().includes('joined') || rawMsg.length < 50) {
          if (senderName.length >= 2 || phone) {
            results.push({
              name: senderName || phone,
              phone,
              duration: meetingDurationMinutes
            });
          }
        }
        return;
      }

      // 2. Roll call / List item format: "1. Pastor Osaro Aghedo - Present" or "Bro David (Lagos)"
      let clean = line
        .replace(/^[0-9]+[\.\)\-\:\s]+/, '') // strip list numbers "1.", "2)", "01:"
        .replace(/\b(present|online|here|joined|amen|praying|connected|watching|yes)\b/gi, ' ')
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ') // emojis
        .replace(/[()|,:;[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const phoneMatch = clean.match(phoneRegex);
      const phone = phoneMatch ? phoneMatch[0] : '';
      if (phone) clean = clean.replace(phone, ' ').trim();

      if (clean.length >= 2 || phone) {
        results.push({
          name: clean || phone,
          phone,
          duration: meetingDurationMinutes
        });
      }
    });

    return results;
  };

  // 3. AUTO-MARK ATTENDANCE FROM PASTED RECORDS
  const handleAutoMarkFromPastedRecords = async () => {
    if (!zoomPastedText.trim() && !whatsappPastedText.trim()) {
      setSyncErrorMsg('Please paste your Zoom attendance record or WhatsApp attendance record into the box below.');
      return;
    }

    setIsProcessing(true);
    setSyncErrorMsg('');
    setSyncSuccessMsg('');

    try {
      // Extract from Zoom
      const zoomAttendees = parseZoomText(zoomPastedText);
      // Extract from WhatsApp
      const whatsappAttendees = parseWhatsAppText(whatsappPastedText);

      if (zoomAttendees.length === 0 && whatsappAttendees.length === 0) {
        throw new Error('No attendee names could be recognized from the pasted text. Please verify the copied text.');
      }

      // Check if dates were detected in pasted text
      const detectedDate = extractDateFromString(zoomPastedText) || extractDateFromString(whatsappPastedText) || meetingDate;
      const activeMeetingDate = detectedDate || getTodayDateString();
      setMeetingDate(activeMeetingDate);

      // Consolidate unique attendees
      type RawEntry = {
        name: string;
        email?: string;
        phone?: string;
        duration: number;
        source: 'zoom' | 'whatsapp' | 'both';
      };

      const consolidatedMap = new Map<string, RawEntry>();

      zoomAttendees.forEach(z => {
        const key = (z.email ? z.email.toLowerCase() : cleanTitlePrefix(z.name)).toLowerCase().trim();
        if (key) {
          consolidatedMap.set(key, {
            name: z.name,
            email: z.email,
            duration: z.duration,
            source: 'zoom'
          });
        }
      });

      whatsappAttendees.forEach(w => {
        const cleanNameKey = cleanTitlePrefix(w.name).toLowerCase().trim();
        const phoneDigits = normalizeDigits(w.phone);
        const key = phoneDigits ? `phone_${phoneDigits}` : cleanNameKey;

        // Check if already present from Zoom
        let existingKey: string | null = null;
        for (const [k, v] of consolidatedMap.entries()) {
          if (w.phone && v.phone && normalizeDigits(v.phone) === phoneDigits) {
            existingKey = k;
            break;
          }
          if (cleanNameKey.length > 2 && cleanTitlePrefix(v.name).toLowerCase().trim() === cleanNameKey) {
            existingKey = k;
            break;
          }
        }

        if (existingKey) {
          const item = consolidatedMap.get(existingKey)!;
          item.source = 'both';
          if (w.phone && !item.phone) item.phone = w.phone;
        } else if (key) {
          consolidatedMap.set(key, {
            name: w.name,
            phone: w.phone,
            duration: w.duration,
            source: 'whatsapp'
          });
        }
      });

      // Match with registered members
      const matchedMembersMap = new Map<string, { member: UserProfile; source: 'zoom' | 'whatsapp' | 'both'; duration: number }>();
      const guestRows: SyncedCorrectionRow[] = [];

      consolidatedMap.forEach(item => {
        let matched: UserProfile | null = null;
        const itemClean = cleanTitlePrefix(item.name);
        const itemDigits = normalizeDigits(item.phone);

        // 1. Match by Email
        if (item.email) {
          matched = members.find(m => m.email?.toLowerCase().trim() === item.email?.toLowerCase().trim()) || null;
        }

        // 2. Match by Phone Number
        if (!matched && itemDigits.length >= 7) {
          matched = members.find(m => {
            const mPhone = normalizeDigits(m.phone || (m as any).whatsappNumber || m.whatsappGroup);
            return mPhone && (mPhone.endsWith(itemDigits.slice(-7)) || itemDigits.endsWith(mPhone.slice(-7)));
          }) || null;
        }

        // 3. Match by Exact or Cleaned Display Name
        if (!matched && item.name) {
          matched = members.find(m => {
            const mName = (m.displayName || (m as any).name || '').trim();
            if (!mName) return false;
            const mClean = cleanTitlePrefix(mName);
            if (mClean === itemClean) return true;
            if (itemClean.length > 3 && mClean.length > 3) {
              const itemWords = itemClean.split(' ').filter(w => w.length > 2);
              const mWords = mClean.split(' ').filter(w => w.length > 2);
              const hasCommonWords = itemWords.some(iw => mWords.includes(iw));
              if (hasCommonWords && (itemWords.length >= 2 || mWords.length >= 2)) return true;
            }
            return false;
          }) || null;
        }

        if (matched) {
          const uid = matched.uid || (matched as any).id;
          if (uid) {
            matchedMembersMap.set(uid, {
              member: matched,
              source: item.source,
              duration: item.duration || meetingDurationMinutes
            });
          }
        } else {
          // Unmatched / Guest Attendee
          guestRows.push({
            logId: `guest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: item.name,
            email: item.email || '',
            durationMinutes: item.duration || meetingDurationMinutes,
            isMember: false,
            memberUid: '',
            matchedMember: null,
            whatsappCommunity: 'Unregistered Visitor',
            date: activeMeetingDate,
            status: 'present',
            source: item.source
          });
        }
      });

      // 4. Create Zoom / Prayer Session in Firestore
      const sessionDocRef = await addDoc(collection(db, 'zoom_sessions'), {
        title: meetingTitle.trim(),
        meetingDate: activeMeetingDate,
        totalParticipants: matchedMembersMap.size + guestRows.length,
        totalMinutes: (matchedMembersMap.size + guestRows.length) * meetingDurationMinutes,
        source: 'pasted_records',
        notes: meetingNotes.trim() || `Marked from pasted Zoom (${zoomAttendees.length}) & WhatsApp (${whatsappAttendees.length}) records`,
        createdAt: serverTimestamp()
      });

      const sessionId = sessionDocRef.id;

      // 5. Commit Participant Logs & Credit Matched Members
      const batch = writeBatch(db);
      let batchCount = 0;
      const createdLogs: SyncedCorrectionRow[] = [];
      const isToday = activeMeetingDate === getTodayDateString();

      // Record Matched Members (PRESENT)
      for (const [uid, record] of matchedMembersMap.entries()) {
        const mem = record.member;
        const logDocRef = doc(collection(db, 'zoom_participant_logs'));
        
        createdLogs.push({
          logId: logDocRef.id,
          name: (mem.displayName || mem.email || 'Member').trim(),
          email: mem.email || '',
          durationMinutes: record.duration,
          isMember: true,
          memberUid: uid,
          matchedMember: mem,
          whatsappCommunity: getMemberWhatsAppCommunity(mem),
          date: activeMeetingDate,
          status: 'present',
          source: record.source
        });

        batch.set(logDocRef, {
          sessionId,
          sessionTitle: meetingTitle.trim(),
          name: mem.displayName || mem.email || 'Member',
          email: mem.email || '',
          durationMinutes: record.duration,
          date: activeMeetingDate,
          isMember: true,
          memberUid: uid,
          whatsappCommunity: getMemberWhatsAppCommunity(mem),
          status: 'present',
          source: record.source,
          createdAt: serverTimestamp()
        });
        batchCount++;

        // Update Member User Record (attendance days and minutes)
        const userRef = doc(db, 'users', uid);
        const currentDaysList = Array.isArray(mem.attendanceDaysList) ? [...mem.attendanceDaysList] : [];
        if (!currentDaysList.includes(activeMeetingDate)) {
          currentDaysList.push(activeMeetingDate);
        }
        const dailyMap = mem.dailyMinutes ? { ...mem.dailyMinutes } : {};
        dailyMap[activeMeetingDate] = (dailyMap[activeMeetingDate] || 0) + record.duration;

        const updateData: any = {
          totalMinutes: (mem.totalMinutes || 0) + record.duration,
          lastAttendedDate: activeMeetingDate,
          attendanceDaysList: currentDaysList,
          attendanceCount: currentDaysList.length,
          dailyMinutes: dailyMap,
          lastActiveAt: serverTimestamp()
        };
        if (isToday) {
          updateData.todayMinutes = (mem.todayMinutes || 0) + record.duration;
        }

        batch.update(userRef, updateData);
        batchCount++;

        if (batchCount >= 450) {
          await batch.commit();
          batchCount = 0;
        }
      }

      // Record Guest Visitors (PRESENT)
      for (const guest of guestRows) {
        const logDocRef = doc(collection(db, 'zoom_participant_logs'));
        guest.logId = logDocRef.id;
        createdLogs.push(guest);

        batch.set(logDocRef, {
          sessionId,
          sessionTitle: meetingTitle.trim(),
          name: guest.name,
          email: guest.email,
          durationMinutes: guest.durationMinutes,
          date: activeMeetingDate,
          isMember: false,
          memberUid: '',
          whatsappCommunity: 'Unregistered Visitor',
          status: 'present',
          source: guest.source,
          createdAt: serverTimestamp()
        });
        batchCount++;

        // Add to guest_attendance
        const guestDocRef = doc(collection(db, 'guest_attendance'));
        batch.set(guestDocRef, {
          guestId: `guest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          guestName: guest.name,
          guestEmail: guest.email,
          dateStr: activeMeetingDate,
          totalMinutes: guest.durationMinutes,
          source: `Pasted ${guest.source}`,
          createdAt: serverTimestamp()
        });
        batchCount++;

        if (batchCount >= 450) {
          await batch.commit();
          batchCount = 0;
        }
      }

      // 6. Identify and add all ABSENT registered members
      const absentMembers = members.filter(m => {
        const uid = m.uid || (m as any).id;
        return uid && !matchedMembersMap.has(uid);
      });

      for (const mem of absentMembers) {
        createdLogs.push({
          logId: `absent-${mem.uid}-${activeMeetingDate}`,
          name: (mem.displayName || mem.email || 'Member').trim(),
          email: mem.email || '',
          durationMinutes: 0,
          isMember: true,
          memberUid: mem.uid,
          matchedMember: mem,
          whatsappCommunity: getMemberWhatsAppCommunity(mem),
          date: activeMeetingDate,
          status: 'reversed_absent', // Absent
          source: 'manual'
        });
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      // 7. Sort: Present members first (alphabetical A-Z), then Absent members (alphabetical A-Z)
      createdLogs.sort((a, b) => {
        const aPresent = a.status === 'present';
        const bPresent = b.status === 'present';
        if (aPresent !== bPresent) {
          return aPresent ? -1 : 1;
        }
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      });

      // 8. Set Active Session and navigate to Manual Correction Station
      setSyncedSessionCorrection({
        sessionId,
        title: meetingTitle.trim(),
        date: activeMeetingDate,
        totalParticipants: matchedMembersMap.size + guestRows.length,
        totalMinutes: (matchedMembersMap.size + guestRows.length) * meetingDurationMinutes,
        rows: createdLogs
      });

      setActiveSubTab('correction');
      setSyncSuccessMsg(`🎉 Marked Attendance for ${activeMeetingDate}! Found ${matchedMembersMap.size} Present Members & ${guestRows.length} Guests. ${absentMembers.length} Absent members are listed below for quick manual review & correction.`);

      if (onRefreshMembers) onRefreshMembers();
    } catch (err: any) {
      console.error('Error auto-marking attendance from pasted records:', err);
      setSyncErrorMsg(`Error: ${err?.message || 'Could not process attendance text. Please check the pasted content.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. MANUAL 1-CLICK CORRECTION (Toggle Present <-> Absent)
  const handleToggleRowAttendance = async (item: SyncedCorrectionRow, targetStatus?: 'present' | 'reversed_absent') => {
    try {
      const isCurrentlyPresent = item.status === 'present';
      const newStatus: 'present' | 'reversed_absent' = targetStatus || (isCurrentlyPresent ? 'reversed_absent' : 'present');
      if (newStatus === item.status) return;

      setUpdatingRowId(item.logId || item.name);
      const assignedMinutes = item.durationMinutes > 0 ? item.durationMinutes : meetingDurationMinutes;
      let effectiveLogId = item.logId;

      // 1. Update/Create participant log doc in Firestore
      if (newStatus === 'present' && (!item.logId || item.logId.startsWith('absent-'))) {
        const newLogRef = doc(collection(db, 'zoom_participant_logs'));
        await setDoc(newLogRef, {
          sessionId: syncedSessionCorrection?.sessionId || '',
          sessionTitle: syncedSessionCorrection?.title || 'Daily Online Prayer Meeting',
          name: item.name,
          email: item.email || '',
          durationMinutes: assignedMinutes,
          date: item.date,
          isMember: !!item.memberUid,
          memberUid: item.memberUid || '',
          whatsappCommunity: item.whatsappCommunity || '',
          status: 'present',
          source: 'manual',
          createdAt: serverTimestamp()
        });
        effectiveLogId = newLogRef.id;
      } else if (item.logId && !item.logId.startsWith('absent-')) {
        await updateDoc(doc(db, 'zoom_participant_logs', item.logId), {
          status: newStatus,
          ...(newStatus === 'present' && item.durationMinutes === 0 ? { durationMinutes: assignedMinutes } : {})
        });
      }

      // 2. Adjust registered member attendance record in Firestore
      if (item.memberUid) {
        const userRef = doc(db, 'users', item.memberUid);
        const mem = members.find(m => m.uid === item.memberUid);
        if (mem) {
          const isToday = item.date === getTodayDateString();
          const currentDaysList = Array.isArray(mem.attendanceDaysList) ? [...mem.attendanceDaysList] : [];
          const currentDailyMap = mem.dailyMinutes ? { ...mem.dailyMinutes } : {};
          const minutesToAdjust = isCurrentlyPresent ? (item.durationMinutes || meetingDurationMinutes) : assignedMinutes;

          if (isCurrentlyPresent) {
            // Reversing to ABSENT
            delete currentDailyMap[item.date];
            await updateDoc(userRef, {
              attendanceDaysList: arrayRemove(item.date),
              attendanceCount: Math.max(0, (mem.attendanceCount || currentDaysList.length) - 1),
              totalMinutes: Math.max(0, (mem.totalMinutes || 0) - minutesToAdjust),
              dailyMinutes: currentDailyMap,
              ...(isToday ? { todayMinutes: Math.max(0, (mem.todayMinutes || 0) - minutesToAdjust) } : {})
            });
          } else {
            // Marking as PRESENT
            const isNewDay = !currentDaysList.includes(item.date);
            currentDailyMap[item.date] = assignedMinutes;
            await updateDoc(userRef, {
              attendanceDaysList: arrayUnion(item.date),
              lastAttendedDate: item.date,
              attendanceCount: increment(isNewDay ? 1 : 0),
              totalMinutes: (mem.totalMinutes || 0) + assignedMinutes,
              dailyMinutes: currentDailyMap,
              ...(isToday ? { todayMinutes: (mem.todayMinutes || 0) + assignedMinutes } : {})
            });
          }
        }
      }

      // 3. Update local state
      setSyncedSessionCorrection(prev => {
        if (!prev) return null;
        return {
          ...prev,
          rows: prev.rows.map(r => {
            if (r.logId === item.logId || (r.memberUid && r.memberUid === item.memberUid)) {
              return {
                ...r,
                logId: effectiveLogId,
                status: newStatus,
                durationMinutes: newStatus === 'present' ? assignedMinutes : 0
              };
            }
            return r;
          })
        };
      });

      if (onRefreshMembers) onRefreshMembers();
      setSyncSuccessMsg(newStatus === 'present'
        ? `Marked "${item.name}" as PRESENT (${assignedMinutes}m credited).`
        : `Reversed "${item.name}" to ABSENT.`
      );
      setTimeout(() => setSyncSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Error toggling member attendance:', err);
      setSyncErrorMsg('Failed to update record: ' + err?.message);
    } finally {
      setUpdatingRowId(null);
    }
  };

  // 5. ADD MANUAL MISSING ATTENDEE TO ACTIVE SESSION
  const handleAddMissingAttendee = async () => {
    if (!syncedSessionCorrection) return;
    const name = addAttendeeName.trim();
    if (!name && !addAttendeeSelectedMemberUid) {
      alert('Please enter a participant name or choose a registered member.');
      return;
    }

    try {
      let matchedMem: UserProfile | null = null;
      if (addAttendeeSelectedMemberUid) {
        matchedMem = members.find(m => m.uid === addAttendeeSelectedMemberUid) || null;
      }

      const attendeeName = matchedMem ? (matchedMem.displayName || matchedMem.email || name) : name;
      const attendeeEmail = matchedMem?.email || '';
      const community = matchedMem ? getMemberWhatsAppCommunity(matchedMem) : 'Guest Visitor';
      const duration = Math.max(1, addAttendeeDuration);

      // Create log in Firestore
      const newLogRef = doc(collection(db, 'zoom_participant_logs'));
      await setDoc(newLogRef, {
        sessionId: syncedSessionCorrection.sessionId,
        sessionTitle: syncedSessionCorrection.title,
        name: attendeeName,
        email: attendeeEmail,
        durationMinutes: duration,
        date: syncedSessionCorrection.date,
        isMember: !!matchedMem,
        memberUid: matchedMem?.uid || '',
        whatsappCommunity: community,
        status: 'present',
        source: 'manual',
        createdAt: serverTimestamp()
      });

      // Credit member if registered
      if (matchedMem?.uid) {
        const userRef = doc(db, 'users', matchedMem.uid);
        const currentDaysList = Array.isArray(matchedMem.attendanceDaysList) ? [...matchedMem.attendanceDaysList] : [];
        const isNewDay = !currentDaysList.includes(syncedSessionCorrection.date);
        const dailyMap = matchedMem.dailyMinutes ? { ...matchedMem.dailyMinutes } : {};
        dailyMap[syncedSessionCorrection.date] = duration;

        await updateDoc(userRef, {
          attendanceDaysList: arrayUnion(syncedSessionCorrection.date),
          lastAttendedDate: syncedSessionCorrection.date,
          attendanceCount: increment(isNewDay ? 1 : 0),
          totalMinutes: (matchedMem.totalMinutes || 0) + duration,
          dailyMinutes: dailyMap
        });
      }

      // Add to local state
      const newRow: SyncedCorrectionRow = {
        logId: newLogRef.id,
        name: attendeeName,
        email: attendeeEmail,
        durationMinutes: duration,
        isMember: !!matchedMem,
        memberUid: matchedMem?.uid || '',
        matchedMember: matchedMem,
        whatsappCommunity: community,
        date: syncedSessionCorrection.date,
        status: 'present',
        source: 'manual'
      };

      setSyncedSessionCorrection(prev => {
        if (!prev) return null;
        // If row was previously absent, replace it; otherwise prepend
        const existingIdx = prev.rows.findIndex(r => r.memberUid && r.memberUid === matchedMem?.uid);
        if (existingIdx !== -1) {
          const updated = [...prev.rows];
          updated[existingIdx] = newRow;
          return { ...prev, rows: updated };
        }
        return { ...prev, rows: [newRow, ...prev.rows] };
      });

      setShowAddAttendeeModal(false);
      setAddAttendeeName('');
      setAddAttendeeSelectedMemberUid('');
      setSyncSuccessMsg(`Added "${attendeeName}" as PRESENT!`);
      if (onRefreshMembers) onRefreshMembers();
    } catch (err: any) {
      console.error('Error adding missing attendee:', err);
      alert('Failed to add attendee: ' + err?.message);
    }
  };

  // 6. COPY FORMATTED ATTENDANCE SUMMARY FOR WHATSAPP
  const handleCopyWhatsAppSummary = () => {
    if (!syncedSessionCorrection) return;

    const presentRows = syncedSessionCorrection.rows.filter(r => r.status === 'present');
    const absentRows = syncedSessionCorrection.rows.filter(r => r.status !== 'present');

    let text = `🔥 *LIGHT UP PRAYER HOUSE — DAILY ONLINE PRAYER ATTENDANCE*\n`;
    text += `📅 *Date:* ${syncedSessionCorrection.date}\n`;
    text += `📖 *Session:* ${syncedSessionCorrection.title}\n`;
    text += `📊 *Summary:* ${presentRows.length} Present | ${absentRows.length} Absent | Total Church Roster: ${members.length}\n\n`;

    text += `✅ *PRESENT MEMBERS (${presentRows.length}):*\n`;
    presentRows.forEach((r, idx) => {
      text += `${idx + 1}. ${r.name}${r.whatsappCommunity ? ` (${r.whatsappCommunity})` : ''}\n`;
    });

    text += `\n❌ *ABSENT MEMBERS (${absentRows.length}):*\n`;
    absentRows.forEach((r, idx) => {
      text += `${idx + 1}. ${r.name}${r.whatsappCommunity ? ` (${r.whatsappCommunity})` : ''}\n`;
    });

    text += `\n🙏 _"The effectual fervent prayer of a righteous man availeth much." (James 5:16)_`;

    navigator.clipboard.writeText(text);
    setSyncSuccessMsg('📋 Formatted attendance summary copied to clipboard! You can paste it into your WhatsApp group.');
    setTimeout(() => setSyncSuccessMsg(''), 4000);
  };

  // 7. DOWNLOAD EXACT ATTENDANCE REPORT CSV
  const handleDownloadAttendanceCSV = () => {
    if (!syncedSessionCorrection) return;

    const presentRows = syncedSessionCorrection.rows.filter(r => r.status === 'present');
    const absentRows = syncedSessionCorrection.rows.filter(r => r.status !== 'present');
    const totalRoster = syncedSessionCorrection.rows.length;
    const rate = totalRoster > 0 ? Math.round((presentRows.length / totalRoster) * 100) : 0;

    // Strict alphabetical order: Present members first (A-Z), Absent members next (A-Z)
    const sortedExportRows = [
      ...presentRows.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
      ...absentRows.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    ];

    const headers = [
      'S/N',
      'Attendance Status',
      'Member / Attendee Name',
      'Member Type',
      'WhatsApp Community',
      'Phone Number',
      'Email',
      'Prayer Minutes',
      'Attendance Source',
      'Session Date'
    ];

    let sn = 1;
    const csvRows = sortedExportRows.map(r => {
      const isPres = r.status === 'present';
      const phone = r.matchedMember?.phone || (r.matchedMember as any)?.whatsappNumber || r.matchedMember?.whatsappGroup || '';
      return [
        `"${sn++}"`,
        `"${isPres ? 'PRESENT' : 'ABSENT'}"`,
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.isMember ? 'Registered Member' : 'Guest Visitor'}"`,
        `"${(r.whatsappCommunity || 'Unassigned').replace(/"/g, '""')}"`,
        `"${phone.replace(/"/g, '""')}"`,
        `"${(r.email || '').replace(/"/g, '""')}"`,
        `"${isPres ? (r.durationMinutes || meetingDurationMinutes) : 0}"`,
        `"${(r.source || 'Online Prayer').replace(/"/g, '""')}"`,
        `"${syncedSessionCorrection.date}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [
      `"LIGHT UP PRAYER HOUSE — DAILY ONLINE PRAYER ATTENDANCE REPORT"`,
      `"Session Title: ${syncedSessionCorrection.title.replace(/"/g, '""')}"`,
      `"Session Date: ${syncedSessionCorrection.date}"`,
      `"Summary: ${presentRows.length} Present, ${absentRows.length} Absent (${rate}% Attendance Rate)"`,
      '',
      headers.join(','),
      ...csvRows
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LightUp_Daily_Prayer_Attendance_${syncedSessionCorrection.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSyncSuccessMsg(`📥 Downloaded exact attendance CSV for ${syncedSessionCorrection.date}!`);
    setTimeout(() => setSyncSuccessMsg(''), 4000);
  };

  // Export any past session as exact attendance CSV
  const handleExportSessionCSV = async (session: ZoomSessionItem) => {
    try {
      setSyncSuccessMsg(`Generating attendance CSV for ${session.meetingDate}...`);
      const q = query(collection(db, 'zoom_participant_logs'), where('sessionId', '==', session.id));
      const snap = await getDocs(q);
      const sessionLogsList = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ZoomParticipantLog[];

      const rows: SyncedCorrectionRow[] = [];
      const presentMemberUids = new Set<string>();

      sessionLogsList.forEach(log => {
        const isPres = log.status !== 'reversed_absent';
        if (log.memberUid && isPres) presentMemberUids.add(log.memberUid);
        const mem = members.find(m => m.uid === log.memberUid) || null;

        rows.push({
          logId: log.id,
          name: log.name,
          email: log.email || '',
          durationMinutes: log.durationMinutes,
          isMember: !!log.isMember,
          memberUid: log.memberUid || '',
          matchedMember: mem,
          whatsappCommunity: log.whatsappCommunity || (mem ? getMemberWhatsAppCommunity(mem) : ''),
          date: session.meetingDate,
          status: isPres ? 'present' : 'reversed_absent',
          source: (log as any).source || 'manual'
        });
      });

      // Add absent members
      const absentMembers = members.filter(m => {
        const uid = m.uid || (m as any).id;
        return uid && !presentMemberUids.has(uid) && !rows.some(r => r.memberUid === uid);
      });

      absentMembers.forEach(mem => {
        rows.push({
          logId: `absent-${mem.uid}-${session.meetingDate}`,
          name: (mem.displayName || mem.email || 'Member').trim(),
          email: mem.email || '',
          durationMinutes: 0,
          isMember: true,
          memberUid: mem.uid,
          matchedMember: mem,
          whatsappCommunity: getMemberWhatsAppCommunity(mem),
          date: session.meetingDate,
          status: 'reversed_absent',
          source: 'manual'
        });
      });

      const presentRows = rows.filter(r => r.status === 'present');
      const absentRows = rows.filter(r => r.status !== 'present');
      const totalRoster = rows.length;
      const rate = totalRoster > 0 ? Math.round((presentRows.length / totalRoster) * 100) : 0;

      const sortedExportRows = [
        ...presentRows.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
        ...absentRows.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      ];

      const headers = [
        'S/N',
        'Attendance Status',
        'Member / Attendee Name',
        'Member Type',
        'WhatsApp Community',
        'Phone Number',
        'Email',
        'Prayer Minutes',
        'Attendance Source',
        'Session Date'
      ];

      let sn = 1;
      const csvRows = sortedExportRows.map(r => {
        const isPres = r.status === 'present';
        const phone = r.matchedMember?.phone || (r.matchedMember as any)?.whatsappNumber || r.matchedMember?.whatsappGroup || '';
        return [
          `"${sn++}"`,
          `"${isPres ? 'PRESENT' : 'ABSENT'}"`,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${r.isMember ? 'Registered Member' : 'Guest Visitor'}"`,
          `"${(r.whatsappCommunity || 'Unassigned').replace(/"/g, '""')}"`,
          `"${phone.replace(/"/g, '""')}"`,
          `"${(r.email || '').replace(/"/g, '""')}"`,
          `"${isPres ? (r.durationMinutes || meetingDurationMinutes) : 0}"`,
          `"${(r.source || 'Online Prayer').replace(/"/g, '""')}"`,
          `"${session.meetingDate}"`
        ].join(',');
      });

      const csvContent = '\uFEFF' + [
        `"LIGHT UP PRAYER HOUSE — DAILY ONLINE PRAYER ATTENDANCE REPORT"`,
        `"Session Title: ${session.title.replace(/"/g, '""')}"`,
        `"Session Date: ${session.meetingDate}"`,
        `"Summary: ${presentRows.length} Present, ${absentRows.length} Absent (${rate}% Attendance Rate)"`,
        '',
        headers.join(','),
        ...csvRows
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `LightUp_Prayer_Attendance_${session.meetingDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSyncSuccessMsg(`📥 Downloaded exact attendance CSV for ${session.meetingDate}!`);
      setTimeout(() => setSyncSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Error exporting session CSV:', err);
      alert('Could not export CSV: ' + err?.message);
    }
  };

  // 8. LOAD PAST SESSIONS FOR CORRECTION
  const loadPastSessions = async () => {
    setLoadingSessions(true);
    try {
      const q = query(collection(db, 'zoom_sessions'), orderBy('meetingDate', 'desc'), limit(30));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as ZoomSessionItem[];
      setSessions(list);
    } catch (err) {
      console.error('Error loading sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'history') {
      loadPastSessions();
    }
  }, [activeSubTab]);

  // Load selected session into correction station
  const handleLoadSessionForCorrection = async (session: ZoomSessionItem) => {
    try {
      setIsProcessing(true);
      const q = query(collection(db, 'zoom_participant_logs'), where('sessionId', '==', session.id));
      const snap = await getDocs(q);
      const sessionLogsList = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ZoomParticipantLog[];

      const rows: SyncedCorrectionRow[] = [];
      const presentMemberUids = new Set<string>();

      sessionLogsList.forEach(log => {
        const isPres = log.status !== 'reversed_absent';
        if (log.memberUid && isPres) presentMemberUids.add(log.memberUid);
        const mem = members.find(m => m.uid === log.memberUid) || null;

        rows.push({
          logId: log.id,
          name: log.name,
          email: log.email || '',
          durationMinutes: log.durationMinutes,
          isMember: log.isMember,
          memberUid: log.memberUid || '',
          matchedMember: mem,
          whatsappCommunity: log.whatsappCommunity || (mem ? getMemberWhatsAppCommunity(mem) : ''),
          date: session.meetingDate,
          status: isPres ? 'present' : 'reversed_absent',
          source: (log as any).source || 'manual'
        });
      });

      // Add absent members if not logged
      const absentMembers = members.filter(m => {
        const uid = m.uid || (m as any).id;
        return uid && !presentMemberUids.has(uid) && !rows.some(r => r.memberUid === uid);
      });

      absentMembers.forEach(mem => {
        rows.push({
          logId: `absent-${mem.uid}-${session.meetingDate}`,
          name: (mem.displayName || mem.email || 'Member').trim(),
          email: mem.email || '',
          durationMinutes: 0,
          isMember: true,
          memberUid: mem.uid,
          matchedMember: mem,
          whatsappCommunity: getMemberWhatsAppCommunity(mem),
          date: session.meetingDate,
          status: 'reversed_absent',
          source: 'manual'
        });
      });

      // Sort: Present members first (A-Z), Absent members next (A-Z)
      rows.sort((a, b) => {
        const aPresent = a.status === 'present';
        const bPresent = b.status === 'present';
        if (aPresent !== bPresent) {
          return aPresent ? -1 : 1;
        }
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      });

      setSyncedSessionCorrection({
        sessionId: session.id,
        title: session.title,
        date: session.meetingDate,
        totalParticipants: session.totalParticipants,
        totalMinutes: session.totalMinutes,
        rows
      });

      setActiveSubTab('correction');
      setSyncSuccessMsg(`Loaded session "${session.title}" (${session.meetingDate}) for manual correction.`);
    } catch (err: any) {
      console.error('Error loading session for correction:', err);
      alert('Could not load session: ' + err?.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete session
  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to delete this session? Participant records for this session will be removed.')) return;
    try {
      await deleteDoc(doc(db, 'zoom_sessions', sessionId));
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setSyncSuccessMsg('Session deleted.');
    } catch (err: any) {
      console.error('Error deleting session:', err);
    }
  };

  // Sample data helpers for instant testing
  const handlePasteSampleZoom = () => {
    const sample = `Pastor Osaro Aghedo (Host) 90 mins
Sister Grace Oladipo (grace@example.com) 60 mins
Brother Emmanuel 75 mins
Deaconess Mary Johnson 60 mins
Guest Visitor London 45 mins`;
    setZoomPastedText(sample);
  };

  const handlePasteSampleWhatsApp = () => {
    const sample = `[10/26/26, 6:05:12 AM] Sis Blessing: Present 🙏
[10/26/26, 6:08:30 AM] Bro David (Lagos): Online for prayers
1. Pastor Osaro Aghedo
2. Sis Mary Johnson - Present
3. Bro Emmanuel - Online
+234 801 234 5678 - Sis Esther (Benin)`;
    setWhatsappPastedText(sample);
  };

  // Filtered rows in Manual Correction Station
  const filteredCorrectionRows = useMemo(() => {
    if (!syncedSessionCorrection) return [];
    return syncedSessionCorrection.rows
      .filter(r => {
        if (correctionStatusFilter === 'present' && r.status !== 'present') return false;
        if (correctionStatusFilter === 'absent' && r.status === 'present') return false;
        if (correctionStatusFilter === 'guest' && r.isMember) return false;

        if (correctionCommunityFilter !== 'all') {
          const comm = (r.whatsappCommunity || 'Unassigned').toLowerCase().trim();
          if (comm !== correctionCommunityFilter.toLowerCase().trim()) return false;
        }

        if (correctionSearchFilter.trim()) {
          const q = correctionSearchFilter.toLowerCase().trim();
          return (
            r.name.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q) ||
            (r.whatsappCommunity && r.whatsappCommunity.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Present first (A-Z), then Absent (A-Z)
        const aPresent = a.status === 'present';
        const bPresent = b.status === 'present';
        if (aPresent !== bPresent) {
          return aPresent ? -1 : 1;
        }
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      });
  }, [syncedSessionCorrection, correctionStatusFilter, correctionCommunityFilter, correctionSearchFilter]);

  const presentCount = syncedSessionCorrection?.rows.filter(r => r.status === 'present').length || 0;
  const absentCount = syncedSessionCorrection?.rows.filter(r => r.status !== 'present').length || 0;
  const guestCount = syncedSessionCorrection?.rows.filter(r => !r.isMember && r.status === 'present').length || 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-[#F26522] mb-1">
            <Sparkles size={14} />
            <span>Daily Online Prayer Attendance Station</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1A1F3C]">
            Zoom & WhatsApp Attendance Marking
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm font-medium max-w-2xl mt-0.5">
            Simply paste your Zoom participant list and WhatsApp prayer check-ins. The system automatically marks present members, reveals absentees, and allows 1-click manual correction.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center space-x-2">
          {syncedSessionCorrection && activeSubTab !== 'correction' && (
            <button
              onClick={() => setActiveSubTab('correction')}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
            >
              <CheckCircle2 size={14} />
              <span>Active Roster ({presentCount} Present)</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Sub Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setActiveSubTab('paste')}
          className={cn(
            "flex items-center space-x-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            activeSubTab === 'paste'
              ? "bg-[#F26522] text-white shadow-lg shadow-[#F26522]/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-100"
          )}
        >
          <ClipboardPaste size={16} />
          <span>1. Paste & Auto-Mark (Zoom & WhatsApp)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('correction')}
          className={cn(
            "flex items-center space-x-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            activeSubTab === 'correction'
              ? "bg-[#1A1F3C] text-white shadow-lg shadow-[#1A1F3C]/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-100"
          )}
        >
          <UserCheck size={16} />
          <span>2. Manual Correction & Attendance Roster</span>
          {syncedSessionCorrection && (
            <span className="ml-1.5 px-2 py-0.5 bg-emerald-500 text-white text-[10px] rounded-full font-black">
              {presentCount} P / {absentCount} A
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={cn(
            "flex items-center space-x-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            activeSubTab === 'history'
              ? "bg-[#1A1F3C] text-white shadow-lg shadow-[#1A1F3C]/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-100"
          )}
        >
          <Calendar size={16} />
          <span>3. Past Prayer Sessions</span>
        </button>
      </div>

      {/* Notifications */}
      {syncSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs sm:text-sm font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{syncSuccessMsg}</span>
          </div>
          <button onClick={() => setSyncSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {syncErrorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            <span>{syncErrorMsg}</span>
          </div>
          <button onClick={() => setSyncErrorMsg('')} className="text-rose-700 hover:text-rose-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: PASTE ZOOM & WHATSAPP ATTENDANCE RECORDS (STREAMLINED ONLY-PASTING) */}
      {/* ========================================================================= */}
      {activeSubTab === 'paste' && (
        <div className="space-y-6">
          {/* Meeting Session Configuration Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-[#1A1F3C] uppercase tracking-wider flex items-center space-x-2">
                <Calendar size={18} className="text-[#F26522]" />
                <span>Prayer Meeting Session Details</span>
              </h3>
              <span className="text-xs font-bold text-gray-400">
                Registered Church Members: <strong className="text-[#1A1F3C]">{members.length}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Session Title</label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="e.g. Daily Online Prayer Meeting"
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-xs font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black uppercase text-gray-400">Meeting Date</label>
                  <button
                    type="button"
                    onClick={() => setMeetingDate(getTodayDateString())}
                    className="text-[10px] font-bold text-[#F26522] hover:underline cursor-pointer"
                  >
                    Set to Today
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-xs font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522]"
                  />
                  {meetingDate === getTodayDateString() && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md pointer-events-none">
                      Today
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Standard Prayer Duration (Mins)</label>
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={meetingDurationMinutes}
                  onChange={(e) => setMeetingDurationMinutes(parseInt(e.target.value) || 60)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-xs font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>
            </div>
          </div>

          {/* Dual Dedicated Paste Stations: Zoom & WhatsApp */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box 1: Paste Zoom Attendance Record */}
            <div className="bg-white rounded-3xl p-6 border-2 border-blue-100 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                      <Video size={20} />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-[#1A1F3C]">Paste Zoom Record</h4>
                      <p className="text-[11px] text-gray-400 font-medium">Participant window text, chat export, or meeting log</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handlePasteSampleZoom}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                      title="Insert sample Zoom list to test"
                    >
                      Sample Zoom
                    </button>
                    {zoomPastedText && (
                      <button
                        type="button"
                        onClick={() => setZoomPastedText('')}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={9}
                  value={zoomPastedText}
                  onChange={(e) => setZoomPastedText(e.target.value)}
                  placeholder={`Paste Zoom attendee list or chat records here...\n\nExample:\nPastor Osaro Aghedo (Host) 90 mins\nSister Grace Oladipo (grace@example.com) 60 mins\nBrother Emmanuel 75 mins\nDeaconess Mary Johnson 60 mins\nGuest Visitor London 45 mins`}
                  className="w-full p-4 bg-blue-50/20 rounded-2xl text-xs font-mono border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                <span>
                  {zoomPastedText ? (
                    <strong className="text-blue-600">{zoomPastedText.split('\n').filter(l => l.trim()).length} lines pasted</strong>
                  ) : (
                    'Copy names from Zoom meeting window and paste here'
                  )}
                </span>
                <span className="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-bold">Zoom Source</span>
              </div>
            </div>

            {/* Box 2: Paste WhatsApp Attendance Record */}
            <div className="bg-white rounded-3xl p-6 border-2 border-emerald-100 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                      <MessageCircle size={20} />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-[#1A1F3C]">Paste WhatsApp Record</h4>
                      <p className="text-[11px] text-gray-400 font-medium">WhatsApp prayer group roll call, check-ins, or chat</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handlePasteSampleWhatsApp}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                      title="Insert sample WhatsApp check-ins to test"
                    >
                      Sample WhatsApp
                    </button>
                    {whatsappPastedText && (
                      <button
                        type="button"
                        onClick={() => setWhatsappPastedText('')}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={9}
                  value={whatsappPastedText}
                  onChange={(e) => setWhatsappPastedText(e.target.value)}
                  placeholder={`Paste WhatsApp prayer attendance list or roll call here...\n\nExample:\n[10/26/26, 6:05:12 AM] Sis Blessing: Present 🙏\n[10/26/26, 6:08:30 AM] Bro David (Lagos): Online for prayers\n1. Pastor Osaro Aghedo\n2. Sis Mary Johnson - Present\n3. Bro Emmanuel - Online\n+234 801 234 5678 - Sis Esther (Benin)`}
                  className="w-full p-4 bg-emerald-50/20 rounded-2xl text-xs font-mono border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                <span>
                  {whatsappPastedText ? (
                    <strong className="text-emerald-600">{whatsappPastedText.split('\n').filter(l => l.trim()).length} lines pasted</strong>
                  ) : (
                    'Copy attendance list from WhatsApp group and paste here'
                  )}
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold">WhatsApp Source</span>
              </div>
            </div>
          </div>

          {/* Unified Action Button */}
          <div className="bg-gradient-to-r from-[#1A1F3C] via-[#282E5C] to-[#1A1F3C] p-6 sm:p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h4 className="text-lg sm:text-xl font-black flex items-center space-x-2">
                <Sparkles size={20} className="text-amber-400" />
                <span>Ready to Mark Online Prayer Attendance?</span>
              </h4>
              <p className="text-gray-300 text-xs sm:text-sm font-medium max-w-xl">
                The auto-marker will parse pasted names, match registered members across Zoom & WhatsApp, mark them as <strong>Present</strong>, list all <strong>Absent</strong> members, and open the 1-click Manual Correction Station.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAutoMarkFromPastedRecords}
              disabled={isProcessing || (!zoomPastedText.trim() && !whatsappPastedText.trim())}
              className="flex items-center justify-center space-x-2 px-8 py-4 bg-[#F26522] hover:bg-[#d9561a] disabled:opacity-50 text-white rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg shadow-[#F26522]/30 transition-all cursor-pointer shrink-0"
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Auto-Marking Attendance...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Mark Attendance From Pasted Records</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MANUAL CORRECTION & ATTENDANCE ROSTER (PERMIT MANUAL CORRECTION)  */}
      {/* ========================================================================= */}
      {activeSubTab === 'correction' && (
        <div className="space-y-6">
          {!syncedSessionCorrection ? (
            <div className="bg-white rounded-3xl p-12 border border-gray-100 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-[#1A1F3C]">No Active Attendance Session Loaded</h3>
              <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto">
                Please paste your Zoom or WhatsApp attendance records in Tab 1, or open any past prayer session from Tab 3 to review and make manual corrections.
              </p>
              <button
                onClick={() => setActiveSubTab('paste')}
                className="px-6 py-3 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Go to Paste Attendance Records
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Session Info Bar */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-[#1A1F3C] text-white text-[10px] font-black uppercase tracking-wider rounded-lg">
                      {syncedSessionCorrection.date}
                    </span>
                    <span className="text-xs text-gray-400 font-bold">Manual Correction Station</span>
                  </div>
                  <h3 className="text-xl font-black text-[#1A1F3C] mt-1">{syncedSessionCorrection.title}</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAttendeeModal(true)}
                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Attendee</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadAttendanceCSV}
                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                    title="Download exact attendance CSV report (Present first A-Z, Absent next A-Z)"
                  >
                    <Download size={14} />
                    <span>Download Attendance CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyWhatsAppSummary}
                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                    title="Copy formatted WhatsApp attendance report"
                  >
                    <Share2 size={14} />
                    <span>Copy WhatsApp Summary</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab('paste')}
                    className="flex items-center space-x-1 px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <span>Paste New Session</span>
                  </button>
                </div>
              </div>

              {/* Comprehensive Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Total Church Roster</span>
                  <p className="text-2xl font-black text-[#1A1F3C]">{members.length}</p>
                  <p className="text-[10px] text-gray-400 font-medium">Registered members</p>
                </div>

                <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-700 flex items-center space-x-1">
                    <CheckCircle2 size={12} />
                    <span>Present Members</span>
                  </span>
                  <p className="text-2xl font-black text-emerald-600">{presentCount}</p>
                  <p className="text-[10px] text-emerald-700 font-medium">
                    {members.length > 0 ? Math.round((presentCount / members.length) * 100) : 0}% attendance rate
                  </p>
                </div>

                <div className="bg-rose-50/70 p-5 rounded-2xl border border-rose-200 shadow-xs space-y-1">
                  <span className="text-[10px] font-black uppercase text-rose-700 flex items-center space-x-1">
                    <XCircle size={12} />
                    <span>Absent Members</span>
                  </span>
                  <p className="text-2xl font-black text-rose-600">{absentCount}</p>
                  <p className="text-[10px] text-rose-700 font-medium">Available for 1-click marking</p>
                </div>

                <div className="bg-purple-50/70 p-5 rounded-2xl border border-purple-200 shadow-xs space-y-1">
                  <span className="text-[10px] font-black uppercase text-purple-700">Guest Visitors</span>
                  <p className="text-2xl font-black text-purple-600">{guestCount}</p>
                  <p className="text-[10px] text-purple-700 font-medium">Unregistered attendees</p>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Status filter pills */}
                <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setCorrectionStatusFilter('all')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                      correctionStatusFilter === 'all'
                        ? "bg-[#1A1F3C] text-white shadow-xs"
                        : "text-gray-600 hover:text-[#1A1F3C]"
                    )}
                  >
                    All ({syncedSessionCorrection.rows.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setCorrectionStatusFilter('present')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1",
                      correctionStatusFilter === 'present'
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-emerald-700 hover:bg-emerald-50"
                    )}
                  >
                    <CheckCircle2 size={12} />
                    <span>Present ({presentCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCorrectionStatusFilter('absent')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1",
                      correctionStatusFilter === 'absent'
                        ? "bg-rose-600 text-white shadow-xs"
                        : "text-rose-700 hover:bg-rose-50"
                    )}
                  >
                    <XCircle size={12} />
                    <span>Absent ({absentCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCorrectionStatusFilter('guest')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                      correctionStatusFilter === 'guest'
                        ? "bg-purple-700 text-white shadow-xs"
                        : "text-purple-700 hover:bg-purple-50"
                    )}
                  >
                    Guests ({guestCount})
                  </button>
                </div>

                {/* Search & Community filter */}
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={correctionSearchFilter}
                      onChange={(e) => setCorrectionSearchFilter(e.target.value)}
                      placeholder="Search member name..."
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-xl text-xs font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522]"
                    />
                  </div>

                  <select
                    value={correctionCommunityFilter}
                    onChange={(e) => setCorrectionCommunityFilter(e.target.value)}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#1A1F3C] outline-none cursor-pointer w-full sm:w-auto"
                  >
                    <option value="all">All Communities</option>
                    {WHATSAPP_COMMUNITY_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option value="Unassigned">Unassigned</option>
                  </select>
                </div>
              </div>

              {/* Roster Table: Strictly Present Members FIRST (A-Z), Absent Members NEXT (A-Z) */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-600">
                    Showing {filteredCorrectionRows.length} Members (Matches/Present Listed First A–Z, Followed by Absent A–Z)
                  </span>
                  <span className="text-[11px] text-gray-400 font-medium">
                    Click "Present" or "Absent" to instantly correct status in database
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100/70 text-gray-600 font-black uppercase tracking-wider border-b border-gray-200 sticky top-0 z-20">
                        <th className="p-3.5 pl-5 min-w-[220px]">Member / Attendee</th>
                        <th className="p-3.5 text-center min-w-[200px]">1-Click Correction (Present / Absent)</th>
                        <th className="p-3.5 min-w-[150px]">Current Status</th>
                        <th className="p-3.5 min-w-[170px]">WhatsApp Community</th>
                        <th className="p-3.5 min-w-[160px]">Contact Info</th>
                        <th className="p-3.5 text-right pr-5 min-w-[120px]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {filteredCorrectionRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400 font-bold">
                            No members found matching your filter.
                          </td>
                        </tr>
                      ) : (
                        filteredCorrectionRows.map((row) => {
                          const isPresent = row.status === 'present';
                          const isUpdating = updatingRowId === (row.logId || row.name);
                          const phone = row.matchedMember?.phone || (row.matchedMember as any)?.whatsappNumber || '';
                          const cleanPhone = phone.replace(/\D/g, '');

                          return (
                            <tr
                              key={row.logId || row.name}
                              className={cn(
                                "hover:bg-gray-50 transition-colors",
                                !isPresent && "bg-rose-50/20"
                              )}
                            >
                              {/* Member Name */}
                              <td className="p-3.5 pl-5 font-bold text-[#1A1F3C]">
                                <div className="flex items-center space-x-2.5">
                                  <div className={cn(
                                    "w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs",
                                    isPresent ? "bg-emerald-600" : "bg-rose-500"
                                  )}>
                                    {row.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-black text-sm text-[#1A1F3C] leading-snug">{row.name}</p>
                                    <div className="flex items-center space-x-1.5 text-[10px]">
                                      {row.isMember ? (
                                        <span className="text-gray-400 font-medium">Registered Member</span>
                                      ) : (
                                        <span className="text-purple-600 font-bold bg-purple-50 px-1.5 py-0.2 rounded">Visitor</span>
                                      )}
                                      {row.source && (
                                        <span className="text-gray-400 capitalize">via {row.source}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* 1-Click Correction Buttons: Present / Absent */}
                              <td className="p-3.5 text-center">
                                <div className="inline-flex items-center space-x-1.5 bg-gray-100 p-1 rounded-xl">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleRowAttendance(row, 'present')}
                                    disabled={isUpdating}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer",
                                      isPresent
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50"
                                    )}
                                    title={isPresent ? "Currently marked Present" : "Click to mark Present"}
                                  >
                                    <CheckCircle2 size={12} />
                                    <span>Present</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleRowAttendance(row, 'reversed_absent')}
                                    disabled={isUpdating}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer",
                                      !isPresent
                                        ? "bg-rose-600 text-white shadow-xs"
                                        : "bg-white text-rose-800 border border-rose-300 hover:bg-rose-50"
                                    )}
                                    title={!isPresent ? "Currently marked Absent" : "Click to mark Absent"}
                                  >
                                    <XCircle size={12} />
                                    <span>Absent</span>
                                  </button>
                                </div>
                              </td>

                              {/* Current Status Badge */}
                              <td className="p-3.5">
                                {isPresent ? (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase rounded-lg border border-emerald-200">
                                    <CheckCircle2 size={12} />
                                    <span>PRESENT</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-100 text-rose-800 text-[11px] font-black uppercase rounded-lg border border-rose-200">
                                    <XCircle size={12} />
                                    <span>ABSENT</span>
                                  </span>
                                )}
                              </td>

                              {/* WhatsApp Community */}
                              <td className="p-3.5">
                                {row.whatsappCommunity ? (
                                  <span className="px-2.5 py-1 bg-gray-100 text-[#1A1F3C] text-[10px] font-bold rounded-lg border border-gray-200">
                                    {row.whatsappCommunity}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs">—</span>
                                )}
                              </td>

                              {/* Contact Info */}
                              <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                                {row.email || phone || '—'}
                              </td>

                              {/* Action: WhatsApp Follow-Up */}
                              <td className="p-3.5 pr-5 text-right">
                                {cleanPhone ? (
                                  <a
                                    href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                                      !isPresent
                                        ? `Peace and grace beloved ${row.name}! We noticed you couldn't make it to today's Light Up Online Prayer session. We prayed for you and look forward to connecting with you tomorrow! 🔥🙏`
                                        : `Peace and grace beloved ${row.name}! Thank you for joining today's online prayer meeting at Light Up Prayer House. God bless you richly!`
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition-colors"
                                  >
                                    <MessageCircle size={12} />
                                    <span>{!isPresent ? 'Follow-Up' : 'Chat'}</span>
                                  </a>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PAST PRAYER SESSIONS HISTORY                                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'history' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-[#1A1F3C] uppercase">Past Daily Prayer Sessions</h3>
              <p className="text-gray-400 text-xs font-medium">
                Click "Open for Manual Correction" on any session to review and adjust Present & Absent members.
              </p>
            </div>
            <button
              onClick={loadPastSessions}
              className="flex items-center space-x-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} />
              <span>Refresh History</span>
            </button>
          </div>

          {loadingSessions ? (
            <div className="p-16 bg-white rounded-3xl border border-gray-100 text-center space-y-3 text-gray-400">
              <RefreshCw size={32} className="animate-spin mx-auto text-[#F26522]" />
              <p className="font-bold text-sm">Loading prayer session history...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-16 bg-white rounded-3xl border border-gray-100 text-center space-y-3">
              <Video size={48} className="mx-auto text-gray-300" />
              <h4 className="font-black text-[#1A1F3C] text-lg">No Prayer Sessions Recorded Yet</h4>
              <p className="text-gray-400 text-xs max-w-sm mx-auto">
                Paste your Zoom or WhatsApp attendance records in Tab 1 to auto-mark your first prayer meeting.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map(session => (
                <div 
                  key={session.id}
                  className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                        {session.meetingDate}
                      </span>
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="text-gray-300 hover:text-red-500 p-1 transition-colors cursor-pointer"
                        title="Delete session"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <h4 className="font-black text-base text-[#1A1F3C]">{session.title}</h4>
                    {session.notes && (
                      <p className="text-xs text-gray-400 italic">{session.notes}</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex justify-between text-xs font-bold text-gray-500">
                      <span>Attendees: <strong className="text-[#1A1F3C]">{session.totalParticipants}</strong></span>
                      <span>Total Time: <strong className="text-[#F26522]">{session.totalMinutes} mins</strong></span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleLoadSessionForCorrection(session)}
                        className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 bg-[#1A1F3C] hover:bg-[#282E5C] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
                      >
                        <UserCheck size={14} />
                        <span>Manual Correction</span>
                      </button>

                      <button
                        onClick={() => handleExportSessionCSV(session)}
                        className="flex items-center justify-center space-x-1 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                        title="Download exact attendance CSV for this session"
                      >
                        <Download size={14} />
                        <span>CSV</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD MISSING ATTENDEE TO ACTIVE SESSION                             */}
      {/* ========================================================================= */}
      {showAddAttendeeModal && (
        <div 
          onClick={() => setShowAddAttendeeModal(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl border border-gray-100"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-black text-[#1A1F3C] flex items-center space-x-2">
                <Plus size={18} className="text-[#F26522]" />
                <span>Add Missing Attendee as Present</span>
              </h3>
              <button onClick={() => setShowAddAttendeeModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Option A: Select from Registered Members */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-500 mb-1">Select from Registered Church Members</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={addAttendeeSearch}
                    onChange={(e) => setAddAttendeeSearch(e.target.value)}
                    placeholder="Search member roster..."
                    className="w-full px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold border border-gray-200 outline-none"
                  />
                  <select
                    value={addAttendeeSelectedMemberUid}
                    onChange={(e) => {
                      setAddAttendeeSelectedMemberUid(e.target.value);
                      const m = members.find(mem => mem.uid === e.target.value);
                      if (m) setAddAttendeeName(m.displayName || m.email || '');
                    }}
                    className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-xs font-bold border border-gray-200 outline-none cursor-pointer"
                  >
                    <option value="">-- Choose a registered member --</option>
                    {members
                      .filter(m => {
                        if (!addAttendeeSearch) return true;
                        const q = addAttendeeSearch.toLowerCase();
                        return (m.displayName || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
                      })
                      .map(m => (
                        <option key={m.uid} value={m.uid}>
                          {m.displayName || m.email} ({getMemberWhatsAppCommunity(m)})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Option B: Or enter custom visitor name */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-500 mb-1">Or Enter Attendee / Guest Name</label>
                <input
                  type="text"
                  value={addAttendeeName}
                  onChange={(e) => setAddAttendeeName(e.target.value)}
                  placeholder="e.g. Brother John Doe, Sister Mary"
                  className="w-full px-4 py-2.5 bg-gray-50 rounded-xl text-xs font-bold border border-gray-200 outline-none"
                />
              </div>

              {/* Prayer Minutes */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-500 mb-1">Prayer Duration (Minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={addAttendeeDuration}
                  onChange={(e) => setAddAttendeeDuration(parseInt(e.target.value) || 60)}
                  className="w-full px-4 py-2 bg-gray-50 rounded-xl text-xs font-bold border border-gray-200 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddAttendeeModal(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddMissingAttendee}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
              >
                Mark as Present
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
