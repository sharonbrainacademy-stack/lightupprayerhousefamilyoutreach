/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './auth';
import { markAttendanceForToday, getTodayDateString, syncExactPrayerMinutes } from './attendance';
import { JoinPrayerModal } from '../components/JoinPrayerModal';

export const ZOOM_MEETING_URL = "https://us06web.zoom.us/j/88218305077?pwd=S8eJdfwpKQfZNhBkJPfOkJBoaIoHmg.1";
export const ZOOM_EMBED_URL = "https://zoom.us/wc/88218305077/join?pwd=S8eJdfwpKQfZNhBkJPfOkJBoaIoHmg.1";
export const ZOOM_MEETING_ID = "882 1830 5077";
export const ZOOM_PASSCODE = "308137";

export function getOrCreateGuestId(): string {
  let guestId = localStorage.getItem('guest_device_id');
  if (!guestId) {
    guestId = 'Guest-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('guest_device_id', guestId);
  }
  return guestId;
}

export function getDeviceInfo(): string {
  if (typeof navigator === 'undefined') return 'Web Browser';
  const ua = navigator.userAgent;
  
  if (/android/i.test(ua)) {
    const match = ua.match(/Android\s+([^\s;]+);\s+([^;)]+)/);
    if (match && match[2]) return `Android (${match[2].trim()})`;
    return 'Android Mobile';
  }
  if (/iPhone/i.test(ua)) {
    return 'iPhone';
  }
  if (/iPad/i.test(ua)) {
    return 'iPad';
  }
  if (/Macintosh/i.test(ua)) return 'Mac OS';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux PC';
  
  return 'Web Browser';
}

/**
 * Returns a permanent, deterministic document key for each unique visitor.
 * Deduplicates by phone if present, then by name, then by unique device ID.
 */
export function getGuestDocKey(phone?: string, name?: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone.length >= 7) {
    return `phone_${cleanPhone}`;
  }
  const cleanName = (name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (cleanName && cleanName !== 'anonymous_guest' && cleanName !== 'guest' && cleanName.length > 2) {
    return `name_${cleanName}`;
  }
  return `id_${getOrCreateGuestId()}`;
}

export interface GuestProfileData {
  guestId: string;
  guestName: string;
  guestPhone: string;
  todaySeconds: number;
  todayMinutes: number;
  yearlySeconds: number;
  yearlyMinutes: number;
  lastDateStr?: string;
  lastActiveAt?: any;
  deviceInfo?: string;
  isWiped: boolean;
}

/**
 * Fetch unified visitor record and calculate if daily records should be wiped (after 3 hours or on a new day)
 * while preserving the yearly records permanently.
 */
export async function getUnifiedGuestProfile(guestKey: string, todayStr: string): Promise<GuestProfileData> {
  const defaultProfile: GuestProfileData = {
    guestId: guestKey,
    guestName: localStorage.getItem('zoom_guest_name') || 'Anonymous Guest',
    guestPhone: localStorage.getItem('zoom_guest_phone') || '',
    todaySeconds: 0,
    todayMinutes: 0,
    yearlySeconds: 0,
    yearlyMinutes: 0,
    lastDateStr: todayStr,
    deviceInfo: getDeviceInfo(),
    isWiped: true,
  };

  try {
    const guestDocRef = doc(db, 'guest_attendance', guestKey);
    const snap = await getDoc(guestDocRef);
    
    if (snap.exists()) {
      const data = snap.data();
      const name = data.guestName || defaultProfile.guestName;
      const phone = data.guestPhone || defaultProfile.guestPhone;
      
      const lastDate = data.lastDateStr || data.dateStr || '';
      let lastActiveMs = 0;
      if (data.lastActiveAt?.seconds) {
        lastActiveMs = data.lastActiveAt.seconds * 1000;
      } else if (data.lastActiveAt?.toMillis) {
        lastActiveMs = data.lastActiveAt.toMillis();
      }

      const threeHoursMs = 3 * 60 * 60 * 1000;
      const isNewDay = Boolean(lastDate && lastDate !== todayStr);
      const isOlderThan3Hours = Boolean(lastActiveMs > 0 && (Date.now() - lastActiveMs > threeHoursMs));
      const shouldWipeDaily = isNewDay || isOlderThan3Hours;

      // Yearly records continue accumulating forever
      const yearlySecs = data.yearlySeconds || data.totalSeconds || 0;
      const yearlyMins = data.yearlyMinutes || data.totalMinutes || Math.floor(yearlySecs / 60);

      // Daily records: wipe to 0 if new day or >3h since last active, otherwise continue
      const todaySecs = shouldWipeDaily ? 0 : (data.todaySeconds || data.totalSeconds || 0);
      const todayMins = Math.floor(todaySecs / 60);

      return {
        guestId: guestKey,
        guestName: name,
        guestPhone: phone,
        todaySeconds: todaySecs,
        todayMinutes: todayMins,
        yearlySeconds: yearlySecs,
        yearlyMinutes: yearlyMins,
        lastDateStr: lastDate,
        lastActiveAt: data.lastActiveAt,
        deviceInfo: data.deviceInfo || getDeviceInfo(),
        isWiped: shouldWipeDaily,
      };
    }
  } catch (err) {
    console.warn('Error fetching unified guest profile:', err);
  }

  return defaultProfile;
}

/**
 * Sync visitor attendance to their unified record in Firestore.
 * Updates daily time (wiped after 3h/new day) AND accumulates yearly time permanently.
 */
export async function syncUnifiedGuestAttendance(
  guestKey: string,
  todayStr: string,
  currentSessionElapsedSecs: number,
  baseTodaySecs: number,
  baseYearlySecs: number,
  isCompleted: boolean = false,
  isInitial: boolean = false,
  guestName: string = 'Anonymous Guest',
  guestPhone: string = ''
) {
  try {
    const guestDocRef = doc(db, 'guest_attendance', guestKey);

    const savedName = localStorage.getItem('zoom_guest_name') || '';
    const savedPhone = localStorage.getItem('zoom_guest_phone') || '';

    const finalName = (guestName && guestName !== 'Anonymous Guest')
      ? guestName 
      : (savedName || 'Anonymous Guest');

    const finalPhone = guestPhone || savedPhone || '';

    const newTodaySeconds = Math.max(0, baseTodaySecs + currentSessionElapsedSecs);
    const newYearlySeconds = Math.max(0, baseYearlySecs + currentSessionElapsedSecs);

    const data: any = {
      guestId: guestKey,
      guestName: finalName,
      guestPhone: finalPhone,
      lastDateStr: todayStr,
      dateStr: todayStr, // For backward compatibility
      todaySeconds: newTodaySeconds,
      todayMinutes: Math.floor(newTodaySeconds / 60),
      yearlySeconds: newYearlySeconds,
      yearlyMinutes: Math.floor(newYearlySeconds / 60),
      totalSeconds: newYearlySeconds, // backward compatibility
      totalMinutes: Math.floor(newYearlySeconds / 60), // backward compatibility
      lastActiveAt: serverTimestamp(),
      deviceInfo: getDeviceInfo(),
      status: isCompleted ? 'completed' : 'active',
      meetingType: 'Zoom Prayer Meeting',
    };

    if (isInitial) {
      data.firstSeenAt = serverTimestamp();
      data.joinedAt = serverTimestamp();
    }

    await setDoc(guestDocRef, data, { merge: true });
  } catch (err) {
    console.error('Error syncing unified guest attendance to Firestore:', err);
  }
}

/**
 * Direct immediate guest check-in / profile registration
 */
export async function recordGuestAttendanceImmediate(
  name?: string,
  phone?: string,
  extraSeconds: number = 0
) {
  const effectiveName = (name || localStorage.getItem('zoom_guest_name') || 'Anonymous Guest').trim();
  const effectivePhone = (phone || localStorage.getItem('zoom_guest_phone') || '').trim();
  const guestKey = getGuestDocKey(effectivePhone, effectiveName);
  const todayStr = getTodayDateString();

  try {
    const guestDocRef = doc(db, 'guest_attendance', guestKey);
    const snap = await getDoc(guestDocRef);
    let todaySecs = extraSeconds;
    let yearlySecs = extraSeconds;

    if (snap.exists()) {
      const data = snap.data();
      const lastDate = data.lastDateStr || data.dateStr || '';
      const isToday = lastDate === todayStr;
      
      const lastActiveMs = data.lastActiveAt?.seconds ? data.lastActiveAt.seconds * 1000 : 0;
      const isWithin3Hours = lastActiveMs > 0 ? (Date.now() - lastActiveMs <= 3 * 3600 * 1000) : isToday;
      
      const prevToday = (isToday && isWithin3Hours) ? (data.todaySeconds || 0) : 0;
      const prevYearly = data.yearlySeconds || data.totalSeconds || 0;

      todaySecs = Math.max(prevToday + extraSeconds, extraSeconds);
      yearlySecs = Math.max(prevYearly + extraSeconds, extraSeconds);
    }

    const payload: any = {
      guestId: guestKey,
      guestName: effectiveName,
      guestPhone: effectivePhone,
      lastDateStr: todayStr,
      dateStr: todayStr,
      todaySeconds: todaySecs,
      todayMinutes: Math.floor(todaySecs / 60),
      yearlySeconds: yearlySecs,
      yearlyMinutes: Math.floor(yearlySecs / 60),
      totalSeconds: yearlySecs,
      totalMinutes: Math.floor(yearlySecs / 60),
      lastActiveAt: serverTimestamp(),
      deviceInfo: getDeviceInfo(),
      status: 'active',
      meetingType: 'Zoom Prayer Meeting',
      joinedAt: serverTimestamp(),
    };

    await setDoc(guestDocRef, payload, { merge: true });
    return { success: true, guestKey, todaySecs, yearlySecs };
  } catch (err) {
    console.error('Failed to record guest attendance:', err);
    return { success: false, error: err };
  }
}

interface ZoomContextType {
  isMeetingActive: boolean;
  activeSeconds: number;
  yearlySeconds: number;
  showEmbeddedZoom: boolean;
  setShowEmbeddedZoom: (val: boolean) => void;
  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;
  isGlobalMeetingLive: boolean;
  activeParticipantsCount: number;
  guestName: string;
  setGuestName: (name: string) => void;
  guestPhone: string;
  setGuestPhone: (phone: string) => void;
  showNamePrompt: boolean;
  setShowNamePrompt: (val: boolean) => void;
  showJoinModal: boolean;
  setShowJoinModal: (val: boolean) => void;
  joinModalTab: 'member' | 'visitor';
  setJoinModalTab: (tab: 'member' | 'visitor') => void;
  openJoinPrayerModal: (preferredTab?: 'member' | 'visitor') => void;
  localMemberProfile: any;
  saveMemberRegistration: (data: {
    displayName: string;
    email: string;
    phone?: string;
    country?: string;
    whatsappCommunity?: string;
    whatsappGroupName?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  launchZoom: (e?: React.MouseEvent | React.SyntheticEvent, embedded?: boolean, overrideName?: string, overridePhone?: string) => void;
  stopZoomSession: (customToastMsg?: string | any) => void;
  endGlobalLiveMeeting: () => Promise<void>;
  startGlobalLiveMeeting: () => Promise<void>;
  formatTime: (totalSecs: number) => string;
  recordGuestAttendanceImmediate: (name?: string, phone?: string, extraSeconds?: number) => Promise<any>;
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined);

export function ZoomProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [yearlySeconds, setYearlySeconds] = useState(0);
  const [showEmbeddedZoom, setShowEmbeddedZoom] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [guestName, setGuestNameState] = useState('');
  const [guestPhone, setGuestPhoneState] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinModalTab, setJoinModalTab] = useState<'member' | 'visitor'>('visitor');

  const [localMemberProfile, setLocalMemberProfile] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('lightup_member_reg');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const openJoinPrayerModal = (preferredTab: 'member' | 'visitor' = 'visitor') => {
    setJoinModalTab(preferredTab);
    setShowJoinModal(true);
  };

  const saveMemberRegistration = async (data: {
    displayName: string;
    email: string;
    phone?: string;
    country?: string;
    whatsappCommunity?: string;
    whatsappGroupName?: string;
  }) => {
    try {
      const memberObj = {
        displayName: data.displayName,
        email: data.email,
        phone: data.phone || '',
        country: data.country || 'Nigeria',
        whatsappCommunity: data.whatsappCommunity || 'Global Prayer Altar',
        whatsappGroupName: data.whatsappCommunity || 'Global Prayer Altar',
        isRegistered: true,
        registeredAt: new Date().toISOString(),
        role: 'member',
      };

      localStorage.setItem('lightup_member_reg', JSON.stringify(memberObj));
      localStorage.setItem('zoom_guest_name', data.displayName);
      if (data.phone) localStorage.setItem('zoom_guest_phone', data.phone);
      if (data.country) localStorage.setItem('zoom_guest_country', data.country);
      setLocalMemberProfile(memberObj);
      setGuestName(data.displayName);
      if (data.phone) setGuestPhone(data.phone);

      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          ...memberObj,
          updatedAt: serverTimestamp(),
        });
      } else {
        const memberKey = 'member_' + data.email.replace(/[^a-zA-Z0-9]/g, '_');
        await setDoc(doc(db, 'users', memberKey), {
          ...memberObj,
          uid: memberKey,
          createdAt: serverTimestamp(),
          attendanceDaysList: [],
          attendanceCount: 0,
          todayMinutes: 0,
          totalMinutes: 0,
        }, { merge: true });
      }

      return { success: true };
    } catch (err: any) {
      console.warn('saveMemberRegistration:', err);
      return { success: true };
    }
  };

  // Persistence for guest details
  const setGuestName = (name: string) => {
    setGuestNameState(name);
    localStorage.setItem('zoom_guest_name', name);
  };

  const setGuestPhone = (phone: string) => {
    setGuestPhoneState(phone);
    localStorage.setItem('zoom_guest_phone', phone);
  };

  useEffect(() => {
    const savedName = localStorage.getItem('zoom_guest_name');
    const savedPhone = localStorage.getItem('zoom_guest_phone');
    if (savedName) setGuestNameState(savedName);
    if (savedPhone) setGuestPhoneState(savedPhone);
  }, []);

  // Global live meeting status from Firestore
  const [isGlobalMeetingLive, setIsGlobalMeetingLive] = useState(false);
  const [activeParticipantsCount, setActiveParticipantsCount] = useState(0);

  // Accurate timestamp-based timing to defeat background tab throttling
  const activeSecondsRef = useRef(0);
  const yearlySecondsRef = useRef(0);
  const isMeetingActiveRef = useRef(false);
  const sessionStartMsRef = useRef<number | null>(null);
  const baseTodaySecondsRef = useRef<number>(0);
  const baseYearlySecondsRef = useRef<number>(0);
  const zoomWindowRef = useRef<Window | null>(null);
  const todayStr = getTodayDateString();

  // Helper to calculate accurate total seconds for current active session
  const computeCurrentSessionElapsedSecs = (): number => {
    if (!isMeetingActiveRef.current || !sessionStartMsRef.current) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - sessionStartMsRef.current) / 1000));
  };

  const computeCurrentTodayTotalSeconds = (): number => {
    return baseTodaySecondsRef.current + computeCurrentSessionElapsedSecs();
  };

  const computeCurrentYearlyTotalSeconds = (): number => {
    return baseYearlySecondsRef.current + computeCurrentSessionElapsedSecs();
  };

  const setSeconds = (todaySecs: number, yearlySecs?: number) => {
    activeSecondsRef.current = todaySecs;
    setActiveSeconds(todaySecs);
    if (yearlySecs !== undefined) {
      yearlySecondsRef.current = yearlySecs;
      setYearlySeconds(yearlySecs);
    }
  };

  // 1. Listen to real-time global live meeting status from Firestore with 2-minute auto-expiration
  useEffect(() => {
    const liveDocRef = doc(db, 'live_meetings', 'zoom');
    const unsubscribe = onSnapshot(
      liveDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const isLive = Boolean(data.isMeetingLive);
          const count = Math.max(0, data.activeParticipantsCount || 0);

          let isStale = false;
          if (data.lastActiveAt?.seconds) {
            const lastActiveMs = data.lastActiveAt.seconds * 1000;
            const twoMinutesMs = 2 * 60 * 1000;
            if (Date.now() - lastActiveMs > twoMinutesMs) {
              isStale = true;
            }
          }

          if (isStale || count <= 0 || !isLive) {
            setIsGlobalMeetingLive(false);
            setActiveParticipantsCount(0);
            
            // Automatically stop attendee session when meeting ends globally
            if (isMeetingActiveRef.current) {
              stopZoomSession('✓ Zoom prayer meeting has ended. Attendance automatically finalized and saved!');
            }

            if (isLive && isStale) {
              setDoc(
                liveDocRef,
                { isMeetingLive: false, activeParticipantsCount: 0, endedReason: 'stale_timeout_2m' },
                { merge: true }
              ).catch(() => {});
            }
          } else {
            setIsGlobalMeetingLive(true);
            setActiveParticipantsCount(count);
          }
        } else {
          setIsGlobalMeetingLive(false);
          setActiveParticipantsCount(0);
          if (isMeetingActiveRef.current) {
            stopZoomSession('✓ Zoom prayer meeting has ended. Attendance automatically saved!');
          }
        }
      },
      (err) => {
        console.warn('Live meeting listener error:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // 1b. Automatic Window Close & Safety Timeout Poller
  useEffect(() => {
    let windowCheckTimer: any;
    if (isMeetingActive) {
      windowCheckTimer = setInterval(() => {
        // 1. Check if the user closed the Zoom window / tab
        if (zoomWindowRef.current && zoomWindowRef.current.closed) {
          zoomWindowRef.current = null;
          stopZoomSession('✓ Zoom meeting closed. Attendance automatically finalized and saved!');
          return;
        }

        // 2. Safety auto-cutoff if left running beyond 3 hours (10,800 seconds)
        const elapsed = computeCurrentSessionElapsedSecs();
        if (elapsed >= 10800) {
          stopZoomSession('✓ Maximum prayer session time reached (3 hrs). Attendance automatically saved!');
          return;
        }
      }, 1000);
    }
    return () => {
      if (windowCheckTimer) clearInterval(windowCheckTimer);
    };
  }, [isMeetingActive]);

  // Send real-time heartbeat every 10s while actively in Zoom to keep signal fresh
  useEffect(() => {
    let heartbeat: any;
    if (isMeetingActive) {
      heartbeat = setInterval(() => {
        // 1. Global Meeting presence
        const liveDocRef = doc(db, 'live_meetings', 'zoom');
        setDoc(
          liveDocRef,
          {
            isMeetingLive: true,
            lastActiveAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});

        // 2. Member or Guest active presence
        if (user?.uid) {
          setDoc(
            doc(db, 'users', user.uid),
            {
              isZoomActive: true,
              lastZoomActiveAt: serverTimestamp(),
              lastActiveAt: serverTimestamp(),
              lastAttendedDate: todayStr,
            },
            { merge: true }
          ).catch(() => {});
        } else {
          const effectiveName = guestName || localStorage.getItem('zoom_guest_name') || '';
          const effectivePhone = guestPhone || localStorage.getItem('zoom_guest_phone') || '';
          const guestKey = getGuestDocKey(effectivePhone, effectiveName);
          setDoc(
            doc(db, 'guest_attendance', guestKey),
            {
              isZoomActive: true,
              status: 'active',
              lastActiveAt: serverTimestamp(),
            },
            { merge: true }
          ).catch(() => {});
        }
      }, 10000);
    }
    return () => clearInterval(heartbeat);
  }, [isMeetingActive, user?.uid, todayStr, guestName, guestPhone]);

  const endGlobalLiveMeeting = async () => {
    try {
      const liveDocRef = doc(db, 'live_meetings', 'zoom');
      await setDoc(
        liveDocRef,
        {
          isMeetingLive: false,
          activeParticipantsCount: 0,
          endedByAdminAt: serverTimestamp(),
        },
        { merge: true }
      );
      setIsGlobalMeetingLive(false);
      setActiveParticipantsCount(0);
      setToastMessage('✓ Live Zoom broadcast stopped for all visitors.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Error stopping live broadcast:', err);
    }
  };

  const startGlobalLiveMeeting = async () => {
    try {
      const liveDocRef = doc(db, 'live_meetings', 'zoom');
      await setDoc(
        liveDocRef,
        {
          isMeetingLive: true,
          activeParticipantsCount: 1,
          lastActiveAt: serverTimestamp(),
        },
        { merge: true }
      );
      setIsGlobalMeetingLive(true);
      setActiveParticipantsCount(1);
      setToastMessage('✓ Live Zoom broadcast started across website.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Error starting live broadcast:', err);
    }
  };

  // 2. Initialize / Restore seconds safely from localStorage or Firestore
  useEffect(() => {
    if (isMeetingActive) return;

    const loadCloudData = async () => {
      if (user?.uid) {
        let currentLocalSecs = 0;
        const storageKey = `zoom_sec_${user.uid}_${todayStr}`;
        const saved = localStorage.getItem(storageKey);
        if (saved) currentLocalSecs = parseInt(saved, 10) || 0;
        
        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            const firestoreMins = data.todayMinutes || 0;
            const firestoreSecs = firestoreMins * 60;
            const finalTodaySecs = Math.max(currentLocalSecs, firestoreSecs);
            const totalLifetimeSecs = (data.totalMinutes || firestoreMins) * 60;

            baseTodaySecondsRef.current = finalTodaySecs;
            baseYearlySecondsRef.current = totalLifetimeSecs;
            setSeconds(finalTodaySecs, totalLifetimeSecs);
            localStorage.setItem(storageKey, finalTodaySecs.toString());
          }
        } catch (e) {
          console.warn('Member cloud restore error:', e);
          baseTodaySecondsRef.current = currentLocalSecs;
          setSeconds(currentLocalSecs);
        }
      } else {
        // Visitor / Guest profile restoration
        const effectiveName = localStorage.getItem('zoom_guest_name') || '';
        const effectivePhone = localStorage.getItem('zoom_guest_phone') || '';
        const guestKey = getGuestDocKey(effectivePhone, effectiveName);

        try {
          const guestProfile = await getUnifiedGuestProfile(guestKey, todayStr);
          
          if (guestProfile.guestName && !guestName) {
            setGuestNameState(guestProfile.guestName);
          }
          if (guestProfile.guestPhone && !guestPhone) {
            setGuestPhoneState(guestProfile.guestPhone);
          }

          // If daily was wiped due to new day or >3h of inactivity:
          if (guestProfile.isWiped) {
            baseTodaySecondsRef.current = 0;
            baseYearlySecondsRef.current = guestProfile.yearlySeconds;
            setSeconds(0, guestProfile.yearlySeconds);
            localStorage.setItem(`zoom_sec_guest_${todayStr}`, '0');
          } else {
            baseTodaySecondsRef.current = guestProfile.todaySeconds;
            baseYearlySecondsRef.current = guestProfile.yearlySeconds;
            setSeconds(guestProfile.todaySeconds, guestProfile.yearlySeconds);
            localStorage.setItem(`zoom_sec_guest_${todayStr}`, guestProfile.todaySeconds.toString());
          }
        } catch (e) {
          console.warn('Guest cloud restore error:', e);
        }
      }
    };

    loadCloudData();
  }, [user?.uid, todayStr, isMeetingActive]);

  // 3. Robust Wall-Clock Interval Timer (updates state + syncs every 15 seconds)
  useEffect(() => {
    let timerInterval: any;

    if (isMeetingActive) {
      isMeetingActiveRef.current = true;

      timerInterval = setInterval(() => {
        const currentTodaySecs = computeCurrentTodayTotalSeconds();
        const currentYearlySecs = computeCurrentYearlyTotalSeconds();
        const sessionElapsed = computeCurrentSessionElapsedSecs();

        setSeconds(currentTodaySecs, currentYearlySecs);

        const storageKey = user?.uid
          ? `zoom_sec_${user.uid}_${todayStr}`
          : `zoom_sec_guest_${todayStr}`;
        localStorage.setItem(storageKey, currentTodaySecs.toString());

        // Sync to cloud at 2s, 5s, and every 10 seconds for ultra-reliable capture
        if (currentTodaySecs > 0 && (currentTodaySecs === 2 || currentTodaySecs === 5 || currentTodaySecs % 10 === 0)) {
          const mins = Math.floor(currentTodaySecs / 60);
          if (user?.uid) {
            if (mins > 0) {
              syncExactPrayerMinutes(user.uid, mins);
            }
          } else {
            const effectiveName = guestName || localStorage.getItem('zoom_guest_name') || '';
            const effectivePhone = guestPhone || localStorage.getItem('zoom_guest_phone') || '';
            const guestKey = getGuestDocKey(effectivePhone, effectiveName);

            syncUnifiedGuestAttendance(
              guestKey,
              todayStr,
              sessionElapsed,
              baseTodaySecondsRef.current,
              baseYearlySecondsRef.current,
              false,
              false,
              effectiveName || 'Anonymous Guest',
              effectivePhone
            );
          }
        }
      }, 1000);
    } else {
      isMeetingActiveRef.current = false;
    }

    return () => clearInterval(timerInterval);
  }, [isMeetingActive, user?.uid, todayStr, guestName, guestPhone]);

  // 4. Focus & Visibility event listener: instantly recalculates accurate wall-clock time on tab return or detects closed window
  useEffect(() => {
    const handleSyncOnVisible = () => {
      if (isMeetingActiveRef.current) {
        // Auto-stop if user returned to tab and the Zoom window was closed
        if (zoomWindowRef.current && zoomWindowRef.current.closed) {
          zoomWindowRef.current = null;
          stopZoomSession('✓ Zoom meeting closed. Attendance automatically finalized and saved!');
          return;
        }

        const currentTodaySecs = computeCurrentTodayTotalSeconds();
        const currentYearlySecs = computeCurrentYearlyTotalSeconds();
        const sessionElapsed = computeCurrentSessionElapsedSecs();

        setSeconds(currentTodaySecs, currentYearlySecs);

        const storageKey = user?.uid
          ? `zoom_sec_${user.uid}_${todayStr}`
          : `zoom_sec_guest_${todayStr}`;
        localStorage.setItem(storageKey, currentTodaySecs.toString());

        const mins = Math.floor(currentTodaySecs / 60);
        if (user?.uid) {
          if (mins > 0) syncExactPrayerMinutes(user.uid, mins);
        } else {
          const effectiveName = guestName || localStorage.getItem('zoom_guest_name') || '';
          const effectivePhone = guestPhone || localStorage.getItem('zoom_guest_phone') || '';
          const guestKey = getGuestDocKey(effectivePhone, effectiveName);

          syncUnifiedGuestAttendance(
            guestKey,
            todayStr,
            sessionElapsed,
            baseTodaySecondsRef.current,
            baseYearlySecondsRef.current,
            false,
            false,
            effectiveName || 'Anonymous Guest',
            effectivePhone
          );
        }
      }
    };

    window.addEventListener('focus', handleSyncOnVisible);
    document.addEventListener('visibilitychange', handleSyncOnVisible);

    return () => {
      window.removeEventListener('focus', handleSyncOnVisible);
      document.removeEventListener('visibilitychange', handleSyncOnVisible);
    };
  }, [user?.uid, todayStr, guestName, guestPhone]);

  // 5. Emergency unload handler to save exact time if browser tab is closed/refreshed
  useEffect(() => {
    const handleUnload = () => {
      if (isMeetingActiveRef.current) {
        const finalTodaySecs = computeCurrentTodayTotalSeconds();
        const finalMins = Math.floor(finalTodaySecs / 60);
        const sessionElapsed = computeCurrentSessionElapsedSecs();

        if (user?.uid) {
          const storageKey = `zoom_sec_${user.uid}_${todayStr}`;
          localStorage.setItem(storageKey, finalTodaySecs.toString());
          if (finalMins > 0) {
            syncExactPrayerMinutes(user.uid, finalMins);
          }
          updateDoc(doc(db, 'users', user.uid), {
            isZoomActive: false,
            lastActiveAt: serverTimestamp(),
          }).catch(() => {});
        } else {
          const effectiveName = guestName || localStorage.getItem('zoom_guest_name') || '';
          const effectivePhone = guestPhone || localStorage.getItem('zoom_guest_phone') || '';
          const guestKey = getGuestDocKey(effectivePhone, effectiveName);

          syncUnifiedGuestAttendance(
            guestKey,
            todayStr,
            sessionElapsed,
            baseTodaySecondsRef.current,
            baseYearlySecondsRef.current,
            true,
            false,
            effectiveName || 'Anonymous Guest',
            effectivePhone
          );
          updateDoc(doc(db, 'guest_attendance', guestKey), {
            isZoomActive: false,
            status: 'completed',
            lastActiveAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [user?.uid, todayStr, guestName, guestPhone]);

  // Sync global signal to Firestore
  const updateGlobalSignal = async (active: boolean) => {
    try {
      const liveDocRef = doc(db, 'live_meetings', 'zoom');
      const currentSnap = await getDoc(liveDocRef);
      let count = 0;
      if (currentSnap.exists()) {
        count = currentSnap.data().activeParticipantsCount || 0;
      }
      const nextCount = active ? count + 1 : Math.max(0, count - 1);
      const stillLive = active ? true : (nextCount > 0);

      await setDoc(
        liveDocRef,
        {
          isMeetingLive: stillLive,
          activeParticipantsCount: nextCount,
          lastActiveAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Error updating global meeting signal:', e);
    }
  };

  // Launch Zoom handler
  const launchZoom = (
    e?: React.MouseEvent | React.SyntheticEvent, 
    embedded: boolean = false,
    overrideName?: string,
    overridePhone?: string
  ) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const effectiveName = (overrideName || guestName || localStorage.getItem('zoom_guest_name') || '').trim();
    const effectivePhone = (overridePhone || guestPhone || localStorage.getItem('zoom_guest_phone') || '').trim();

    if (overrideName) setGuestName(overrideName);
    if (overridePhone) setGuestPhone(overridePhone);

    // If not logged in and not registered member and no name prompt answered, show the Join Prayer Modal (Member vs Visitor)!
    const isRegisteredMember = Boolean(
      user || profile?.displayName || localMemberProfile?.isRegistered
    );

    if (!isRegisteredMember && !effectiveName && !overrideName) {
      setJoinModalTab('visitor');
      setShowJoinModal(true);
      return;
    }

    if (embedded) {
      setShowEmbeddedZoom(true);
    } else {
      setShowEmbeddedZoom(false);
      const newWin = window.open(ZOOM_MEETING_URL, '_blank', 'noopener=false');
      zoomWindowRef.current = newWin;
    }

    // Set precise session start timestamp
    sessionStartMsRef.current = Date.now();
    isMeetingActiveRef.current = true;
    setIsMeetingActive(true);
    updateGlobalSignal(true);
    setShowNamePrompt(false);

    if (user?.uid) {
      // Member session
      getDoc(doc(db, 'users', user.uid))
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const firestoreMins = data.todayMinutes || 0;
            const firestoreSecs = firestoreMins * 60;
            const storageKey = `zoom_sec_${user.uid}_${todayStr}`;
            const localSecs = parseInt(localStorage.getItem(storageKey) || '0', 10);
            
            const resumeTodaySecs = Math.max(localSecs, firestoreSecs, activeSecondsRef.current);
            const lifetimeSecs = (data.totalMinutes || firestoreMins) * 60;
            
            baseTodaySecondsRef.current = resumeTodaySecs;
            baseYearlySecondsRef.current = lifetimeSecs;
            setSeconds(resumeTodaySecs, lifetimeSecs);
            localStorage.setItem(storageKey, resumeTodaySecs.toString());
          }
          
          markAttendanceForToday(user.uid).then((res) => {
            if (res.success) {
              setToastMessage(`✓ Welcome ${profile?.displayName || 'Member'}! Resuming prayer time recording...`);
            } else {
              setToastMessage('✓ Directed into Zoom meeting! Live timer actively counting...');
            }
            setTimeout(() => setToastMessage(null), 5000);
          }).catch(() => {
            setToastMessage('✓ Directed into Zoom meeting! Live timer actively counting...');
            setTimeout(() => setToastMessage(null), 5000);
          });
        })
        .catch((err) => {
          console.info('Offline prayer time sync:', err);
          setToastMessage('✓ Directed into Zoom meeting! Live timer actively counting...');
          setTimeout(() => setToastMessage(null), 5000);
        });
    } else {
      // Visitor / Guest session: Immediately write initial attendance record to Firestore
      const guestKey = getGuestDocKey(effectivePhone, effectiveName);
      
      // 1. INSTANT optimistic write so the record is guaranteed to exist even if user navigates away immediately
      syncUnifiedGuestAttendance(
        guestKey,
        todayStr,
        0,
        baseTodaySecondsRef.current,
        baseYearlySecondsRef.current,
        false,
        true,
        effectiveName || 'Anonymous Guest',
        effectivePhone
      );

      // 2. Fetch full historical profile for seamless continuation of yearly stats
      getUnifiedGuestProfile(guestKey, todayStr).then((profileData) => {
        // Daily wipes to 0 after 3h or on a new day, yearly accumulates forever
        const resumeTodaySecs = profileData.todaySeconds;
        const resumeYearlySecs = profileData.yearlySeconds;

        baseTodaySecondsRef.current = resumeTodaySecs;
        baseYearlySecondsRef.current = resumeYearlySecs;
        setSeconds(resumeTodaySecs, resumeYearlySecs);
        localStorage.setItem(`zoom_sec_guest_${todayStr}`, resumeTodaySecs.toString());

        syncUnifiedGuestAttendance(
          guestKey,
          todayStr,
          0,
          resumeTodaySecs,
          resumeYearlySecs,
          false,
          false,
          effectiveName || 'Anonymous Guest',
          effectivePhone
        );

        if (profileData.yearlyMinutes > 0) {
          const yearlyHours = (profileData.yearlyMinutes / 60).toFixed(1);
          setToastMessage(`✓ Welcome back ${effectiveName}! Resuming session (${yearlyHours} hrs recorded this year).`);
        } else {
          setToastMessage(`✓ Welcome ${effectiveName || 'Guest'}! Directed to Zoom. Live prayer recording started.`);
        }
        setTimeout(() => setToastMessage(null), 6000);
      });
    }
  };

  // Stop Zoom session
  const stopZoomSession = (customToastMsg?: string | any) => {
    if (zoomWindowRef.current && !zoomWindowRef.current.closed) {
      try {
        zoomWindowRef.current.close();
      } catch (e) {
        // Ignore cross-origin close error
      }
    }
    zoomWindowRef.current = null;

    if (isMeetingActive || isMeetingActiveRef.current) {
      const finalTodaySecs = computeCurrentTodayTotalSeconds();
      const finalYearlySecs = computeCurrentYearlyTotalSeconds();
      const sessionElapsed = computeCurrentSessionElapsedSecs();
      const finalTodayMins = Math.floor(finalTodaySecs / 60);

      isMeetingActiveRef.current = false;
      sessionStartMsRef.current = null;
      baseTodaySecondsRef.current = finalTodaySecs;
      baseYearlySecondsRef.current = finalYearlySecs;
      setSeconds(finalTodaySecs, finalYearlySecs);
      setIsMeetingActive(false);
      setShowEmbeddedZoom(false);
      updateGlobalSignal(false);

      if (user?.uid) {
        const storageKey = `zoom_sec_${user.uid}_${todayStr}`;
        localStorage.setItem(storageKey, finalTodaySecs.toString());
        if (finalTodayMins > 0) {
          syncExactPrayerMinutes(user.uid, finalTodayMins);
        } else {
          markAttendanceForToday(user.uid);
        }
        updateDoc(doc(db, 'users', user.uid), {
          isZoomActive: false,
          lastActiveAt: serverTimestamp(),
        }).catch(() => {});
      } else {
        const effectiveName = guestName || localStorage.getItem('zoom_guest_name') || '';
        const effectivePhone = guestPhone || localStorage.getItem('zoom_guest_phone') || '';
        const guestKey = getGuestDocKey(effectivePhone, effectiveName);

        syncUnifiedGuestAttendance(
          guestKey,
          todayStr,
          sessionElapsed,
          baseTodaySecondsRef.current - sessionElapsed,
          baseYearlySecondsRef.current - sessionElapsed,
          true,
          false,
          effectiveName || 'Anonymous Guest',
          effectivePhone
        );
        updateDoc(doc(db, 'guest_attendance', guestKey), {
          isZoomActive: false,
          status: 'completed',
          lastActiveAt: serverTimestamp(),
        }).catch(() => {});
      }

      const toastText = typeof customToastMsg === 'string'
        ? customToastMsg
        : `✓ Zoom prayer session saved! Today: ${formatTime(finalTodaySecs)} | Yearly: ${formatTime(finalYearlySecs)}`;

      setToastMessage(toastText);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  const formatTime = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hours > 0) {
      return `${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  return (
    <ZoomContext.Provider
      value={{
        isMeetingActive,
        activeSeconds,
        yearlySeconds,
        showEmbeddedZoom,
        setShowEmbeddedZoom,
        toastMessage,
        setToastMessage,
        isGlobalMeetingLive,
        activeParticipantsCount,
        guestName,
        setGuestName,
        guestPhone,
        setGuestPhone,
        showNamePrompt,
        setShowNamePrompt,
        showJoinModal,
        setShowJoinModal,
        joinModalTab,
        setJoinModalTab,
        openJoinPrayerModal,
        localMemberProfile,
        saveMemberRegistration,
        launchZoom,
        stopZoomSession,
        endGlobalLiveMeeting,
        startGlobalLiveMeeting,
        formatTime,
        recordGuestAttendanceImmediate,
      }}
    >
      {children}
      <JoinPrayerModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        defaultTab={joinModalTab}
      />
    </ZoomContext.Provider>
  );
}

export function useZoomSession() {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoomSession must be used within a ZoomProvider');
  }
  return context;
}
