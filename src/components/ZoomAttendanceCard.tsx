/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Video, ExternalLink, CheckCircle2, AlertCircle, Clock, WifiOff, StopCircle, Maximize2, Minimize2, Radio } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { getTodayDateString } from '../lib/attendance';
import { useZoomSession, ZOOM_MEETING_URL, ZOOM_EMBED_URL, ZOOM_MEETING_ID, ZOOM_PASSCODE } from '../lib/ZoomContext';

export { ZOOM_MEETING_URL, ZOOM_EMBED_URL, ZOOM_MEETING_ID, ZOOM_PASSCODE };

interface ZoomAttendanceCardProps {
  className?: string;
  variant?: 'full' | 'compact' | 'hero';
}

export function ZoomAttendanceCard({ className = '', variant = 'full' }: ZoomAttendanceCardProps) {
  const { user, profile } = useAuth();
  const {
    isMeetingActive,
    activeSeconds,
    yearlySeconds,
    showEmbeddedZoom,
    setShowEmbeddedZoom,
    toastMessage,
    isGlobalMeetingLive,
    activeParticipantsCount,
    guestName,
    guestPhone,
    setShowNamePrompt,
    launchZoom,
    stopZoomSession,
    formatTime,
  } = useZoomSession();

  const todayStr = getTodayDateString();
  const isAttendedToday = Boolean(
    profile?.attendanceDaysList?.includes(todayStr) || profile?.lastAttendedDate === todayStr || (profile?.todayMinutes || 0) > 0 || activeSeconds > 0
  );

  return (
    <div className={`bg-[#1A1F3C] rounded-3xl shadow-2xl p-6 sm:p-8 text-white relative overflow-hidden border border-white/10 space-y-6 ${className}`}>
      {/* Background Decorative Icon */}
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Video size={140} />
      </div>

      {/* Live Global Signal Banner if meeting is going on anywhere */}
      {(isGlobalMeetingLive || isMeetingActive) && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-3 flex items-center justify-between text-emerald-300 text-xs font-bold animate-pulse">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>LIVE PRAYER MEETING IN PROGRESS ON ZOOM</span>
          </div>
          {activeParticipantsCount > 0 && (
            <span className="bg-emerald-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase text-emerald-200">
              {activeParticipantsCount} Active
            </span>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 text-[#F26522]">
          <Video className="w-6 h-6 shrink-0" />
          <h2 className="text-xl font-black uppercase tracking-tight">Daily Prayer Zoom Meeting</h2>
        </div>

        {/* Live Attendance Status Pill */}
        {isMeetingActive ? (
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Counting Zoom Time</span>
          </span>
        ) : isAttendedToday ? (
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>Attended Today</span>
          </span>
        ) : (
          <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5">
            <AlertCircle size={13} className="text-amber-400" />
            <span>Not Attended Yet</span>
          </span>
        )}
      </div>

      {/* Meeting Access Credentials */}
      <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
        <div className="space-y-0.5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Meeting ID</p>
          <p className="text-xl font-mono font-black text-white">{ZOOM_MEETING_ID}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Passcode</p>
          <p className="text-xl font-mono font-black text-white">{ZOOM_PASSCODE}</p>
        </div>
      </div>

      {/* Real-time Time Spent Counter Box */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-bold text-gray-300">
              <Clock className="w-4 h-4 text-[#F26522]" />
              <span>Time Spent in Zoom Today:</span>
            </div>
            <p className="text-2xl font-mono font-black text-[#F26522]">
              {formatTime(activeSeconds)}
            </p>
          </div>

          {isMeetingActive ? (
            <button
              onClick={stopZoomSession}
              className="px-3 py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-lg"
            >
              <StopCircle size={14} />
              <span>Exited Zoom? Stop Counter</span>
            </button>
          ) : (
            <div className="text-right">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-block">
                Auto-starts on Launch
              </span>
            </div>
          )}
        </div>

        <div className="text-[10px] text-gray-400 font-medium flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-white/5">
          {user ? (
            <span>Saved to your profile: <strong className="text-white">{profile?.todayMinutes || Math.floor(activeSeconds / 60)} minutes</strong> recorded today.</span>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span>
                Visitor Attendance: <strong className="text-white">{guestName || 'Guest'}</strong> {guestPhone ? `(${guestPhone})` : ''}
              </span>
              {yearlySeconds > 0 && (
                <span className="text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md text-[9px]">
                  {formatTime(yearlySeconds)} yearly
                </span>
              )}
              <button
                onClick={() => setShowNamePrompt(true)}
                className="text-[#F26522] hover:underline font-bold ml-1 cursor-pointer text-[10px]"
              >
                (Edit Name/Phone)
              </button>
            </div>
          )}
          {isMeetingActive && (
            <span className="text-emerald-400 font-bold">
              • Syncing live to church prayer log
            </span>
          )}
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="bg-emerald-500 text-white text-xs font-bold p-3 rounded-xl shadow-lg flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Embedded Zoom Iframe */}
      {showEmbeddedZoom && (
        <div className="space-y-2 border border-white/20 rounded-2xl p-2 bg-black/40">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-bold text-gray-300">Embedded Zoom Web Player</span>
            <button
              onClick={stopZoomSession}
              className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center space-x-1 cursor-pointer"
            >
              <Minimize2 size={14} />
              <span>Close & Exit Player</span>
            </button>
          </div>
          <iframe
            src={ZOOM_EMBED_URL}
            className="w-full h-80 rounded-xl border border-white/10 bg-black"
            allow="camera; microphone; fullscreen"
            title="Embedded Zoom Meeting"
          ></iframe>
        </div>
      )}

      {/* Primary Action Buttons */}
      <div className="space-y-3 pt-2">
        <button
          onClick={(e) => launchZoom(e, false)}
          className="w-full py-4 bg-[#F26522] text-white rounded-xl font-black uppercase tracking-[0.15em] flex items-center justify-center space-x-2 hover:bg-[#d9561a] active:scale-[0.99] transition-all shadow-lg shadow-[#F26522]/30 text-sm cursor-pointer"
        >
          <span>Launch Zoom Meeting</span>
          <ExternalLink className="w-4 h-4 shrink-0" />
        </button>

        {!showEmbeddedZoom && (
          <button
            onClick={(e) => launchZoom(e, true)}
            className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all border border-white/10 cursor-pointer"
          >
            <Maximize2 size={14} />
            <span>Join Directly Inside App (Embedded Zoom Window)</span>
          </button>
        )}
      </div>
    </div>
  );
}
