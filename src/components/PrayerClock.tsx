/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { format, addDays, isBefore } from 'date-fns';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { Clock, Globe, Flame, CheckCircle2, Play, Pause, Timer } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { logPrayerMinute, getTodayDateString, markAttendanceForToday } from '../lib/attendance';
import { useZoomSession } from '../lib/ZoomContext';

const LOCATIONS = [
  { name: 'Nigeria (WAT)', zone: 'Africa/Lagos' },
  { name: 'New York', zone: 'America/New_York' },
  { name: 'London', zone: 'Europe/London' },
  { name: 'Netherlands', zone: 'Europe/Amsterdam' },
  { name: 'Trinidad', zone: 'America/Port_of_Spain' },
  { name: 'Texas', zone: 'America/Chicago' },
  { name: 'Germany', zone: 'Europe/Berlin' },
  { name: 'Canada (EST)', zone: 'America/Toronto' },
];

export function PrayerClock() {
  const { user, profile, login } = useAuth();
  const { isMeetingActive, activeSeconds, launchZoom, stopZoomSession, formatTime } = useZoomSession();
  const [now, setNow] = useState(new Date());
  const [nextPrayer, setNextPrayer] = useState<{ time: Date; countdown: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const currentTime = new Date();
      setNow(currentTime);
      calculateNextPrayer(currentTime);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const togglePrayerSession = (e: React.MouseEvent) => {
    if (isMeetingActive) {
      stopZoomSession();
    } else {
      launchZoom(e);
    }
  };

  const calculateNextPrayer = (currentTime: Date) => {
    // Prayer is at 5:00 AM WAT every weekday (Mon-Fri)
    const watZone = 'Africa/Lagos';
    let prayerDate = toDate(formatInTimeZone(currentTime, watZone, "yyyy-MM-dd'T'05:00:00"), { timeZone: watZone });

    // If it's already past 5am WAT today, or if it's a weekend, find the next weekday at 5am
    const dayOfWeek = parseInt(formatInTimeZone(currentTime, watZone, 'i')); // 1=Mon, 7=Sun
    
    if (isBefore(prayerDate, currentTime) || dayOfWeek > 5) {
      let daysToAdd = 1;
      if (dayOfWeek >= 5) daysToAdd = 8 - dayOfWeek;
      prayerDate = addDays(prayerDate, daysToAdd);
    }

    const diff = prayerDate.getTime() - currentTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setNextPrayer({
      time: prayerDate,
      countdown: `${hours}h ${minutes}m ${seconds}s`
    });
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
      <div className="bg-[#1A1F3C] p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#F26522]/20 rounded-xl">
            <Clock className="w-5 h-5 text-[#F26522]" />
          </div>
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-wider">Next Live Prayer</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">5:00 AM WAT (MON-FRI)</p>
          </div>
        </div>
        <div className="bg-[#F26522] text-white px-4 py-1.5 rounded-full text-xs font-black animate-pulse shadow-lg shadow-[#F26522]/30">
          {nextPrayer?.countdown || '--:--:--'}
        </div>
      </div>
      
      {/* Attendance Clock In Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Flame className="w-5 h-5 text-[#F26522]" />
            <h4 className="font-black text-xs uppercase tracking-wider text-[#1A1F3C]">
              Live Prayer Attendance Clock
            </h4>
          </div>
          {isMeetingActive && (
            <span className="flex items-center space-x-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              <span>Session In Progress • Auto-stops when Zoom ends</span>
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="space-y-1 w-full sm:w-auto">
            <p className="text-xs font-bold text-gray-500">Your Attendance Summary:</p>
            <div className="flex items-center space-x-4 text-xs font-black text-[#1A1F3C]">
              <span>Days Attended: <strong className="text-[#F26522]">{profile?.attendanceCount || (profile?.attendanceDaysList?.length || 0)}</strong></span>
              <span>Today: <strong className="text-emerald-600">{profile?.todayMinutes || Math.floor(activeSeconds / 60)} mins</strong></span>
              <span>This Year: <strong className="text-blue-600">{profile?.thisYearMinutes || profile?.thisWeekMinutes || 0} mins</strong></span>
            </div>
          </div>

          <button
            onClick={togglePrayerSession}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer ${
              isMeetingActive 
                ? "bg-rose-600 text-white hover:bg-rose-700" 
                : "bg-[#F26522] text-white hover:bg-[#d9561a]"
            }`}
          >
            {isMeetingActive ? (
              <>
                <Pause className="w-4 h-4" />
                <span>In Zoom ({formatTime(activeSeconds)}) • Click to Exit</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Clock In & Launch Zoom</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {LOCATIONS.map((loc) => (
          <div key={loc.name} className="flex flex-col bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter truncate">{loc.name}</span>
            <span className="text-base font-mono font-black text-[#1A1F3C]">
              {formatInTimeZone(now, loc.zone, 'HH:mm:ss')}
            </span>
          </div>
        ))}
      </div>
      
      <div className="bg-gray-50 p-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-[#F26522] text-xs font-bold">
          <Globe className="w-4 h-4" />
          <span>GLOBAL PRAYER FAMILY: 12+ COUNTRIES CONNECTED LIVE</span>
        </div>
      </div>
    </div>
  );
}
