/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'super_admin' | 'admin_assistant' | 'member';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  permissions?: string[];
  country?: string;
  timezone?: string;
  whatsappGroup?: string;
  whatsappGroupName?: string;
  whatsappCommunity?: string;
  phone?: string;
  joinedWhatsappGroup?: boolean;
  whatsappJoinedAt?: string;
  trafficSource?: string;
  attendanceCount: number;
  joinedAt: string;
  // Enhanced Attendance & Prayer Time fields
  totalMinutes?: number;
  thisYearMinutes?: number;
  thisWeekMinutes?: number;
  todayMinutes?: number;
  attendanceDaysList?: string[];
  lastAttendedDate?: string;
  dailyMinutes?: Record<string, number>;
  isZoomActive?: boolean;
  lastZoomActiveAt?: any;
  lastActiveAt?: any;
}

export interface WeeklyTheme {
  id: string;
  title: string;
  scripture: string;
  flyerUrl?: string;
  imageUrl?: string;
  dates: string;
  startDate?: string;
  endDate?: string;
  minister: string;
  prayerPoints: string[];
  isCurrent: boolean;
  description?: string;
  createdAt?: string;
}

export interface Testimony {
  id: string;
  userId?: string;
  name: string;
  country: string;
  category: 'Healing' | 'Deliverance' | 'Provision' | 'Restoration' | 'Other';
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  status: 'pending' | 'approved' | 'declined';
  isAnonymous: boolean;
  createdAt: string;
}

export interface PrayerRequest {
  id: string;
  userId?: string;
  name: string;
  text: string;
  status: 'pending' | 'answered';
  isAnonymous: boolean;
  createdAt: string;
}

export interface OutreachProject {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  status: 'active' | 'completed';
  goalAmount: number;
  currentAmount: number;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD (WAT)
  timestamp: string;
}

export interface Sermon {
  id: string;
  title: string;
  youtubeId?: string;
  audioUrl?: string;
  date: string;
  minister: string;
  createdAt: string;
}

export interface ProgramItem {
  id: string;
  title: string;
  series?: string;
  theme: string;
  date: string;
  time: string;
  location: string;
  imageUrl: string;
  videoUrl?: string;
  description?: string;
  isAlwaysVisible?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export interface TimezoneOption {
  label: string;
  offset: number;
  cities: string[];
}

export interface ZoomSessionItem {
  id: string;
  title: string;
  meetingDate: string; // YYYY-MM-DD
  meetingTime?: string;
  totalParticipants: number;
  totalMinutes: number;
  syncedBy?: string;
  source?: 'csv_import' | 'manual_sync' | 'live_zoom';
  createdAt?: any;
  notes?: string;
}

export interface ZoomParticipantLog {
  id: string;
  sessionId?: string;
  sessionTitle?: string;
  name: string;
  email?: string;
  durationMinutes: number;
  joinTime?: string;
  leaveTime?: string;
  date: string; // YYYY-MM-DD
  isMember?: boolean;
  memberUid?: string;
  whatsappCommunity?: string;
  status?: 'synced' | 'guest' | 'manual' | 'reversed_absent';
  createdAt?: any;
}

export interface BookItem {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  description: string;
  coverImageUrl?: string;
  category: string;
  format?: string;
  pages?: number | string;
  publishedYear?: string;
  isbn?: string;
  downloadUrl?: string;
  previewUrl?: string;
  purchaseUrl?: string;
  isFree?: boolean;
  price?: string;
  isFeatured?: boolean;
  isPublished?: boolean;
  order?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface ReadingPlanDay {
  day: number;
  week: number;
  weekTitle: string;
  theme: string;
  scriptureReference: string;
  keyVerse: string;
  keyVerseText: string;
  devotionalInsight: string;
  prayerPoints: string[];
  declaration: string;
  bibleGatewayQuery?: string;
}

export interface ReadingPlanNote {
  day: number;
  text: string;
  updatedAt: string;
}

export interface ReadingPlanProgress {
  completedDays: number[]; // Array of day numbers e.g. [1, 2, 3]
  notes: Record<number, string>; // day -> note text
  startDate?: string;
  lastActiveDate?: string;
  streak: number;
}


