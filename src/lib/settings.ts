/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { sanitizeImageUrl } from './image-utils';

export interface SiteBranding {
  logoUrl: string;
  siteName: string;
  tagline: string;
  updatedAt?: string;
}

export const DEFAULT_BRANDING: SiteBranding = {
  logoUrl: '/logo.jpg',
  siteName: 'LIGHT UP PRAYER HOUSE',
  tagline: 'Family Outreach',
};

const BRANDING_CACHE_KEY = 'lightup_site_branding_cache';

/**
 * Custom React hook that subscribes to real-time site branding changes in Firestore.
 */
export function useSiteBranding(): SiteBranding {
  const [branding, setBranding] = useState<SiteBranding>(() => {
    try {
      const cached = localStorage.getItem(BRANDING_CACHE_KEY);
      if (cached) {
        return { ...DEFAULT_BRANDING, ...JSON.parse(cached) };
      }
    } catch (e) {
      // Ignore
    }
    return DEFAULT_BRANDING;
  });

  useEffect(() => {
    try {
      const docRef = doc(db, 'settings', 'branding');
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<SiteBranding>;
          const updated: SiteBranding = {
            logoUrl: sanitizeImageUrl(data.logoUrl?.trim() || DEFAULT_BRANDING.logoUrl),
            siteName: data.siteName?.trim() || DEFAULT_BRANDING.siteName,
            tagline: data.tagline?.trim() || DEFAULT_BRANDING.tagline,
            updatedAt: data.updatedAt,
          };
          setBranding(updated);
          try {
            localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(updated));
          } catch (e) {
            // Ignore
          }
        } else {
          setBranding(DEFAULT_BRANDING);
        }
      }, (err) => {
        console.warn('Error listening to site branding changes:', err);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Firestore branding subscription error:', err);
    }
  }, []);

  return branding;
}

/**
 * Updates site branding (Logo URL, Site Name, Tagline) in Firestore.
 */
export async function updateSiteBranding(newBranding: Partial<SiteBranding>): Promise<void> {
  const docRef = doc(db, 'settings', 'branding');
  const payload: SiteBranding = {
    logoUrl: sanitizeImageUrl(newBranding.logoUrl?.trim() || DEFAULT_BRANDING.logoUrl),
    siteName: newBranding.siteName?.trim() || DEFAULT_BRANDING.siteName,
    tagline: newBranding.tagline?.trim() || DEFAULT_BRANDING.tagline,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(docRef, payload, { merge: true });

  try {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    // Ignore
  }
}
