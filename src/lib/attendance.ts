/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, updateDoc, setDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from './firebase';

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

