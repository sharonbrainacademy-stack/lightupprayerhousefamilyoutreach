/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, Calendar, CheckCircle2, XCircle, Download, 
  Copy, Check, Search, Filter, Phone, MessageCircle, 
  Clock, Flame, ArrowLeft, ArrowRight, Printer, 
  FileSpreadsheet, Sparkles, AlertCircle, Share2,
  RefreshCw, ChevronDown, UserCheck, Bot,
  CheckSquare, Square, Zap, Upload, ShieldCheck,
  ChevronRight, ChevronLeft, CheckCheck, ListFilter, SlidersHorizontal,
  LayoutGrid, Table as TableIcon, HeartHandshake
} from 'lucide-react';
import { 
  doc, updateDoc, arrayUnion, arrayRemove, 
  increment, writeBatch, getDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserProfile } from '../../types';
import { getTodayDateString } from '../../lib/attendance';
import { getMemberWhatsAppCommunity, WHATSAPP_COMMUNITY_OPTIONS } from '../../lib/whatsapp';
import { cn } from '../../lib/utils';
import { ManualAttendanceModal } from './ManualAttendanceModal';
import AbsentFollowUpHub from './AbsentFollowUpHub';

interface DailyAttendanceReportProps {
  members: UserProfile[];
  onRefreshMembers?: () => void;
  initialSubTab?: 'reports' | 'followup';
  initialDate?: string;
}

interface MemberAttendanceRow {
  member: UserProfile;
  isPresent: boolean;
  minutes: number;
  displayName: string;
  phone: string;
  email: string;
  community: string;
}

export default function DailyAttendanceReport({ 
  members, 
  onRefreshMembers,
  initialSubTab = 'reports',
  initialDate
}: DailyAttendanceReportProps) {
  const todayStr = getTodayDateString();
  const [activeSubTab, setActiveSubTab] = useState<'reports' | 'followup'>(
    initialSubTab === ('auto' as any) || (initialSubTab as string) === 'manual' ? 'reports' : (initialSubTab || 'reports')
  );

  useEffect(() => {
    if (initialSubTab && initialSubTab !== ('auto' as any) && (initialSubTab as string) !== 'manual') {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'single' | 'all-groups'>('single');
  const [displayFormat, setDisplayFormat] = useState<'table' | 'cards'>('table');
  const [isCopyingWhatsApp, setIsCopyingWhatsApp] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [isUpdatingMemberId, setIsUpdatingMemberId] = useState<string | null>(null);

  // Table horizontal scroll ref & helper
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const handleScrollTable = (direction: 'left' | 'right') => {
    if (tableScrollRef.current) {
      const offset = direction === 'left' ? -350 : 350;
      tableScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Quick 1-click single member inline marker in Reports tab
  const [quickMarkerSearch, setQuickMarkerSearch] = useState('');
  const [quickMarkerMemberId, setQuickMarkerMemberId] = useState('');
  const [quickMarkerMinutes, setQuickMarkerMinutes] = useState(60);
  const [quickMarkerIsSubmitting, setQuickMarkerIsSubmitting] = useState(false);
  const [showQuickMarkerDropdown, setShowQuickMarkerDropdown] = useState(false);

  // Bulk multi-select on Roster table
  const [selectedRowUids, setSelectedRowUids] = useState<string[]>([]);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  // Manual Attendance & Error Correction Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualModalMember, setManualModalMember] = useState<UserProfile | null>(null);
  const [manualModalSuccessBanner, setManualModalSuccessBanner] = useState<string | null>(null);

  // Collect all unique communities across registered members + default list
  const allCommunities = useMemo(() => {
    const set = new Set<string>(WHATSAPP_COMMUNITY_OPTIONS);
    members.forEach(m => {
      const comm = getMemberWhatsAppCommunity(m);
      if (comm && comm !== 'Unassigned') {
        set.add(comm);
      }
    });
    return Array.from(set).sort();
  }, [members]);

  // Collect all recorded attendance dates from member history for quick selection
  const recordedDates = useMemo(() => {
    const datesSet = new Set<string>();
    datesSet.add(todayStr);

    members.forEach(m => {
      if (Array.isArray(m.attendanceDaysList)) {
        m.attendanceDaysList.forEach(d => {
          if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
            datesSet.add(d);
          }
        });
      }
      if (m.lastAttendedDate && /^\d{4}-\d{2}-\d{2}$/.test(m.lastAttendedDate)) {
        datesSet.add(m.lastAttendedDate);
      }
      if (m.dailyMinutes) {
        Object.keys(m.dailyMinutes).forEach(d => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
            datesSet.add(d);
          }
        });
      }
    });

    return Array.from(datesSet).sort().reverse();
  }, [members, todayStr]);

  // Helper to determine if a member was present on a given date
  const checkMemberPresentOnDate = (m: UserProfile, dateStr: string): { isPresent: boolean; minutes: number } => {
    const isToday = dateStr === todayStr;
    const hasInDaysList = Array.isArray(m.attendanceDaysList) && m.attendanceDaysList.includes(dateStr);
    const hasLastAttended = m.lastAttendedDate === dateStr;
    const recordedMins = m.dailyMinutes?.[dateStr] || 0;
    const hasTodayMinutes = isToday && (m.todayMinutes || 0) > 0;
    const isZoomLive = isToday && Boolean(m.isZoomActive);

    const isPresent = Boolean(hasInDaysList || hasLastAttended || recordedMins > 0 || hasTodayMinutes || isZoomLive);
    const minutes = recordedMins > 0 ? recordedMins : (isToday ? (m.todayMinutes || (isPresent ? 60 : 0)) : (isPresent ? 60 : 0));

    return { isPresent, minutes };
  };

  // Build rows for a given group (or all) and enforce strict sorting:
  // Present members first (alphabetical), then Absent members (alphabetical)
  const getProcessedRosterForGroup = (groupName: string, targetDate = selectedDate) => {
    const groupMembers = members.filter(m => {
      if (groupName === 'all') return true;
      const comm = getMemberWhatsAppCommunity(m);
      if (groupName === 'Unassigned') return comm === 'Unassigned';
      return comm.toLowerCase().trim() === groupName.toLowerCase().trim() ||
             (m.whatsappCommunity || '').toLowerCase().trim() === groupName.toLowerCase().trim() ||
             (m.whatsappGroupName || '').toLowerCase().trim() === groupName.toLowerCase().trim();
    });

    const rows: MemberAttendanceRow[] = groupMembers.map(m => {
      const { isPresent, minutes } = checkMemberPresentOnDate(m, targetDate);
      return {
        member: m,
        isPresent,
        minutes,
        displayName: (m.displayName || '').trim() || m.email || 'Unnamed Member',
        phone: m.phone || m.whatsappGroup || '',
        email: m.email || '',
        community: getMemberWhatsAppCommunity(m)
      };
    });

    const presentList = rows.filter(r => r.isPresent);
    const absentList = rows.filter(r => !r.isPresent);

    presentList.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
    absentList.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));

    const sortedUnified = [...presentList, ...absentList];

    return {
      total: rows.length,
      presentCount: presentList.length,
      absentCount: absentList.length,
      attendanceRate: rows.length > 0 ? Math.round((presentList.length / rows.length) * 100) : 0,
      presentList,
      absentList,
      sortedUnified
    };
  };

  // Current active report data for the selected group & date
  const activeReport = useMemo(() => {
    return getProcessedRosterForGroup(selectedGroup, selectedDate);
  }, [members, selectedGroup, selectedDate]);

  // Filtered displayed rows
  const displayedRows = useMemo(() => {
    let list = activeReport.sortedUnified;

    if (statusFilter === 'present') {
      list = list.filter(r => r.isPresent);
    } else if (statusFilter === 'absent') {
      list = list.filter(r => !r.isPresent);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => 
        r.displayName.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.community.toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeReport, statusFilter, searchQuery]);

  // Format date nicely
  const formattedDateTitle = useMemo(() => {
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Date shifting
  const handleShiftDate = (days: number) => {
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      d.setDate(d.getDate() + days);
      const nextStr = d.toISOString().split('T')[0];
      setSelectedDate(nextStr);
    } catch (e) {
      console.error('Error shifting date:', e);
    }
  };

  // Toggle or explicitly set single member attendance status directly
  const handleToggleAttendance = async (row: MemberAttendanceRow, forceTargetStatus?: 'present' | 'absent') => {
    const uid = row.member.uid;
    if (!uid) return;

    if (forceTargetStatus) {
      if (forceTargetStatus === 'present' && row.isPresent) return;
      if (forceTargetStatus === 'absent' && !row.isPresent) return;
    }

    const shouldMarkAbsent = forceTargetStatus ? forceTargetStatus === 'absent' : row.isPresent;

    setIsUpdatingMemberId(uid);
    try {
      const userRef = doc(db, 'users', uid);
      const currentDays = Array.isArray(row.member.attendanceDaysList) ? [...row.member.attendanceDaysList] : [];
      const currentDailyMap = row.member.dailyMinutes ? { ...row.member.dailyMinutes } : {};

      if (shouldMarkAbsent) {
        // Mark as ABSENT
        const newDays = currentDays.filter(d => d !== selectedDate);
        delete currentDailyMap[selectedDate];

        await updateDoc(userRef, {
          attendanceDaysList: arrayRemove(selectedDate),
          attendanceCount: Math.max(0, (row.member.attendanceCount || currentDays.length) - 1),
          totalMinutes: Math.max(0, (row.member.totalMinutes || 0) - (row.minutes || 60)),
          dailyMinutes: currentDailyMap,
          manualAdjustmentNote: `Marked absent on ${new Date().toLocaleDateString()}`,
          ...(selectedDate === todayStr ? { todayMinutes: 0 } : {})
        });
        setManualModalSuccessBanner(`Marked ${row.displayName} as ABSENT for ${selectedDate}.`);
      } else {
        // Mark as PRESENT
        const isNewDay = !currentDays.includes(selectedDate);
        currentDailyMap[selectedDate] = currentDailyMap[selectedDate] || 60;

        await updateDoc(userRef, {
          attendanceDaysList: arrayUnion(selectedDate),
          lastAttendedDate: selectedDate,
          attendanceCount: increment(isNewDay ? 1 : 0),
          totalMinutes: (row.member.totalMinutes || 0) + (currentDailyMap[selectedDate] || 60),
          dailyMinutes: currentDailyMap,
          manualAdjustmentNote: `Marked present on ${new Date().toLocaleDateString()}`,
          ...(selectedDate === todayStr ? { todayMinutes: currentDailyMap[selectedDate] } : {})
        });
        setManualModalSuccessBanner(`Marked ${row.displayName} as PRESENT for ${selectedDate}.`);
      }

      setTimeout(() => setManualModalSuccessBanner(null), 4000);
      if (onRefreshMembers) onRefreshMembers();
    } catch (err) {
      console.error('Failed to update attendance:', err);
    } finally {
      setIsUpdatingMemberId(null);
    }
  };

  // Batch toggle attendance (mark multiple members at once)
  const handleBatchToggleAttendance = async (uids: string[], targetStatus: 'present' | 'absent', dateToApply = selectedDate) => {
    if (uids.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const batch = writeBatch(db);
      for (const uid of uids) {
        const m = members.find(mem => mem.uid === uid);
        if (!m) continue;
        const userRef = doc(db, 'users', uid);
        const currentDays = Array.isArray(m.attendanceDaysList) ? [...m.attendanceDaysList] : [];
        const currentDailyMap = m.dailyMinutes ? { ...m.dailyMinutes } : {};

        if (targetStatus === 'present') {
          const isNewDay = !currentDays.includes(dateToApply);
          currentDailyMap[dateToApply] = currentDailyMap[dateToApply] || 60;
          batch.update(userRef, {
            attendanceDaysList: arrayUnion(dateToApply),
            lastAttendedDate: dateToApply,
            attendanceCount: increment(isNewDay ? 1 : 0),
            dailyMinutes: currentDailyMap,
            manualAdjustmentNote: `Batch marked present on ${new Date().toLocaleDateString()}`,
            ...(dateToApply === todayStr ? { todayMinutes: currentDailyMap[dateToApply] } : {})
          });
        } else {
          delete currentDailyMap[dateToApply];
          batch.update(userRef, {
            attendanceDaysList: arrayRemove(dateToApply),
            attendanceCount: Math.max(0, (m.attendanceCount || currentDays.length) - 1),
            dailyMinutes: currentDailyMap,
            manualAdjustmentNote: `Batch marked absent on ${new Date().toLocaleDateString()}`,
            ...(dateToApply === todayStr ? { todayMinutes: 0 } : {})
          });
        }
      }

      await batch.commit();
      setSelectedRowUids([]);
      setManualModalSuccessBanner(`Successfully marked ${uids.length} member(s) as ${targetStatus.toUpperCase()} for ${dateToApply}!`);
      setTimeout(() => setManualModalSuccessBanner(null), 5000);
      if (onRefreshMembers) onRefreshMembers();
    } catch (err: any) {
      console.error('Batch update failed:', err);
      alert('Failed to batch update attendance: ' + err?.message);
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Quick 1-click single member inline execution
  const handleQuickInlineMark = async (targetStatus: 'present' | 'absent') => {
    if (!quickMarkerMemberId) {
      alert('Please select or search for a member first.');
      return;
    }
    const targetMember = members.find(m => m.uid === quickMarkerMemberId);
    if (!targetMember) return;

    setQuickMarkerIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', quickMarkerMemberId);
      const currentDays = Array.isArray(targetMember.attendanceDaysList) ? [...targetMember.attendanceDaysList] : [];
      const currentDailyMap = targetMember.dailyMinutes ? { ...targetMember.dailyMinutes } : {};

      if (targetStatus === 'present') {
        const isNewDay = !currentDays.includes(selectedDate);
        currentDailyMap[selectedDate] = Number(quickMarkerMinutes) || 60;
        await updateDoc(userRef, {
          attendanceDaysList: arrayUnion(selectedDate),
          lastAttendedDate: selectedDate,
          attendanceCount: increment(isNewDay ? 1 : 0),
          dailyMinutes: currentDailyMap,
          manualAdjustmentNote: `Quick inline marked present on ${new Date().toLocaleDateString()}`,
          ...(selectedDate === todayStr ? { todayMinutes: Number(quickMarkerMinutes) || 60 } : {})
        });
        setManualModalSuccessBanner(`Quick marked ${targetMember.displayName || 'Member'} as PRESENT (${quickMarkerMinutes}m) for ${selectedDate}!`);
      } else {
        delete currentDailyMap[selectedDate];
        await updateDoc(userRef, {
          attendanceDaysList: arrayRemove(selectedDate),
          attendanceCount: Math.max(0, (targetMember.attendanceCount || currentDays.length) - 1),
          dailyMinutes: currentDailyMap,
          manualAdjustmentNote: `Quick inline marked absent on ${new Date().toLocaleDateString()}`,
          ...(selectedDate === todayStr ? { todayMinutes: 0 } : {})
        });
        setManualModalSuccessBanner(`Quick marked ${targetMember.displayName || 'Member'} as ABSENT for ${selectedDate}!`);
      }

      setQuickMarkerMemberId('');
      setQuickMarkerSearch('');
      setShowQuickMarkerDropdown(false);
      setTimeout(() => setManualModalSuccessBanner(null), 4000);
      if (onRefreshMembers) onRefreshMembers();
    } catch (err: any) {
      console.error('Quick mark error:', err);
      alert('Error updating attendance: ' + err?.message);
    } finally {
      setQuickMarkerIsSubmitting(false);
    }
  };

  // Export CSV strictly formatted with Present first then Absent (both alphabetical)
  const handleExportCSV = (groupToExport = selectedGroup) => {
    const reportData = getProcessedRosterForGroup(groupToExport, selectedDate);
    const groupLabel = groupToExport === 'all' ? 'All Groups' : groupToExport;

    const headers = [
      'S/N',
      'Attendance Status',
      'Member Name',
      'Phone Number',
      'WhatsApp Group',
      'Email',
      'Prayer Minutes',
      'Report Date'
    ];

    let sn = 1;
    const rows = reportData.sortedUnified.map(r => [
      `"${sn++}"`,
      `"${r.isPresent ? 'PRESENT' : 'ABSENT'}"`,
      `"${r.displayName.replace(/"/g, '""')}"`,
      `"${(r.phone || '').replace(/"/g, '""')}"`,
      `"${r.community.replace(/"/g, '""')}"`,
      `"${(r.email || '').replace(/"/g, '""')}"`,
      `"${r.isPresent ? (r.minutes || 60) : 0}"`,
      `"${selectedDate}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [
      `"LIGHTUP PRAYER ALTAR - DAILY ATTENDANCE REPORT"`,
      `"Date: ${selectedDate} (${formattedDateTitle})"`,
      `"Group: ${groupLabel}"`,
      `"Summary: ${reportData.presentCount} Present, ${reportData.absentCount} Absent (${reportData.attendanceRate}% Attendance Rate)"`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const sanitizedGroup = groupLabel.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `Attendance_Report_${sanitizedGroup}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate WhatsApp formatted report
  const generateWhatsAppReportText = (groupToGenerate = selectedGroup) => {
    const reportData = getProcessedRosterForGroup(groupToGenerate, selectedDate);
    const groupLabel = groupToGenerate === 'all' ? 'All Prayer Groups' : groupToGenerate;

    const lines: string[] = [];
    lines.push(`🔥 *LIGHTUP PRAYER ALTAR — DAILY ATTENDANCE REPORT*`);
    lines.push(`📅 *Date:* ${formattedDateTitle} (${selectedDate})`);
    lines.push(`👥 *Group:* ${groupLabel}`);
    lines.push(`📊 *Summary:* ${reportData.presentCount} Present | ${reportData.absentCount} Absent (${reportData.attendanceRate}% Attendance Rate)`);
    lines.push(`⏱️ *Total Members Registered:* ${reportData.total}`);
    lines.push(``);

    // 1. PRESENT MEMBERS (Alphabetical)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`✅ *PRESENT MEMBERS (${reportData.presentCount})* — Alphabetical:`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    if (reportData.presentList.length === 0) {
      lines.push(`_(No members marked present yet for this session)_`);
    } else {
      reportData.presentList.forEach((r, idx) => {
        const phoneStr = r.phone ? ` • ${r.phone}` : '';
        const minsStr = r.minutes > 0 ? ` (${r.minutes}m)` : '';
        lines.push(`${idx + 1}. *${r.displayName}*${phoneStr}${minsStr}`);
      });
    }

    lines.push(``);

    // 2. ABSENT MEMBERS (Alphabetical)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`❌ *ABSENT MEMBERS (${reportData.absentCount})* — Alphabetical:`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    if (reportData.absentList.length === 0) {
      lines.push(`_🎉 100% Attendance! All registered members were present!_`);
    } else {
      reportData.absentList.forEach((r, idx) => {
        const phoneStr = r.phone ? ` • ${r.phone}` : '';
        lines.push(`${idx + 1}. ${r.displayName}${phoneStr}`);
      });
    }

    lines.push(``);
    lines.push(`🕊️ _"They all joined together constantly in prayer..."_ — Acts 1:14`);
    lines.push(`🔗 *Join Prayer Altar:* https://lightupprayer.org/join`);

    return lines.join('\n');
  };

  const handleCopyWhatsAppReport = (groupToGenerate = selectedGroup) => {
    const text = generateWhatsAppReportText(groupToGenerate);
    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3500);
  };

  const handlePrint = () => {
    window.print();
  };

  // WhatsApp individual link
  const getWhatsAppDirectUrl = (phone: string, name: string, isPresent: boolean) => {
    let clean = phone.replace(/[^\d+]/g, '');
    let full = clean.startsWith('+') ? clean.substring(1) : clean;
    if (full.startsWith('0') && full.length === 11) {
      full = '234' + full.substring(1);
    }
    const message = isPresent 
      ? `Grace and peace ${name}! Thank you for standing in the gap at LightUp Prayer Altar today (${formattedDateTitle}). God bless you abundantly!`
      : `Beloved ${name}, we missed you at the LightUp Prayer Altar today (${formattedDateTitle}). Hope all is well with you? Praying for your strength and peace!`;
    return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
  };

  // Quick suggestions for inline member marker
  const quickMarkerSuggestions = useMemo(() => {
    if (!quickMarkerSearch.trim()) return [];
    const q = quickMarkerSearch.toLowerCase().trim();
    return members.filter(m => 
      (m.displayName || '').toLowerCase().includes(q) ||
      (m.phone || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [members, quickMarkerSearch]);

  // Selected quick marker member object
  const selectedQuickMember = useMemo(() => {
    return members.find(m => m.uid === quickMarkerMemberId) || null;
  }, [members, quickMarkerMemberId]);

  // Status of the quick marker member on selectedDate
  const selectedQuickMemberStatus = useMemo(() => {
    if (!selectedQuickMember) return null;
    return checkMemberPresentOnDate(selectedQuickMember, selectedDate);
  }, [selectedQuickMember, selectedDate]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-50 text-[#F26522] text-xs font-black uppercase tracking-wider">
              <Calendar size={14} />
              <span>Attendance Command Center</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1F3C]">
              Prayer Attendance & Marking Hub
            </h2>
            <p className="text-gray-500 text-sm max-w-2xl font-medium">
              Manage daily prayer attendance seamlessly: view group rosters organized with <strong>Present first</strong> and <strong>Absent follows</strong>, mark attendance manually via 1-click toggles, or use the dedicated Manual Station for error corrections.
            </p>
          </div>

          {/* Master Mode Switcher Tabs */}
          <div className="flex bg-gray-100 p-1.5 rounded-2xl shrink-0 border border-gray-200">
            <button
              onClick={() => setActiveSubTab('reports')}
              className={cn(
                "flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                activeSubTab === 'reports'
                  ? "bg-[#1A1F3C] text-white shadow-md shadow-[#1A1F3C]/20"
                  : "text-gray-600 hover:text-[#1A1F3C]"
              )}
            >
              <Users size={15} className={activeSubTab === 'reports' ? "text-[#F26522]" : "text-gray-400"} />
              <span>1. Reports & Roster</span>
            </button>

            <button
              onClick={() => setActiveSubTab('followup')}
              className={cn(
                "flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                activeSubTab === 'followup'
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                  : "text-gray-600 hover:text-[#1A1F3C]"
              )}
            >
              <HeartHandshake size={15} className={activeSubTab === 'followup' ? "text-white" : "text-rose-500"} />
              <span>2. Absent Follow-Up Hub</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                activeSubTab === 'followup' ? "bg-white text-rose-600" : "bg-rose-100 text-rose-700"
              )}>
                {activeReport.absentCount}
              </span>
            </button>
          </div>
        </div>

        {/* Success Banner if triggered */}
        {manualModalSuccessBanner && (
          <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs font-black text-emerald-800 uppercase tracking-wider animate-in fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{manualModalSuccessBanner}</span>
            </div>
            <button
              onClick={() => setManualModalSuccessBanner(null)}
              className="p-1 hover:bg-black/5 rounded-lg text-emerald-600 cursor-pointer"
            >
              <XCircle size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: REPORTS & ROSTER (Present First, Absent Next, 1-Click Toggle)  */}
      {/* ========================================================================= */}
      {activeSubTab === 'reports' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Quick Actions & Date Controls Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Date Navigators */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-gray-400 mr-2">Session Date:</span>
                
                <button
                  onClick={() => handleShiftDate(-1)}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 text-[#1A1F3C] rounded-xl transition-all cursor-pointer"
                  title="Previous Day"
                >
                  <ArrowLeft size={16} />
                </button>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2.5 bg-gray-50 hover:bg-white border border-gray-200 focus:border-[#F26522] rounded-xl text-sm font-bold text-[#1A1F3C] outline-none transition-all cursor-pointer"
                />

                <button
                  onClick={() => handleShiftDate(1)}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 text-[#1A1F3C] rounded-xl transition-all cursor-pointer"
                  title="Next Day"
                >
                  <ArrowRight size={16} />
                </button>

                {selectedDate !== todayStr && (
                  <button
                    onClick={() => setSelectedDate(todayStr)}
                    className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-[#F26522] rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Today
                  </button>
                )}
              </div>

              {/* Action Buttons: WhatsApp Copy, Download CSV, Print, Modal */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => {
                    setManualModalMember(null);
                    setIsManualModalOpen(true);
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                  title="Open Error Fix Modal"
                >
                  <UserCheck size={15} />
                  <span>Error Fix Dialog</span>
                </button>

                <button
                  onClick={() => handleCopyWhatsAppReport()}
                  className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  title="Copy WhatsApp formatted attendance report"
                >
                  {copiedSuccess ? <Check size={15} className="text-amber-300" /> : <MessageCircle size={15} />}
                  <span>{copiedSuccess ? 'Copied!' : 'Copy WhatsApp'}</span>
                </button>

                <button
                  onClick={() => handleExportCSV()}
                  className="flex items-center space-x-1.5 px-4 py-2.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-[#F26522]/20 transition-all cursor-pointer"
                >
                  <Download size={15} />
                  <span>Download CSV</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 text-[#1A1F3C] rounded-xl transition-all cursor-pointer"
                  title="Print"
                >
                  <Printer size={16} />
                </button>
              </div>
            </div>

            {/* Quick Date Pills */}
            {recordedDates.length > 1 && (
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none text-xs border-t border-gray-100 pt-3">
                <span className="text-[11px] font-bold text-gray-400 shrink-0">Recent Sessions:</span>
                {recordedDates.slice(0, 7).map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg font-bold shrink-0 transition-all cursor-pointer text-xs",
                      selectedDate === d
                        ? "bg-[#1A1F3C] text-white shadow-sm"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                    )}
                  >
                    {d === todayStr ? `Today (${d})` : d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ⚡ INSTANT 1-CLICK QUICK MANUAL MARKER BAR */}
          <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white rounded-3xl p-5 border border-blue-200/70 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-blue-900 font-black text-xs uppercase tracking-wider">
                  <Zap size={15} className="text-blue-600" />
                  <span>Instant Quick-Marker (Manual Attendance & System Fix)</span>
                </div>
                <p className="text-gray-500 text-xs">
                  Type a member's name or phone to mark them <strong>PRESENT</strong> or <strong>ABSENT</strong> on <strong>{selectedDate}</strong> without opening any dialogs.
                </p>
              </div>

              {/* Quick Input & Execution */}
              <div className="flex flex-wrap items-center gap-2 relative">
                <div className="relative min-w-[240px] sm:min-w-[280px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search name or phone number..."
                    value={quickMarkerSearch}
                    onChange={(e) => {
                      setQuickMarkerSearch(e.target.value);
                      setShowQuickMarkerDropdown(true);
                      if (!e.target.value) setQuickMarkerMemberId('');
                    }}
                    onFocus={() => setShowQuickMarkerDropdown(true)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-blue-200 focus:border-blue-600 rounded-xl text-xs font-semibold outline-none shadow-sm"
                  />

                  {/* Dropdown Suggestions */}
                  {showQuickMarkerDropdown && quickMarkerSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl z-40 max-h-56 overflow-y-auto divide-y divide-gray-100">
                      {quickMarkerSuggestions.map(m => {
                        const { isPresent } = checkMemberPresentOnDate(m, selectedDate);
                        return (
                          <div
                            key={m.uid}
                            onClick={() => {
                              setQuickMarkerMemberId(m.uid);
                              setQuickMarkerSearch(m.displayName || m.email || '');
                              setShowQuickMarkerDropdown(false);
                            }}
                            className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-[#1A1F3C] truncate">{m.displayName || m.email}</p>
                              <p className="text-[10px] text-gray-400 truncate">{m.phone || getMemberWhatsAppCommunity(m)}</p>
                            </div>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-black shrink-0",
                              isPresent ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            )}>
                              {isPresent ? 'PRESENT' : 'ABSENT'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Status buttons */}
                <button
                  onClick={() => handleQuickInlineMark('present')}
                  disabled={quickMarkerIsSubmitting || !quickMarkerMemberId}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm shadow-emerald-600/20"
                >
                  {quickMarkerIsSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>Mark Present</span>
                </button>

                <button
                  onClick={() => handleQuickInlineMark('absent')}
                  disabled={quickMarkerIsSubmitting || !quickMarkerMemberId}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm shadow-rose-600/20"
                >
                  <XCircle size={13} />
                  <span>Mark Absent</span>
                </button>
              </div>
            </div>

            {/* If a member is selected, show mini status badge */}
            {selectedQuickMember && selectedQuickMemberStatus && (
              <div className="mt-3 pt-3 border-t border-blue-200/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Selected:</span>
                  <strong className="text-blue-900">{selectedQuickMember.displayName}</strong>
                  <span className="text-gray-400">({selectedQuickMember.phone || 'No phone'})</span>
                  <span className="text-gray-400">• Current on {selectedDate}:</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black",
                    selectedQuickMemberStatus.isPresent ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  )}>
                    {selectedQuickMemberStatus.isPresent ? 'PRESENT' : 'ABSENT'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setQuickMarkerMemberId('');
                    setQuickMarkerSearch('');
                  }}
                  className="text-gray-400 hover:text-gray-600 text-[11px] font-bold"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>

          {/* Group Selector Bar (Tabs) */}
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-gray-400">
                <Users size={15} className="text-[#F26522]" />
                <span>Filter By Prayer Group:</span>
              </div>

              {/* View Switcher: Single Group vs All Groups Breakdown */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase tracking-wider text-gray-400">View:</span>
                <div className="inline-flex bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setViewMode('single')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      viewMode === 'single' ? "bg-white text-[#1A1F3C] shadow-sm font-black" : "text-gray-500 hover:text-[#1A1F3C]"
                    )}
                  >
                    Roster Table
                  </button>
                  <button
                    onClick={() => setViewMode('all-groups')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      viewMode === 'all-groups' ? "bg-white text-[#1A1F3C] shadow-sm font-black" : "text-gray-500 hover:text-[#1A1F3C]"
                    )}
                  >
                    All Groups Separately
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => setSelectedGroup('all')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2",
                  selectedGroup === 'all'
                    ? "bg-[#1A1F3C] text-white shadow-md shadow-[#1A1F3C]/20 font-black"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                )}
              >
                <span>All Groups ({members.length})</span>
              </button>

              {allCommunities.map(groupName => {
                const count = members.filter(m => getMemberWhatsAppCommunity(m).toLowerCase().trim() === groupName.toLowerCase().trim()).length;
                const isEsther = groupName.toLowerCase().includes('esther');
                return (
                  <button
                    key={groupName}
                    onClick={() => setSelectedGroup(groupName)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5",
                      selectedGroup === groupName
                        ? isEsther
                          ? "bg-purple-900 text-white shadow-md shadow-purple-900/30 font-black ring-2 ring-purple-400"
                          : "bg-[#F26522] text-white shadow-md shadow-[#F26522]/30 font-black"
                        : isEsther
                          ? "bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200/60"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    )}
                  >
                    {isEsther && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>}
                    <span>{groupName}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                      selectedGroup === groupName 
                        ? "bg-white/20 text-white" 
                        : isEsther ? "bg-purple-200/80 text-purple-900" : "bg-gray-200 text-gray-600"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}

              {members.some(m => getMemberWhatsAppCommunity(m) === 'Unassigned') && (
                <button
                  onClick={() => setSelectedGroup('Unassigned')}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    selectedGroup === 'Unassigned'
                      ? "bg-gray-800 text-white font-black"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-500"
                  )}
                >
                  Unassigned ({members.filter(m => getMemberWhatsAppCommunity(m) === 'Unassigned').length})
                </button>
              )}
            </div>
          </div>

          {/* VIEW MODE 1: SINGLE GROUP ROSTER TABLE */}
          {viewMode === 'single' && (
            <div className="space-y-6">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-gray-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">Total In Group</p>
                    <Users size={16} className="text-[#1A1F3C]" />
                  </div>
                  <p className="text-3xl font-black text-[#1A1F3C]">{activeReport.total}</p>
                  <p className="text-xs text-gray-400 font-medium">{selectedGroup === 'all' ? 'All Registered Members' : selectedGroup}</p>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200/70 p-5 rounded-2xl shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-emerald-700">
                    <p className="text-[10px] font-black uppercase tracking-widest">Present Today</p>
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-3xl font-black text-emerald-700">{activeReport.presentCount}</p>
                    <span className="text-xs font-bold text-emerald-600">({activeReport.attendanceRate}%)</span>
                  </div>
                  <p className="text-xs text-emerald-600/80 font-medium">Sorted alphabetically first</p>
                </div>

                <div className="bg-rose-50/70 border border-rose-200/70 p-5 rounded-2xl shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-rose-700">
                    <p className="text-[10px] font-black uppercase tracking-widest">Absent Today</p>
                    <XCircle size={18} className="text-rose-600" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-3xl font-black text-rose-700">{activeReport.absentCount}</p>
                    <span className="text-xs font-bold text-rose-600">
                      ({activeReport.total > 0 ? Math.round((activeReport.absentCount / activeReport.total) * 100) : 0}%)
                    </span>
                  </div>
                  <p className="text-xs text-rose-600/80 font-medium pb-1">Follows present alphabetically</p>
                  
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('followup')}
                    className="w-full mt-2 py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all shadow-sm cursor-pointer"
                    title="Open Absent Follow-Up Hub to contact all absent members"
                  >
                    <HeartHandshake size={13} />
                    <span>Follow Up All ({activeReport.absentCount})</span>
                  </button>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                  <div className="flex justify-between items-center text-gray-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">Attendance Rate</p>
                    <Flame size={16} className="text-[#F26522]" />
                  </div>
                  <p className="text-3xl font-black text-[#F26522]">{activeReport.attendanceRate}%</p>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-[#F26522] h-full transition-all duration-500 rounded-full"
                      style={{ width: `${Math.min(100, activeReport.attendanceRate)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Roster Controls: Search & Status Filters */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Filter by name, phone number, email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#F26522] transition-colors"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-400 mr-1">Filter:</span>
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        statusFilter === 'all'
                          ? "bg-[#1A1F3C] text-white font-black"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                      )}
                    >
                      All ({activeReport.total})
                    </button>
                    <button
                      onClick={() => setStatusFilter('present')}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1",
                        statusFilter === 'present'
                          ? "bg-emerald-600 text-white font-black"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                      )}
                    >
                      <CheckCircle2 size={13} />
                      <span>Present ({activeReport.presentCount})</span>
                    </button>
                    <button
                      onClick={() => setStatusFilter('absent')}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1",
                        statusFilter === 'absent'
                          ? "bg-rose-600 text-white font-black"
                          : "bg-rose-50 hover:bg-rose-100 text-rose-700"
                      )}
                    >
                      <XCircle size={13} />
                      <span>Absent ({activeReport.absentCount})</span>
                    </button>
                  </div>
                </div>

                {/* 📌 STICKY BATCH SELECTION ACTION BAR */}
                {selectedRowUids.length > 0 && (
                  <div className="bg-[#1A1F3C] text-white p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl animate-in slide-in-from-top-2 border border-white/10">
                    <div className="flex items-center space-x-2 text-xs font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                      <span><strong>{selectedRowUids.length}</strong> members selected for batch attendance</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleBatchToggleAttendance(selectedRowUids, 'present')}
                        disabled={isBatchUpdating}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow disabled:opacity-50"
                      >
                        {isBatchUpdating ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        <span>Mark All Present</span>
                      </button>
                      <button
                        onClick={() => handleBatchToggleAttendance(selectedRowUids, 'absent')}
                        disabled={isBatchUpdating}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow disabled:opacity-50"
                      >
                        {isBatchUpdating ? <RefreshCw size={13} className="animate-spin" /> : <XCircle size={13} />}
                        <span>Mark All Absent</span>
                      </button>
                      <button
                        onClick={() => setSelectedRowUids([])}
                        className="px-3 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Sorting Notice Banner */}
                <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center space-x-2">
                    <Sparkles size={16} className="text-amber-600 shrink-0" />
                    <span>
                      <strong>Strict Hierarchy:</strong> <strong>Present members first</strong> (Alphabetical A–Z), followed by <strong>Absent members</strong> (Alphabetical A–Z).
                    </span>
                  </div>
                  <span className="font-bold text-amber-800 shrink-0 hidden md:inline">
                    {displayedRows.length} displayed
                  </span>
                </div>

                {/* View Format Switcher & Horizontal Scroll Navigation Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/80 p-3 rounded-2xl border border-gray-200">
                  {/* View format toggle: Full Table vs Compact Cards */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-500">Layout:</span>
                    <div className="inline-flex bg-white p-1 rounded-xl border border-gray-200 shadow-xs">
                      <button
                        onClick={() => setDisplayFormat('table')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5",
                          displayFormat === 'table' ? "bg-[#1A1F3C] text-white shadow font-black" : "text-gray-600 hover:text-[#1A1F3C]"
                        )}
                      >
                        <TableIcon size={14} />
                        <span>Full Table View</span>
                      </button>
                      <button
                        onClick={() => setDisplayFormat('cards')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5",
                          displayFormat === 'cards' ? "bg-[#F26522] text-white shadow font-black" : "text-gray-600 hover:text-[#1A1F3C]"
                        )}
                      >
                        <LayoutGrid size={14} />
                        <span>Split-Screen Cards View</span>
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scroll Helper Buttons (for Table Mode) */}
                  {displayFormat === 'table' && (
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-gray-500 hidden sm:inline">
                        ↔ Table Columns:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleScrollTable('left')}
                        className="px-3 py-1.5 bg-white hover:bg-gray-100 text-[#1A1F3C] border border-gray-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer shadow-xs active:scale-95"
                        title="Scroll left"
                      >
                        <ChevronLeft size={14} />
                        <span>Scroll Left</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScrollTable('right')}
                        className="px-3 py-1.5 bg-[#1A1F3C] hover:bg-[#282E5C] text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer shadow-xs active:scale-95"
                        title="Scroll right to see all columns"
                      >
                        <span>Scroll Right</span>
                        <ChevronRight size={14} className="text-[#F26522]" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 1. TABLE DISPLAY FORMAT */}
                {displayFormat === 'table' && (
                  <div 
                    ref={tableScrollRef}
                    className="overflow-x-auto max-h-[620px] overflow-y-auto rounded-2xl border border-gray-200 shadow-xs bg-white custom-scrollbar relative"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    <table className="min-w-[1150px] w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600 font-black uppercase tracking-wider border-b border-gray-200">
                          <th className="sticky left-0 top-0 z-30 bg-gray-50 py-3.5 px-3 text-center w-12 min-w-[48px] max-w-[48px] whitespace-nowrap border-b border-gray-200">
                            <input
                              type="checkbox"
                              checked={displayedRows.length > 0 && selectedRowUids.length === displayedRows.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRowUids(displayedRows.map(r => r.member.uid).filter(Boolean));
                                } else {
                                  setSelectedRowUids([]);
                                }
                              }}
                              className="w-4 h-4 rounded text-[#F26522] focus:ring-[#F26522] cursor-pointer"
                              title="Select all"
                            />
                          </th>
                          <th className="sticky left-[48px] top-0 z-30 bg-gray-50 py-3.5 px-3 text-center w-12 min-w-[48px] max-w-[48px] whitespace-nowrap border-b border-gray-200">
                            S/N
                          </th>
                          <th className="sticky left-[96px] top-0 z-30 bg-gray-50 py-3.5 px-4 whitespace-nowrap min-w-[120px] max-w-[120px] border-b border-gray-200">
                            Status
                          </th>
                          <th className="sticky left-[216px] top-0 z-30 bg-gray-50 py-3.5 px-4 whitespace-nowrap min-w-[220px] border-r border-b border-gray-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                            Member Name
                          </th>
                          <th className="sticky top-0 z-20 bg-gray-50 py-3.5 px-4 whitespace-nowrap min-w-[150px] border-b border-gray-200">Phone Number</th>
                          <th className="sticky top-0 z-20 bg-gray-50 py-3.5 px-4 whitespace-nowrap min-w-[160px] border-b border-gray-200">WhatsApp Group</th>
                          <th className="sticky top-0 z-20 bg-gray-50 py-3.5 px-4 whitespace-nowrap min-w-[180px] border-b border-gray-200">Email Address</th>
                          <th className="sticky top-0 z-20 bg-gray-50 py-3.5 px-3 text-center whitespace-nowrap min-w-[120px] border-b border-gray-200">Prayer Duration</th>
                          <th className="sticky top-0 z-20 bg-gray-50 py-3.5 px-4 text-center whitespace-nowrap min-w-[210px] border-b border-gray-200">Manual Correction (Present / Absent)</th>
                          <th className="sticky top-0 z-20 bg-gray-50 py-3.5 px-3 text-center whitespace-nowrap min-w-[110px] border-b border-gray-200">Contact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium">
                        {displayedRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-12 text-center text-gray-400">
                              <Users size={36} className="mx-auto mb-2 text-gray-300" />
                              <p className="font-bold text-sm">No members found matching your search.</p>
                            </td>
                          </tr>
                        ) : (
                          displayedRows.map((row, idx) => {
                            const isUpdating = isUpdatingMemberId === row.member.uid;
                            const isSelected = selectedRowUids.includes(row.member.uid);
                            const stickyBg = isSelected ? "bg-amber-50" : (row.isPresent ? "bg-emerald-50/90" : "bg-white");

                            return (
                              <tr 
                                key={row.member.uid || `${row.displayName}-${idx}`}
                                className={cn(
                                  "hover:bg-gray-50/80 transition-colors",
                                  isSelected ? "bg-amber-50/40" : (row.isPresent ? "bg-emerald-50/20" : "bg-white")
                                )}
                              >
                                {/* Row Checkbox - Sticky Column 1 */}
                                <td className={cn("sticky left-0 z-10 py-3.5 px-3 text-center w-12 min-w-[48px] max-w-[48px] whitespace-nowrap", stickyBg)}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const uid = row.member.uid;
                                      if (!uid) return;
                                      if (e.target.checked) {
                                        setSelectedRowUids(prev => [...prev, uid]);
                                      } else {
                                        setSelectedRowUids(prev => prev.filter(id => id !== uid));
                                      }
                                    }}
                                    className="w-4 h-4 rounded text-[#F26522] focus:ring-[#F26522] cursor-pointer"
                                  />
                                </td>

                                {/* S/N - Sticky Column 2 */}
                                <td className={cn("sticky left-[48px] z-10 py-3.5 px-3 text-center font-bold text-gray-400 w-12 min-w-[48px] max-w-[48px] whitespace-nowrap", stickyBg)}>
                                  {idx + 1}
                                </td>

                                {/* Attendance Status Badge - Sticky Column 3 */}
                                <td className={cn("sticky left-[96px] z-10 py-3.5 px-4 whitespace-nowrap min-w-[120px] max-w-[120px]", stickyBg)}>
                                  {row.isPresent ? (
                                    <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                      <span>PRESENT</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                      <XCircle size={13} className="text-rose-600 shrink-0" />
                                      <span>ABSENT</span>
                                    </span>
                                  )}
                                </td>

                                {/* Member Name - Sticky Column 4 */}
                                <td className={cn("sticky left-[216px] z-10 py-3.5 px-4 whitespace-nowrap min-w-[220px] border-r border-gray-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]", stickyBg)}>
                                  <div className="flex items-start space-x-2.5">
                                    <div className={cn(
                                      "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5",
                                      row.isPresent ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-600"
                                    )}>
                                      {row.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="space-y-1">
                                      <span className="font-bold text-[#1A1F3C] text-sm block truncate max-w-[170px]" title={row.displayName}>
                                        {row.displayName}
                                      </span>
                                      {/* Present and Absent buttons directly against each name */}
                                      <div className="flex items-center space-x-1 pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleAttendance(row, 'present')}
                                          disabled={isUpdating}
                                          className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50 shadow-xs",
                                            row.isPresent
                                              ? "bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500 font-black"
                                              : "bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 font-bold"
                                          )}
                                          title={row.isPresent ? "Currently marked Present" : "Click to mark Present"}
                                        >
                                          <CheckCircle2 size={10} />
                                          <span>Present</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleAttendance(row, 'absent')}
                                          disabled={isUpdating}
                                          className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50 shadow-xs",
                                            !row.isPresent
                                              ? "bg-rose-600 text-white shadow-xs ring-1 ring-rose-500 font-black"
                                              : "bg-white text-rose-800 border border-rose-300 hover:bg-rose-50 hover:text-rose-900 font-bold"
                                          )}
                                          title={!row.isPresent ? "Currently marked Absent" : "Click to mark Absent & reverse credit"}
                                        >
                                          <XCircle size={10} />
                                          <span>Absent</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Phone */}
                                <td className="py-3.5 px-4 font-mono font-bold text-gray-700 whitespace-nowrap">
                                  {row.phone ? (
                                    <span className="text-[#1A1F3C] bg-gray-100 px-2.5 py-1 rounded-lg text-xs tracking-tight">
                                      {row.phone}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 italic">No phone</span>
                                  )}
                                </td>

                                {/* Community */}
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className={cn(
                                    "inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold",
                                    row.community.toLowerCase().includes('esther')
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-gray-100 text-gray-700"
                                    )}>
                                    {row.community}
                                  </span>
                                </td>

                                {/* Email */}
                                <td className="py-3.5 px-4 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                                  {row.email || '—'}
                                </td>

                                {/* Duration & Recorded status */}
                                <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                  {row.isPresent ? (
                                    <div className="space-y-0.5">
                                      <span className="font-black text-[#F26522] bg-orange-50 px-2.5 py-0.5 rounded text-xs inline-block">
                                        {row.minutes > 0 ? `${row.minutes} mins` : 'Attended'}
                                      </span>
                                      <span className="text-[9px] text-gray-400 font-bold block">
                                        ✓ Recorded
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 font-bold">—</span>
                                  )}
                                </td>

                                {/* 1-Click Toggle Action: Present & Absent Buttons */}
                                <td className="py-3.5 px-4 text-center whitespace-nowrap min-w-[210px]">
                                  <div className="flex items-center justify-center space-x-1.5">
                                    <div className="inline-flex items-center p-1 bg-gray-200/80 rounded-xl space-x-1.5 border border-gray-300 shadow-xs">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAttendance(row, 'present')}
                                        disabled={isUpdating}
                                        className={cn(
                                          "px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-xs",
                                          row.isPresent
                                            ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500 font-black"
                                            : "bg-white text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 border border-emerald-300 font-bold"
                                        )}
                                        title={row.isPresent ? "Currently marked Present" : "Click to mark Present & credit attendance"}
                                      >
                                        {isUpdating && !row.isPresent ? (
                                          <RefreshCw size={12} className="animate-spin" />
                                        ) : (
                                          <CheckCircle2 size={13} className={row.isPresent ? "text-white" : "text-emerald-600"} />
                                        )}
                                        <span>Present</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleAttendance(row, 'absent')}
                                        disabled={isUpdating}
                                        className={cn(
                                          "px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-xs",
                                          !row.isPresent
                                            ? "bg-rose-600 text-white shadow-xs ring-2 ring-rose-500 font-black"
                                            : "bg-white text-rose-800 hover:bg-rose-50 hover:text-rose-900 border border-rose-300 font-bold"
                                        )}
                                        title={!row.isPresent ? "Currently marked Absent" : "Click to mark Absent & reverse credit error"}
                                      >
                                        {isUpdating && row.isPresent ? (
                                          <RefreshCw size={12} className="animate-spin" />
                                        ) : (
                                          <XCircle size={13} className={!row.isPresent ? "text-white" : "text-rose-600"} />
                                        )}
                                        <span>Absent</span>
                                      </button>
                                    </div>

                                    <button
                                      onClick={() => {
                                        setManualModalMember(row.member);
                                        setIsManualModalOpen(true);
                                      }}
                                      className="p-1.5 bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                                      title="Open Error Fix Modal & Custom Duration"
                                    >
                                      <UserCheck size={13} />
                                    </button>
                                  </div>
                                </td>

                                {/* Contact */}
                                <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                  {row.phone ? (
                                    <div className="flex items-center justify-center space-x-1">
                                      <a
                                        href={getWhatsAppDirectUrl(row.phone, row.displayName, row.isPresent)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                                        title="Send WhatsApp message"
                                      >
                                        <MessageCircle size={14} />
                                      </a>
                                      <a
                                        href={`tel:${row.phone.replace(/\s+/g, '')}`}
                                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                                        title="Call member"
                                      >
                                        <Phone size={14} />
                                      </a>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 2. RESPONSIVE CARDS DISPLAY FORMAT (ZERO HORIZONTAL SCROLLING REQUIRED) */}
                {displayFormat === 'cards' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {displayedRows.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-2xl border border-gray-200">
                        <Users size={36} className="mx-auto mb-2 text-gray-300" />
                        <p className="font-bold text-sm">No members found matching your search.</p>
                      </div>
                    ) : (
                      displayedRows.map((row, idx) => {
                        const isUpdating = isUpdatingMemberId === row.member.uid;
                        const isSelected = selectedRowUids.includes(row.member.uid);
                        return (
                          <div
                            key={row.member.uid || `${row.displayName}-${idx}`}
                            className={cn(
                              "p-4 rounded-2xl border transition-all space-y-3",
                              row.isPresent 
                                ? "bg-emerald-50/25 border-emerald-200 hover:border-emerald-300" 
                                : "bg-white border-gray-200 hover:border-gray-300",
                              isSelected && "ring-2 ring-[#F26522]"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const uid = row.member.uid;
                                    if (!uid) return;
                                    if (e.target.checked) setSelectedRowUids(prev => [...prev, uid]);
                                    else setSelectedRowUids(prev => prev.filter(id => id !== uid));
                                  }}
                                  className="w-4 h-4 rounded text-[#F26522] focus:ring-[#F26522] cursor-pointer"
                                />
                                <span className="text-[11px] font-bold text-gray-400">#{idx + 1}</span>
                                <span className={cn(
                                  "inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black",
                                  row.isPresent 
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                                    : "bg-rose-100 text-rose-800 border border-rose-300"
                                )}>
                                  {row.isPresent ? <CheckCircle2 size={12} className="text-emerald-600" /> : <XCircle size={12} className="text-rose-600" />}
                                  <span>{row.isPresent ? 'PRESENT' : 'ABSENT'}</span>
                                </span>
                              </div>

                              {row.isPresent && (
                                <span className="text-[11px] font-black text-[#F26522] bg-orange-50 px-2 py-0.5 rounded">
                                  {row.minutes > 0 ? `${row.minutes} mins` : 'Attended'}
                                </span>
                              )}
                            </div>

                            {/* Member Details */}
                            <div className="flex items-center space-x-3">
                              <div className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                                row.isPresent ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-600"
                              )}>
                                {row.displayName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-[#1A1F3C] text-sm truncate">{row.displayName}</h4>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 font-mono mt-0.5">
                                  <span>{row.phone || 'No phone'}</span>
                                  <span>•</span>
                                  <span className="font-sans font-bold text-gray-600">{row.community}</span>
                                </div>
                              </div>
                            </div>

                            {/* Actions: Present and Absent buttons */}
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-1.5 flex-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAttendance(row, 'present')}
                                  disabled={isUpdating}
                                  className={cn(
                                    "flex-1 py-2 px-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50",
                                    row.isPresent
                                      ? "bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500"
                                      : "bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-transparent"
                                  )}
                                  title={row.isPresent ? "Currently marked Present" : "Click to mark Present"}
                                >
                                  {isUpdating && !row.isPresent ? (
                                    <RefreshCw size={11} className="animate-spin" />
                                  ) : (
                                    <CheckCircle2 size={12} className={row.isPresent ? "text-white" : "text-emerald-600"} />
                                  )}
                                  <span>Present</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleAttendance(row, 'absent')}
                                  disabled={isUpdating}
                                  className={cn(
                                    "flex-1 py-2 px-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50",
                                    !row.isPresent
                                      ? "bg-rose-600 text-white shadow-xs ring-1 ring-rose-500"
                                      : "bg-gray-100 text-gray-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-transparent"
                                  )}
                                  title={!row.isPresent ? "Currently marked Absent" : "Click to mark Absent"}
                                >
                                  {isUpdating && row.isPresent ? (
                                    <RefreshCw size={11} className="animate-spin" />
                                  ) : (
                                    <XCircle size={12} className={!row.isPresent ? "text-white" : "text-rose-600"} />
                                  )}
                                  <span>Absent</span>
                                </button>
                              </div>

                              <button
                                onClick={() => {
                                  setManualModalMember(row.member);
                                  setIsManualModalOpen(true);
                                }}
                                className="p-2 bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-xl transition-colors cursor-pointer shrink-0"
                                title="Error Correction / Manual Audit"
                              >
                                <UserCheck size={15} />
                              </button>

                              {row.phone && (
                                <a
                                  href={getWhatsAppDirectUrl(row.phone, row.displayName, row.isPresent)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors"
                                  title="WhatsApp Message"
                                >
                                  <MessageCircle size={15} />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW MODE 2: ALL GROUPS SEPARATE CARDS */}
          {viewMode === 'all-groups' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-[#1A1F3C]">
                    All Prayer Groups — Separate Daily Reports
                  </h3>
                  <p className="text-gray-500 text-xs font-medium">
                    Detailed independent report for each prayer group for {formattedDateTitle}. Each group lists all its present members first, followed by absent members alphabetically.
                  </p>
                </div>
                <button
                  onClick={() => handleExportCSV('all')}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer"
                >
                  <Download size={15} />
                  <span>Export Master Roster CSV</span>
                </button>
              </div>

              {allCommunities.map(groupName => {
                const report = getProcessedRosterForGroup(groupName, selectedDate);
                if (report.total === 0) return null;

                return (
                  <div 
                    key={groupName}
                    className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-lg font-black text-[#1A1F3C]">{groupName}</h4>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-100 text-[#F26522]">
                            {report.total} Members
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 font-medium">Report for {formattedDateTitle}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center space-x-4 bg-gray-50 px-4 py-2 rounded-xl text-xs">
                          <div>
                            <span className="text-gray-400 font-bold block text-[10px] uppercase">Present</span>
                            <span className="font-black text-emerald-700 text-sm">{report.presentCount}</span>
                          </div>
                          <div className="h-6 w-px bg-gray-200"></div>
                          <div>
                            <span className="text-gray-400 font-bold block text-[10px] uppercase">Absent</span>
                            <span className="font-black text-rose-700 text-sm">{report.absentCount}</span>
                          </div>
                          <div className="h-6 w-px bg-gray-200"></div>
                          <div>
                            <span className="text-gray-400 font-bold block text-[10px] uppercase">Rate</span>
                            <span className="font-black text-[#F26522] text-sm">{report.attendanceRate}%</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleCopyWhatsAppReport(groupName)}
                          className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          <MessageCircle size={14} />
                          <span>Copy WhatsApp</span>
                        </button>

                        <button
                          onClick={() => handleExportCSV(groupName)}
                          className="flex items-center space-x-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-[#1A1F3C] rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          <Download size={14} />
                          <span>CSV</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Present Column */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center space-x-1.5">
                            <CheckCircle2 size={15} className="text-emerald-600" />
                            <span>Present Members ({report.presentCount}) — A to Z</span>
                          </span>
                        </div>

                        {report.presentList.length === 0 ? (
                          <p className="text-xs text-gray-400 italic py-3 text-center">No members recorded as present for this day.</p>
                        ) : (
                          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                            {report.presentList.map((r, idx) => (
                              <div
                                key={r.member.uid || idx}
                                className="p-2.5 bg-emerald-50/40 rounded-xl border border-emerald-100/60 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center space-x-2 min-w-0">
                                  <span className="font-bold text-emerald-700 text-[11px] w-6 shrink-0">{idx + 1}.</span>
                                  <div className="truncate">
                                    <span className="font-bold text-[#1A1F3C] block truncate">{r.displayName}</span>
                                    {r.phone && <span className="text-gray-500 font-mono text-[11px] block">{r.phone}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1 shrink-0">
                                  <button
                                    onClick={() => handleToggleAttendance(r, 'present')}
                                    className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white shadow-2xs"
                                    title="Currently Present"
                                  >
                                    Present
                                  </button>
                                  <button
                                    onClick={() => handleToggleAttendance(r, 'absent')}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-white hover:bg-rose-50 text-gray-500 hover:text-rose-700 border border-gray-200 transition-colors"
                                    title="Click to mark Absent"
                                  >
                                    Absent
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Absent Column */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-rose-100">
                          <span className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center space-x-1.5">
                            <XCircle size={15} className="text-rose-600" />
                            <span>Absent Members ({report.absentCount}) — A to Z</span>
                          </span>
                        </div>

                        {report.absentList.length === 0 ? (
                          <p className="text-xs text-emerald-600 font-bold py-3 text-center">
                            🎉 Perfect attendance! All members present!
                          </p>
                        ) : (
                          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                            {report.absentList.map((r, idx) => (
                              <div
                                key={r.member.uid || idx}
                                className="p-2.5 bg-rose-50/30 rounded-xl border border-rose-100/60 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center space-x-2 min-w-0">
                                  <span className="font-bold text-rose-700 text-[11px] w-6 shrink-0">{idx + 1}.</span>
                                  <div className="truncate">
                                    <span className="font-bold text-[#1A1F3C] block truncate">{r.displayName}</span>
                                    {r.phone && <span className="text-gray-500 font-mono text-[11px] block">{r.phone}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1 shrink-0">
                                  <button
                                    onClick={() => handleToggleAttendance(r, 'present')}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-white hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 border border-gray-200 transition-colors"
                                    title="Click to mark Present"
                                  >
                                    Present
                                  </button>
                                  <button
                                    onClick={() => handleToggleAttendance(r, 'absent')}
                                    className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white shadow-2xs"
                                    title="Currently Absent"
                                  >
                                    Absent
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: ABSENT MEMBERS PASTORAL FOLLOW-UP HUB                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'followup' && (
        <div className="animate-in fade-in">
          <AbsentFollowUpHub
            members={members}
            selectedDate={selectedDate}
            onSelectDate={(newDate) => setSelectedDate(newDate)}
            onToggleAttendance={handleToggleAttendance}
            onRefreshMembers={onRefreshMembers}
            onBackToRoster={() => setActiveSubTab('reports')}
            recordedDates={recordedDates}
          />
        </div>
      )}

      {/* Manual Attendance & System Error Correction Deep Modal */}
      {isManualModalOpen && (
        <ManualAttendanceModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          members={members}
          initialMember={manualModalMember}
          initialDate={selectedDate}
          onSuccess={(msg) => {
            setManualModalSuccessBanner(msg);
            setIsManualModalOpen(false);
            if (onRefreshMembers) onRefreshMembers();
          }}
        />
      )}
    </div>
  );
}
