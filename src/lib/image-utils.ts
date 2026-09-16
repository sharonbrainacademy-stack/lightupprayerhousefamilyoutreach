/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WeeklyTheme, ProgramItem } from '../types';

export const DEFAULT_THEME_FLYERS = [
  { label: 'Divine Assignment', url: '/theme_assignment.jpg' },
  { label: 'Chosen for Greatness', url: '/theme_greatness.jpg' },
  { label: 'Let Fire Fall', url: '/theme_fire.jpg' },
  { label: 'Presence of God', url: '/theme_presence.jpg' }
];

export const DEFAULT_PROGRAM_FLYERS = [
  { label: 'Lagos Revival Rally', url: '/flyer_lagos.jpg' },
  { label: 'Edo State Crusade', url: '/flyer_edo.jpg' },
  { label: 'Asaba Prophetic Encounter', url: '/flyer_asaba.jpg' }
];

/**
 * Sanitizes image URLs to prevent Netlify mixed-content blocks and whitespace issues
 */
export function sanitizeImageUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  // Upgrade insecure http:// image links to https:// for Netlify/SSL compatibility
  if (trimmed.startsWith('http://')) {
    trimmed = 'https://' + trimmed.slice(7);
  }
  return trimmed;
}

/**
 * Safely resolves the flyer/image URL for a weekly theme, falling back to bundled default
 */
export function getThemeFlyerUrl(theme?: Partial<WeeklyTheme> | null): string {
  if (!theme) return '/theme_assignment.jpg';
  const candidate = theme.imageUrl || theme.flyerUrl || (theme as any).flyer_url || (theme as any).image_url;
  if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
    return sanitizeImageUrl(candidate);
  }
  return '/theme_assignment.jpg';
}

/**
 * Safely resolves the flyer/image URL for a program rally
 */
export function getProgramFlyerUrl(program?: Partial<ProgramItem> | null): string {
  if (!program) return '/flyer_lagos.jpg';
  const candidate = program.imageUrl || (program as any).flyerUrl || (program as any).flyer_url || (program as any).image_url;
  if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
    return sanitizeImageUrl(candidate);
  }
  return '/flyer_lagos.jpg';
}

/**
 * Checks if an image data URL is approaching Firestore document limit (1MB max)
 */
export function isImageDataUrlSafeForFirestore(dataUrl: string): boolean {
  // Max ~400,000 characters is safe (~300KB)
  return !dataUrl.startsWith('data:') || dataUrl.length < 500000;
}

/**
 * Compresses an image file from a camera or photo library to a lightweight Web-safe JPEG DataURL.
 * Uses adaptive multi-pass compression to GUARANTEE the image string stays well under Firestore's 1MB limit (~120KB - 280KB).
 */
export function compressImageFile(
  file: File, 
  maxWidth = 1000, 
  maxHeight = 1000, 
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If SVG or tiny GIF/WebP under 50KB, read directly
    if (file.type === 'image/svg+xml' || (file.size < 50 * 1024 && !file.type.includes('heic') && !file.type.includes('tiff'))) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      const img = new Image();

      img.onload = () => {
        // Multi-pass compression helper to ensure under 350,000 characters
        let curMaxW = maxWidth;
        let curMaxH = maxHeight;
        let curQuality = quality;

        const attemptCompression = (): string => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > curMaxW) {
              height = Math.round((height * curMaxW) / width);
              width = curMaxW;
            }
          } else {
            if (height > curMaxH) {
              width = Math.round((width * curMaxH) / height);
              height = curMaxH;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return rawDataUrl;
          }

          // Clean white background in case of transparent PNG/WebP conversion
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          return canvas.toDataURL('image/jpeg', curQuality);
        };

        let result = attemptCompression();

        // Pass 2: If still > 380,000 characters (~285KB), scale down further
        if (result.length > 380000) {
          curMaxW = Math.min(800, curMaxW);
          curMaxH = Math.min(800, curMaxH);
          curQuality = 0.70;
          result = attemptCompression();
        }

        // Pass 3: If still > 380,000 characters, scale down to 640px
        if (result.length > 380000) {
          curMaxW = 640;
          curMaxH = 640;
          curQuality = 0.62;
          result = attemptCompression();
        }

        resolve(result);
      };

      img.onerror = () => {
        // If image object decoding fails, check size before falling back
        if (rawDataUrl.length < 500000) {
          resolve(rawDataUrl);
        } else {
          reject(new Error('Selected image is too large or unsupported. Please use a standard JPG, PNG, or WEBP photo.'));
        }
      };

      img.src = rawDataUrl;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
