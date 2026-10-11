/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X, Calendar, CheckCircle2, XCircle, Search, UserCheck, 
  RefreshCw, AlertCircle, Clock, ShieldCheck, CheckSquare, Square
} from 'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserProfile } from '../../types';
import { cn } from '../../lib/utils';
import { getMemberWhatsAppCommunity } from '../../lib/whatsapp';

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: UserProfile[];
  initialMember?: UserProfile | null;
  initialDate?: string;
  onSuccess?: (message: string) => void;
}

export const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
  isOpen,
  onClose,
  members,
  initialMember = null,
  initialDate,
  onSuccess
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [targetDate, setTargetDate] = useState<string>(initialDate || todayStr);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialMember?.uid || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [prayerMinutes, setPrayerMinutes] = useState<number>(60);
  const [markAction, setMarkAction] = useState<'present' | 'absent'>('present');
  const [reason, setReason] = useState<string>('System error correction / Phone connection');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Batch multi-member mode
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [batchCommunityFilter, setBatchCommunityFilter] = useState<string>('all');

  // Filter members list
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (batchCommunityFilter !== 'all') {
        const comm = getMemberWhatsAppCommunity(m);
        if (!comm.toLowerCase().includes(batchCommunityFilter.toLowerCase())) {
          return false;
        }
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        (m.displayName || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        getMemberWhatsAppCommunity(m).toLowerCase().includes(q)
      );
    });
  }, [members, searchQuery, batchCommunityFilter]);

  // Selected single member details
  const activeSingleMember = useMemo(() => {
    return members.find(m => m.uid === selectedMemberId) || null;
  }, [members, selectedMemberId]);

  // Current status of the selected member on targetDate
  const currentStatusOnDate = useMemo(() => {
    if (!activeSingleMember) return null;
    const days: string[] = Array.isArray(activeSingleMember.attendanceDaysList) 
      ? activeSingleMember.attendanceDaysList 
      : [];
    const isPresent = days.includes(targetDate) || activeSingleMember.lastAttendedDate === targetDate;
    const mins = activeSingleMember.dailyMinutes ? activeSingleMember.dailyMinutes[targetDate] || 0 : 0;
    return { isPresent, mins };
  }, [activeSingleMember, targetDate]);

  if (!isOpen) return null;

  // Handle single member update
  const handleSubmitSingle = async () => {
    if (!selectedMemberId) {
      setFeedback({ type: 'error', message: 'Please select a member first.' });
      return;
    }
    if (!targetDate) {
      setFeedback({ type: 'error', message: 'Please select a valid date.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const userRef = doc(db, 'users', selectedMemberId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        throw new Error('Member record not found in database.');
      }

      const userData = userSnap.data();
      const currentDays: string[] = Array.isArray(userData.attendanceDaysList) ? [...userData.attendanceDaysList] : [];
      const dailyMap: Record<string, number> = userData.dailyMinutes ? { ...userData.dailyMinutes } : {};

      if (markAction === 'present') {
        // Mark PRESENT
        const isNew = !currentDays.includes(targetDate);
        dailyMap[targetDate] = Number(prayerMinutes) || 60;

        await updateDoc(userRef, {
          attendanceDaysList: arrayUnion(targetDate),
          lastAttendedDate: targetDate,
          attendanceCount: isNew ? (userData.attendanceCount || currentDays.length) + 1 : (userData.attendanceCount || currentDays.length),
          dailyMinutes: dailyMap,
          manualAdjustmentNote: `${reason} on ${new Date().toLocaleDateString()}`,
          ...(targetDate === todayStr ? { todayMinutes: Number(prayerMinutes) || 60 } : {})
        });

        const successMsg = `Successfully marked ${activeSingleMember?.displayName || 'Member'} as PRESENT for ${targetDate} (${prayerMinutes} mins).`;
        setFeedback({ type: 'success', message: successMsg });
        if (onSuccess) onSuccess(successMsg);
      } else {
        // Mark ABSENT (Correct false positive)
        const newDays = currentDays.filter(d => d !== targetDate);
        delete dailyMap[targetDate];

        await updateDoc(userRef, {
          attendanceDaysList: arrayRemove(targetDate),
          attendanceCount: Math.max(0, (userData.attendanceCount || currentDays.length) - 1),
          dailyMinutes: dailyMap,
          manualAdjustmentNote: `Absent correction: ${reason} on ${new Date().toLocaleDateString()}`,
          ...(targetDate === todayStr ? { todayMinutes: 0 } : {})
        });

        const successMsg = `Successfully marked ${activeSingleMember?.displayName || 'Member'} as ABSENT for ${targetDate} (error cleared).`;
        setFeedback({ type: 'success', message: successMsg });
        if (onSuccess) onSuccess(successMsg);
      }
    } catch (err: any) {
      console.error('Error manual attendance update:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to update attendance record.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle batch members update
  const handleSubmitBatch = async () => {
    if (batchSelectedIds.length === 0) {
      setFeedback({ type: 'error', message: 'Please select at least one member to batch update.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    let successCount = 0;
    try {
      for (const uid of batchSelectedIds) {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) continue;

        const userData = userSnap.data();
        const currentDays: string[] = Array.isArray(userData.attendanceDaysList) ? [...userData.attendanceDaysList] : [];
        const dailyMap: Record<string, number> = userData.dailyMinutes ? { ...userData.dailyMinutes } : {};

        if (markAction === 'present') {
          const isNew = !currentDays.includes(targetDate);
          dailyMap[targetDate] = Number(prayerMinutes) || 60;
          await updateDoc(userRef, {
            attendanceDaysList: arrayUnion(targetDate),
            lastAttendedDate: targetDate,
            attendanceCount: isNew ? (userData.attendanceCount || currentDays.length) + 1 : (userData.attendanceCount || currentDays.length),
            dailyMinutes: dailyMap,
            ...(targetDate === todayStr ? { todayMinutes: Number(prayerMinutes) || 60 } : {})
          });
        } else {
          delete dailyMap[targetDate];
          await updateDoc(userRef, {
            attendanceDaysList: arrayRemove(targetDate),
            attendanceCount: Math.max(0, (userData.attendanceCount || currentDays.length) - 1),
            dailyMinutes: dailyMap,
            ...(targetDate === todayStr ? { todayMinutes: 0 } : {})
          });
        }
        successCount++;
      }

      const successMsg = `Batch attendance completed: Updated ${successCount} member(s) to ${markAction.toUpperCase()} for ${targetDate}.`;
      setFeedback({ type: 'success', message: successMsg });
      if (onSuccess) onSuccess(successMsg);
      setBatchSelectedIds([]);
    } catch (err: any) {
      console.error('Batch update error:', err);
      setFeedback({ type: 'error', message: `Updated ${successCount} members before error: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSelectAllBatch = () => {
    if (batchSelectedIds.length === filteredMembers.length) {
      setBatchSelectedIds([]);
    } else {
      setBatchSelectedIds(filteredMembers.map(m => m.uid).filter(Boolean));
    }
  };

  const handleToggleBatchMember = (uid: string) => {
    setBatchSelectedIds(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50/70 to-amber-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-[#F26522] text-white flex items-center justify-center shadow-md shadow-[#F26522]/30">
              <UserCheck size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#1A1F3C]">
                Manual Attendance Marking & Error Correction
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                Fix system detection errors, late arrivals, phone call-ins, or misattributed records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-black/5 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector Tabs: Single Member vs Batch */}
        <div className="flex border-b border-gray-100 px-6 pt-3 bg-gray-50/50">
          <button
            onClick={() => setIsBatchMode(false)}
            className={cn(
              "pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer",
              !isBatchMode 
                ? "border-[#F26522] text-[#F26522]" 
                : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >
            Single Member Adjustment
          </button>
          <button
            onClick={() => setIsBatchMode(true)}
            className={cn(
              "pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer",
              isBatchMode 
                ? "border-[#F26522] text-[#F26522]" 
                : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >
            Batch Multi-Member Override
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Feedback banner */}
          {feedback && (
            <div className={cn(
              "p-4 rounded-2xl flex items-center justify-between text-xs font-bold border animate-in fade-in",
              feedback.type === 'success' 
                ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                : "bg-red-50 text-red-800 border-red-200"
            )}>
              <div className="flex items-center space-x-2">
                {feedback.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-red-600 shrink-0" />}
                <span>{feedback.message}</span>
              </div>
              <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Date & Action Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1.5 flex items-center space-x-1.5">
                <Calendar size={14} className="text-[#F26522]" />
                <span>Attendance Date</span>
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                max={todayStr}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522] focus:bg-white"
              />
              <p className="text-[10px] text-gray-400 mt-1">Select the exact date the prayer session occurred</p>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1.5 flex items-center space-x-1.5">
                <ShieldCheck size={14} className="text-[#F26522]" />
                <span>Corrective Action</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMarkAction('present')}
                  className={cn(
                    "flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border",
                    markAction === 'present'
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <CheckCircle2 size={15} />
                  <span>Mark PRESENT</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMarkAction('absent')}
                  className={cn(
                    "flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border",
                    markAction === 'absent'
                      ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <XCircle size={15} />
                  <span>Mark ABSENT</span>
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {markAction === 'present' 
                  ? 'Add to attendance list & increment count' 
                  : 'Remove date & decrement count (system error correction)'}
              </p>
            </div>
          </div>

          {/* If Mark Present: Prayer Minutes */}
          {markAction === 'present' && (
            <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-orange-900 flex items-center space-x-1.5">
                <Clock size={14} className="text-[#F26522]" />
                <span>Credited Prayer Minutes for {targetDate}</span>
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={prayerMinutes}
                  onChange={(e) => setPrayerMinutes(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-32 px-3 py-2 bg-white border border-orange-200 rounded-xl font-mono font-black text-sm text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522]"
                />
                <span className="text-xs font-bold text-gray-500">minutes</span>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setPrayerMinutes(30)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-gray-200 hover:bg-gray-100"
                  >
                    30m
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrayerMinutes(60)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-gray-200 hover:bg-gray-100"
                  >
                    60m (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrayerMinutes(90)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-gray-200 hover:bg-gray-100"
                  >
                    90m
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reason Note */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1.5">
              Reason / Audit Note (Optional)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522]"
            >
              <option value="System error correction / Phone connection">System error correction / Phone connection</option>
              <option value="Zoom name mismatch / Joined via guest account">Zoom name mismatch / Joined via guest account</option>
              <option value="Joined via WhatsApp / Telephone call-in">Joined via WhatsApp / Telephone call-in</option>
              <option value="Technical difficulty during Zoom sync">Technical difficulty during Zoom sync</option>
              <option value="False positive removal (marked in error)">False positive removal (marked in error)</option>
              <option value="Approved leadership override">Approved leadership override</option>
            </select>
          </div>

          {/* SINGLE MODE: Select Member & Status Card */}
          {!isBatchMode ? (
            <div className="space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-gray-700">
                Select Member to Update ({filteredMembers.length} available)
              </label>

              {/* Search bar inside modal */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search member by name, phone, email, or group..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F26522] focus:bg-white"
                />
              </div>

              {/* Members Quick Selection List */}
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-2xl divide-y divide-gray-100 bg-white">
                {filteredMembers.map((m) => {
                  const isSelected = selectedMemberId === m.uid;
                  const comm = getMemberWhatsAppCommunity(m);
                  return (
                    <div
                      key={m.uid}
                      onClick={() => setSelectedMemberId(m.uid)}
                      className={cn(
                        "p-2.5 px-3 flex items-center justify-between cursor-pointer transition-colors text-xs",
                        isSelected ? "bg-orange-50/80 font-bold" : "hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                          isSelected ? "bg-[#F26522] text-white" : "bg-gray-200 text-gray-600"
                        )}>
                          {(m.displayName || m.email || 'M').charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-[#1A1F3C] truncate">{m.displayName || 'Member'}</p>
                          <p className="text-[10px] text-gray-400 truncate font-mono">{m.phone || m.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                        {comm}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Current status display for selected member */}
              {activeSingleMember && currentStatusOnDate && (
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Current Status on {targetDate}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[#1A1F3C] text-sm">
                      {activeSingleMember.displayName}
                    </span>
                    {currentStatusOnDate.isPresent ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        <span>PRESENT ({currentStatusOnDate.mins} mins)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                        <XCircle size={12} className="text-rose-600" />
                        <span>ABSENT (Not recorded)</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* BATCH MODE: Checkbox list */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700">
                  Select Multiple Members ({batchSelectedIds.length} of {filteredMembers.length} selected)
                </label>
                <button
                  type="button"
                  onClick={handleToggleSelectAllBatch}
                  className="text-xs font-black text-[#F26522] hover:underline cursor-pointer flex items-center space-x-1"
                >
                  {batchSelectedIds.length === filteredMembers.length ? <Square size={13} /> : <CheckSquare size={13} />}
                  <span>{batchSelectedIds.length === filteredMembers.length ? 'Deselect All' : 'Select All'}</span>
                </button>
              </div>

              {/* Search in batch mode */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter members by name, phone, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F26522] focus:bg-white"
                />
              </div>

              {/* Checkbox list */}
              <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-2xl divide-y divide-gray-100 bg-white">
                {filteredMembers.map((m) => {
                  const isChecked = batchSelectedIds.includes(m.uid);
                  const comm = getMemberWhatsAppCommunity(m);
                  return (
                    <label
                      key={m.uid}
                      className={cn(
                        "p-2.5 px-3 flex items-center justify-between cursor-pointer transition-colors text-xs",
                        isChecked ? "bg-orange-50/60 font-bold" : "hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleBatchMember(m.uid)}
                          className="w-4 h-4 rounded text-[#F26522] focus:ring-[#F26522] cursor-pointer"
                        />
                        <div className="truncate">
                          <p className="font-bold text-[#1A1F3C] truncate">{m.displayName || 'Member'}</p>
                          <p className="text-[10px] text-gray-400 font-mono truncate">{m.phone || m.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                        {comm}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={isBatchMode ? handleSubmitBatch : handleSubmitSingle}
            disabled={isSubmitting || (!isBatchMode && !selectedMemberId) || (isBatchMode && batchSelectedIds.length === 0)}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed",
              markAction === 'present' 
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30" 
                : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
            )}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                {markAction === 'present' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                <span>
                  {isBatchMode 
                    ? `Apply to ${batchSelectedIds.length} Members` 
                    : `Confirm ${markAction.toUpperCase()} Override`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
export default ManualAttendanceModal;
