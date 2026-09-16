/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ParsedVideoInfo {
  embedUrl: string | null;
  directVideoUrl: string | null;
  isYouTube: boolean;
  isVimeo: boolean;
  isDirectVideo: boolean;
  isChannelUrl: boolean;
  rawUrl: string;
}

/**
 * Robust parser for YouTube, Vimeo, Google Drive, direct MP4, and church stream video URLs.
 */
export function parseVideoUrl(url?: string | null): ParsedVideoInfo {
  if (!url || typeof url !== 'string') {
    return {
      embedUrl: null,
      directVideoUrl: null,
      isYouTube: false,
      isVimeo: false,
      isDirectVideo: false,
      isChannelUrl: false,
      rawUrl: ''
    };
  }

  const trimmed = url.trim();

  // 1. Check if it's a YouTube channel / user profile URL
  if (
    trimmed.includes('youtube.com/@') || 
    trimmed.includes('youtube.com/channel/') || 
    trimmed.includes('youtube.com/c/') ||
    trimmed.includes('youtube.com/user/')
  ) {
    return {
      embedUrl: null,
      directVideoUrl: null,
      isYouTube: true,
      isVimeo: false,
      isDirectVideo: false,
      isChannelUrl: true,
      rawUrl: trimmed
    };
  }

  // 2. YouTube Video ID matchers
  // Supports:
  // - youtube.com/watch?v=VIDEO_ID
  // - youtu.be/VIDEO_ID
  // - youtube.com/embed/VIDEO_ID
  // - youtube.com/live/VIDEO_ID
  // - youtube.com/shorts/VIDEO_ID
  // - m.youtube.com/watch?v=VIDEO_ID
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const ytMatch = trimmed.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`,
      directVideoUrl: null,
      isYouTube: true,
      isVimeo: false,
      isDirectVideo: false,
      isChannelUrl: false,
      rawUrl: trimmed
    };
  }

  // 3. Vimeo Matcher
  // Supports vimeo.com/123456789 or player.vimeo.com/video/123456789
  const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i;
  const vimeoMatch = trimmed.match(vimeoRegex);
  if (vimeoMatch && vimeoMatch[1]) {
    const vimeoId = vimeoMatch[1];
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
      directVideoUrl: null,
      isYouTube: false,
      isVimeo: true,
      isDirectVideo: false,
      isChannelUrl: false,
      rawUrl: trimmed
    };
  }

  // 4. Google Drive video preview matcher
  const gdriveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i;
  const gdriveMatch = trimmed.match(gdriveRegex);
  if (gdriveMatch && gdriveMatch[1]) {
    const fileId = gdriveMatch[1];
    return {
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      directVideoUrl: null,
      isYouTube: false,
      isVimeo: false,
      isDirectVideo: false,
      isChannelUrl: false,
      rawUrl: trimmed
    };
  }

  // 5. Direct video files (MP4, WebM, OGG, MOV) or Blob/Data URLs
  const isDirect = (
    trimmed.endsWith('.mp4') ||
    trimmed.endsWith('.webm') ||
    trimmed.endsWith('.ogg') ||
    trimmed.endsWith('.mov') ||
    trimmed.includes('.mp4?') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:video/')
  );

  if (isDirect) {
    return {
      embedUrl: null,
      directVideoUrl: trimmed,
      isYouTube: false,
      isVimeo: false,
      isDirectVideo: true,
      isChannelUrl: false,
      rawUrl: trimmed
    };
  }

  // Fallback: return raw URL
  return {
    embedUrl: null,
    directVideoUrl: null,
    isYouTube: trimmed.includes('youtube') || trimmed.includes('youtu.be'),
    isVimeo: trimmed.includes('vimeo'),
    isDirectVideo: false,
    isChannelUrl: false,
    rawUrl: trimmed
  };
}

/**
 * Convenience helper returning embed URL or null
 */
export function getEmbedUrl(url?: string | null): string | null {
  return parseVideoUrl(url).embedUrl;
}
