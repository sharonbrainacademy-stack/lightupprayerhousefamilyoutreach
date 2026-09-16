/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, addDoc, collection, updateDoc, increment, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

export interface WhatsAppGroupLink {
  id: string;
  name: string;
  region: string;
  url: string;
  clickCount?: number;
}

export interface WhatsAppJoinRecord {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  groupName: string;
  targetUrl: string;
  timestamp: string;
  source: string;
}

export interface WhatsAppConfig {
  mainGroupUrl: string;
  regionalGroups: Record<string, string>;
  totalClicks?: number;
}

export const DEFAULT_WHATSAPP_GROUPS: Record<string, { name: string; url: string }> = {
  esther_benin: {
    name: "Esther’s Group (Benin)",
    url: "https://chat.whatsapp.com/LightUpPrayerBenin"
  },
  king_david_lagos: {
    name: "King David’s Group (Lagos)",
    url: "https://chat.whatsapp.com/LightUpPrayerLagos"
  },
  joyful_abuja: {
    name: "Joyful Group (Abuja)",
    url: "https://chat.whatsapp.com/LightUpPrayerAbuja"
  },
  grace_asaba: {
    name: "Grace Group (Asaba)",
    url: "https://chat.whatsapp.com/LightUpPrayerAsaba"
  },
  global: {
    name: "Global / International",
    url: "https://chat.whatsapp.com/LightUpPrayerGlobal"
  }
};

export const WHATSAPP_COMMUNITY_OPTIONS: string[] = [
  "Esther’s Group (Benin)",
  "King David’s Group (Lagos)",
  "Joyful Group (Abuja)",
  "Grace Group (Asaba)",
  "Global / International"
];

/**
 * Extracts and normalizes the member's WhatsApp community name.
 */
export function getMemberWhatsAppCommunity(member?: { whatsappGroupName?: string; whatsappCommunity?: string; whatsappGroup?: string } | null): string {
  if (!member) return 'Unassigned';
  if (member.whatsappGroupName && member.whatsappGroupName.trim()) {
    return member.whatsappGroupName.trim();
  }
  if (member.whatsappCommunity && member.whatsappCommunity.trim()) {
    return member.whatsappCommunity.trim();
  }
  if (member.whatsappGroup && member.whatsappGroup.trim()) {
    const val = member.whatsappGroup.trim();
    // If it's not simply a telephone number
    if (val.length > 3 && !/^\+?[0-9\s\-()]{7,}$/.test(val)) {
      return val;
    }
  }
  return 'Unassigned';
}

/**
 * Checks URL parameters on initial page load to capture WhatsApp referrals
 */
export function trackWhatsAppUrlSource() {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const source = params.get('source') || params.get('ref') || params.get('referrer') || params.get('utm_source');

  if (source && source.toLowerCase().includes('whatsapp')) {
    localStorage.setItem('whatsapp_referral_active', 'true');
    localStorage.setItem('whatsapp_referral_time', new Date().toISOString());
    console.log('✓ Captured WhatsApp referral source in local session state');
  }
}

/**
 * Returns true if current user arrived via WhatsApp referral
 */
export function isWhatsAppReferral(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('whatsapp_referral_active') === 'true';
}

/**
 * Record a user clicking to join a WhatsApp group in Firestore
 */
export async function recordWhatsAppGroupJoin(
  groupName: string,
  targetUrl: string,
  user?: { uid: string; displayName?: string; email?: string } | null
) {
  const isReferral = isWhatsAppReferral();
  const sourceText = isReferral ? 'WhatsApp Referral Link' : 'Direct App Click';

  try {
    // 1. Log join record in Firestore
    await addDoc(collection(db, 'whatsapp_joins'), {
      userId: user?.uid || 'guest',
      userName: user?.displayName || 'Guest Visitor',
      userEmail: user?.email || 'N/A',
      groupName,
      targetUrl,
      source: sourceText,
      timestamp: serverTimestamp(),
      createdAtStr: new Date().toISOString()
    });

    // 2. Increment global clicks counter in settings
    const settingsRef = doc(db, 'settings', 'whatsapp_config');
    await setDoc(settingsRef, {
      totalClicks: increment(1)
    }, { merge: true });

    // 3. If signed in, mark user profile as joined
    if (user?.uid) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        joinedWhatsappGroup: true,
        whatsappJoinedAt: new Date().toISOString(),
        whatsappGroupName: groupName,
        whatsappCommunity: groupName,
        trafficSource: isReferral ? 'WhatsApp' : 'Direct'
      }).catch(err => {
        // Fallback merge set
        setDoc(userRef, {
          joinedWhatsappGroup: true,
          whatsappJoinedAt: new Date().toISOString(),
          whatsappGroupName: groupName,
          whatsappCommunity: groupName,
          trafficSource: isReferral ? 'WhatsApp' : 'Direct'
        }, { merge: true });
      });
    }
  } catch (error) {
    console.error('Error recording WhatsApp group join:', error);
  }
}

/**
 * Fetch WhatsApp Group Config settings from Firestore
 */
export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  try {
    const configSnap = await getDoc(doc(db, 'settings', 'whatsapp_config'));
    if (configSnap.exists()) {
      const data = configSnap.data();
      return {
        mainGroupUrl: data.mainGroupUrl || DEFAULT_WHATSAPP_GROUPS.global.url,
        regionalGroups: data.regionalGroups || {
          esther_benin: DEFAULT_WHATSAPP_GROUPS.esther_benin.url,
          king_david_lagos: DEFAULT_WHATSAPP_GROUPS.king_david_lagos.url,
          joyful_abuja: DEFAULT_WHATSAPP_GROUPS.joyful_abuja.url,
          grace_asaba: DEFAULT_WHATSAPP_GROUPS.grace_asaba.url,
          global: DEFAULT_WHATSAPP_GROUPS.global.url
        },
        totalClicks: data.totalClicks || 0
      };
    }
  } catch (err) {
    console.error('Error loading WhatsApp config:', err);
  }

  return {
    mainGroupUrl: DEFAULT_WHATSAPP_GROUPS.global.url,
    regionalGroups: {
      esther_benin: DEFAULT_WHATSAPP_GROUPS.esther_benin.url,
      king_david_lagos: DEFAULT_WHATSAPP_GROUPS.king_david_lagos.url,
      joyful_abuja: DEFAULT_WHATSAPP_GROUPS.joyful_abuja.url,
      grace_asaba: DEFAULT_WHATSAPP_GROUPS.grace_asaba.url,
      global: DEFAULT_WHATSAPP_GROUPS.global.url
    },
    totalClicks: 0
  };
}

/**
 * Save updated WhatsApp Group Config settings (Admin only)
 */
export async function updateWhatsAppConfig(config: Partial<WhatsAppConfig>) {
  const settingsRef = doc(db, 'settings', 'whatsapp_config');
  await setDoc(settingsRef, config, { merge: true });
}

/**
 * Fetch latest WhatsApp Join Records for Admin Analytics
 */
export async function getRecentWhatsAppJoins(limitCount = 50): Promise<WhatsAppJoinRecord[]> {
  try {
    const joinsRef = collection(db, 'whatsapp_joins');
    const q = query(joinsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);

    return snap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: data.userId || 'guest',
        userName: data.userName || 'Guest User',
        userEmail: data.userEmail || 'N/A',
        groupName: data.groupName || 'WhatsApp Group',
        targetUrl: data.targetUrl || '',
        timestamp: data.createdAtStr || (data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : new Date().toISOString()),
        source: data.source || 'Direct App Click'
      };
    });
  } catch (err) {
    console.error('Error fetching recent WhatsApp joins:', err);
    return [];
  }
}

/**
 * Gets the publicly accessible origin URL.
 * Automatically converts internal dev environment domains (ais-dev-) to public preview domains (ais-pre-)
 * so that shared links work seamlessly on external mobile devices and browsers.
 */
export function getPublicOrigin(): string {
  if (typeof window === 'undefined') {
    return 'https://light-up-prayer-house.web.app';
  }
  let origin = window.location.origin;
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }
  return origin;
}

/**
 * Generate WhatsApp Share URL with tracking parameters
 */
export function generateWhatsAppShareUrl(customText?: string): string {
  const baseUrl = `${getPublicOrigin()}/join?source=whatsapp`;
  const text = customText || `🔥 Join us at Light Up Prayer House for daily live prayer sessions and kingdom fellowship!\n\nRegister for fellowship & prayer cell placement here:\n${baseUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
