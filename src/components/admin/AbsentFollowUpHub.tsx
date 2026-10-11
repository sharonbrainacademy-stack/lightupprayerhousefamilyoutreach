/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, MessageCircle, Phone, Mail, CheckCircle2, 
  XCircle, Search, Filter, Copy, Check, ExternalLink, 
  RefreshCw, HeartHandshake, ShieldAlert, Sparkles, 
  Clock, Calendar, ArrowLeft, ArrowRight, Share2, 
  Download, Edit3, Send, AlertTriangle, UserCheck, 
  Smile, Flame, Shield, HelpCircle, ChevronDown
} from 'lucide-react';
import { UserProfile } from '../../types';
import { cn } from '../../lib/utils';
import { getMemberWhatsAppCommunity } from '../../lib/whatsapp';
import { 
  MemberFollowUpRecord, 
  FollowUpStatus, 
  FollowUpChannel, 
  DEFAULT_FOLLOW_UP_TEMPLATES, 
  FollowUpTemplate,
  subscribeDateFollowUps, 
  saveFollowUpRecord, 
  batchSaveFollowUps, 
  formatFollowUpMessage, 
  formatPhoneForWhatsApp 
} from '../../lib/followup';

interface AbsentFollowUpHubProps {
  members: UserProfile[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onToggleAttendance: (row: any, forceStatus?: 'present' | 'absent') => Promise<void>;
  onRefreshMembers?: () => void;
  onBackToRoster?: () => void;
  recordedDates?: string[];
}

export default function AbsentFollowUpHub({
  members,
  selectedDate,
  onSelectDate,
  onToggleAttendance,
  onRefreshMembers,
  onBackToRoster,
  recordedDates = []
}: AbsentFollowUpHubProps) {
  // Filters
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FollowUpStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Follow-up records state (synced with Firestore / local cache)
  const [followUpRecords, setFollowUpRecords] = useState<Record<string, MemberFollowUpRecord>>({});
  const [isSavingRecord, setIsSavingRecord] = useState<string | null>(null);

  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('warm-checkin');
  const [customTemplateText, setCustomTemplateText] = useState<string>('');
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);

  // Notes editing state per member
  const [editingNotesUid, setEditingNotesUid] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  // Copy success feedback
  const [copiedBroadcastSuccess, setCopiedBroadcastSuccess] = useState(false);
  const [copiedDigestSuccess, setCopiedDigestSuccess] = useState(false);
  const [copiedIndividualUid, setCopiedIndividualUid] = useState<string | null>(null);
  const [batchActionRunning, setBatchActionRunning] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Subscribe to real-time followups for this date
  useEffect(() => {
    const unsubscribe = subscribeDateFollowUps(selectedDate, (records) => {
      setFollowUpRecords(records);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  // Active template object
  const activeTemplate = useMemo(() => {
    if (selectedTemplateId === 'custom') {
      return {
        id: 'custom',
        title: 'Custom Care Message',
        description: 'Your personalized message for absent members',
        message: customTemplateText || DEFAULT_FOLLOW_UP_TEMPLATES[0].message
      };
    }
    return DEFAULT_FOLLOW_UP_TEMPLATES.find(t => t.id === selectedTemplateId) || DEFAULT_FOLLOW_UP_TEMPLATES[0];
  }, [selectedTemplateId, customTemplateText]);

  // Formatted date string
  const formattedDateTitle = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {
      // fallback
    }
    return selectedDate;
  }, [selectedDate]);

  // Check if member is present on selectedDate
  const isMemberPresentOnDate = (m: UserProfile): boolean => {
    const daysList = Array.isArray(m.attendanceDaysList) ? m.attendanceDaysList : [];
    const hasInDaysList = daysList.includes(selectedDate);
    const hasLastAttended = m.lastAttendedDate === selectedDate;
    const recordedMins = m.dailyMinutes?.[selectedDate] || 0;
    return Boolean(hasInDaysList || hasLastAttended || recordedMins > 0);
  };

  // Identify all absent members for selectedDate
  const allAbsentMembers = useMemo(() => {
    return members
      .filter(m => !isMemberPresentOnDate(m))
      .map(m => {
        const comm = getMemberWhatsAppCommunity(m);
        const record = followUpRecords[m.uid];
        const status: FollowUpStatus = record?.status || 'pending';
        return {
          member: m,
          uid: m.uid,
          displayName: (m.displayName || '').trim() || m.email || 'Unnamed Member',
          phone: m.phone || m.whatsappGroup || '',
          email: m.email || '',
          community: comm,
          status,
          record,
          lastAttendedDate: m.lastAttendedDate || null,
          totalAttendance: m.attendanceCount || (m.attendanceDaysList?.length) || 0
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
  }, [members, selectedDate, followUpRecords]);

  // Filtered absent members by group, status, and search
  const filteredAbsentList = useMemo(() => {
    return allAbsentMembers.filter(item => {
      // Group filter
      if (selectedGroup !== 'all') {
        if (selectedGroup === 'Unassigned') {
          if (item.community !== 'Unassigned') return false;
        } else if (item.community.toLowerCase().trim() !== selectedGroup.toLowerCase().trim()) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (item.status !== statusFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.displayName.toLowerCase().includes(q);
        const matchesPhone = item.phone.toLowerCase().includes(q);
        const matchesEmail = item.email.toLowerCase().includes(q);
        const matchesGroup = item.community.toLowerCase().includes(q);
        const matchesNotes = (item.record?.notes || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesEmail && !matchesGroup && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [allAbsentMembers, selectedGroup, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalAbsent = allAbsentMembers.length;
    const contacted = allAbsentMembers.filter(a => a.status === 'contacted').length;
    const excused = allAbsentMembers.filter(a => a.status === 'excused').length;
    const pastoralCare = allAbsentMembers.filter(a => a.status === 'pastoral_care').length;
    const noResponse = allAbsentMembers.filter(a => a.status === 'no_response').length;
    const pending = allAbsentMembers.filter(a => a.status === 'pending').length;
    const completed = contacted + excused;
    const completionRate = totalAbsent > 0 ? Math.round((completed / totalAbsent) * 100) : 100;

    return {
      totalAbsent,
      contacted,
      excused,
      pastoralCare,
      noResponse,
      pending,
      completed,
      completionRate
    };
  }, [allAbsentMembers]);

  // All community options
  const allCommunities = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => {
      const comm = getMemberWhatsAppCommunity(m);
      if (comm && comm !== 'Unassigned') set.add(comm);
    });
    return Array.from(set).sort();
  }, [members]);

  // Update a single member's status
  const handleUpdateStatus = async (
    item: typeof allAbsentMembers[0], 
    newStatus: FollowUpStatus, 
    channel?: FollowUpChannel
  ) => {
    setIsSavingRecord(item.uid);
    try {
      await saveFollowUpRecord({
        dateStr: selectedDate,
        memberUid: item.uid,
        memberName: item.displayName,
        memberPhone: item.phone,
        memberEmail: item.email,
        groupName: item.community,
        status: newStatus,
        channel: channel || item.record?.channel || 'whatsapp',
        notes: item.record?.notes || ''
      });
      setBannerNotice(`Updated follow-up status for ${item.displayName} to "${newStatus.replace('_', ' ').toUpperCase()}".`);
      setTimeout(() => setBannerNotice(null), 3500);
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsSavingRecord(null);
    }
  };

  // Save notes for a member
  const handleSaveNotes = async (item: typeof allAbsentMembers[0]) => {
    setIsSavingRecord(item.uid);
    try {
      await saveFollowUpRecord({
        dateStr: selectedDate,
        memberUid: item.uid,
        memberName: item.displayName,
        memberPhone: item.phone,
        memberEmail: item.email,
        groupName: item.community,
        status: item.status,
        notes: notesDraft
      });
      setEditingNotesUid(null);
      setBannerNotice(`Saved follow-up note for ${item.displayName}.`);
      setTimeout(() => setBannerNotice(null), 3000);
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setIsSavingRecord(null);
    }
  };

  // Launch WhatsApp with auto-mark
  const handleLaunchWhatsApp = async (item: typeof allAbsentMembers[0]) => {
    if (!item.phone) return;
    const cleanPhone = formatPhoneForWhatsApp(item.phone);
    const message = formatFollowUpMessage(activeTemplate.message, item.displayName, selectedDate);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    // Auto mark as contacted
    await handleUpdateStatus(item, 'contacted', 'whatsapp');

    // Open WhatsApp
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Copy individual message text
  const handleCopyMessageForMember = (item: typeof allAbsentMembers[0]) => {
    const message = formatFollowUpMessage(activeTemplate.message, item.displayName, selectedDate);
    navigator.clipboard.writeText(message);
    setCopiedIndividualUid(item.uid);
    setTimeout(() => setCopiedIndividualUid(null), 2500);
  };

  // Batch: Mark all filtered as Contacted
  const handleBatchMarkFilteredContacted = async () => {
    if (filteredAbsentList.length === 0) return;
    setBatchActionRunning(true);
    try {
      await batchSaveFollowUps(
        selectedDate,
        filteredAbsentList.map(a => ({
          memberUid: a.uid,
          memberName: a.displayName,
          memberPhone: a.phone,
          memberEmail: a.email,
          groupName: a.community
        })),
        'contacted',
        'whatsapp',
        'Batch contacted via pastoral follow-up'
      );
      setBannerNotice(`Successfully marked ${filteredAbsentList.length} members as Contacted!`);
      setTimeout(() => setBannerNotice(null), 4000);
    } catch (err) {
      console.error('Batch error:', err);
    } finally {
      setBatchActionRunning(false);
    }
  };

  // Copy Absent Phone Numbers Broadcast List
  const handleCopyBroadcastPhoneList = () => {
    const phones = filteredAbsentList
      .map(a => formatPhoneForWhatsApp(a.phone))
      .filter(p => p && p.length > 5);

    if (phones.length === 0) {
      alert('No valid phone numbers found among the selected absent members.');
      return;
    }

    const text = phones.join(', ');
    navigator.clipboard.writeText(text);
    setCopiedBroadcastSuccess(true);
    setTimeout(() => setCopiedBroadcastSuccess(false), 3500);
  };

  // Copy Pastoral Care Digest for Church Leaders
  const handleCopyPastoralDigest = () => {
    const lines: string[] = [];
    lines.push(`🕊️ *LIGHTUP PRAYER ALTAR — ABSENT MEMBERS PASTORAL DIGEST*`);
    lines.push(`📅 *Session Date:* ${formattedDateTitle}`);
    lines.push(`👥 *Group:* ${selectedGroup === 'all' ? 'All Prayer Groups' : selectedGroup}`);
    lines.push(`📊 *Total Absent:* ${filteredAbsentList.length} | *Contacted:* ${filteredAbsentList.filter(a => a.status === 'contacted').length} | *Pending:* ${filteredAbsentList.filter(a => a.status === 'pending').length}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);

    if (filteredAbsentList.length === 0) {
      lines.push(`_🎉 No absent members in this filter! 100% Attendance._`);
    } else {
      filteredAbsentList.forEach((a, idx) => {
        const phoneStr = a.phone ? ` • 📞 ${a.phone}` : ' • (No phone)';
        const statusBadge = a.status === 'contacted' ? '✅ Reached' : a.status === 'excused' ? '🛡️ Excused' : a.status === 'pastoral_care' ? '🚨 Needs Care' : '⏳ Pending';
        const notesStr = a.record?.notes ? `\n   ↳ _Note: ${a.record.notes}_` : '';
        lines.push(`${idx + 1}. *${a.displayName}* (${a.community})${phoneStr} [${statusBadge}]${notesStr}`);
      });
    }

    lines.push(``);
    lines.push(`🕊️ _"Suppose one of you has a hundred sheep and loses one of them. Doesn't he leave the ninety-nine in the open country and go after the lost sheep until he finds it?"_ — Luke 15:4`);
    lines.push(`🔗 *Altar Link:* https://lightupprayer.org/join`);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedDigestSuccess(true);
    setTimeout(() => setCopiedDigestSuccess(false), 3500);
  };

  // Today string
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Pastoral Mission Hero Header */}
      <div className="bg-gradient-to-br from-[#1A1F3C] via-[#222852] to-[#12162E] rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#F26522]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black uppercase tracking-wider">
              <HeartHandshake size={14} className="text-rose-400" />
              <span>Pastoral Care & Member Retention Mandate</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center space-x-2.5">
              <span>Absent Members Follow-Up Center</span>
              <span className="text-sm px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-black">
                {stats.totalAbsent} Absent
              </span>
            </h2>

            <p className="text-gray-300 text-sm leading-relaxed font-medium">
              <em>"Leave no one behind — Every member matters."</em> Follow up with absent brethren systematically across WhatsApp, phone calls, SMS, and pastoral notes to encourage their spiritual journey and bring them back to the prayer altar.
            </p>
          </div>

          {/* Action Switcher back to roster */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onBackToRoster && (
              <button
                type="button"
                onClick={onBackToRoster}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 border border-white/20 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to Roster Table</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyPastoralDigest}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
              title="Copy formatted absent list for ministers / leadership team"
            >
              {copiedDigestSuccess ? <Check size={14} className="text-amber-300" /> : <Copy size={14} />}
              <span>{copiedDigestSuccess ? 'Digest Copied!' : 'Copy Ministers Digest'}</span>
            </button>
          </div>
        </div>

        {/* Live Follow-Up Progress Bar */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Total Absent</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-rose-400">{stats.totalAbsent}</span>
              <span className="text-xs text-gray-400">members missed prayer</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">Contacted / Reached</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">{stats.contacted}</span>
              <span className="text-xs text-gray-400">followed up</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">Pending Follow-Up</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-amber-400">{stats.pending}</span>
              <span className="text-xs text-gray-400">need reaching out</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
              <span>Follow-Up Rate</span>
              <span className="text-white font-bold">{stats.completionRate}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 block">
              {stats.completed} of {stats.totalAbsent} members attended to
            </span>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {bannerNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs font-black text-emerald-900 uppercase tracking-wider animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{bannerNotice}</span>
          </div>
          <button 
            onClick={() => setBannerNotice(null)}
            className="p-1 hover:bg-black/5 rounded text-emerald-700 cursor-pointer"
          >
            <XCircle size={14} />
          </button>
        </div>
      )}

      {/* Controls Bar: Date Selector, Group Switcher, and Filters */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
        {/* Date Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400 mr-2">Session Date:</span>
            
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522]"
            />

            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={() => onSelectDate(todayStr)}
                className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-[#F26522] rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Today
              </button>
            )}

            <span className="text-xs text-gray-500 font-semibold ml-2">
              Showing absent members for <strong>{formattedDateTitle}</strong>
            </span>
          </div>

          {/* Broadcast & Batch Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyBroadcastPhoneList}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-[#1A1F3C] rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="Copy all absent phone numbers separated by comma for WhatsApp broadcast list"
            >
              {copiedBroadcastSuccess ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedBroadcastSuccess ? 'Phones Copied!' : 'Copy Broadcast Phones'}</span>
            </button>

            <button
              type="button"
              onClick={handleBatchMarkFilteredContacted}
              disabled={batchActionRunning || filteredAbsentList.length === 0}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all cursor-pointer border border-emerald-200 disabled:opacity-50"
              title="Mark all absent members in current filter as Contacted"
            >
              {batchActionRunning ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>Mark All ({filteredAbsentList.length}) Contacted</span>
            </button>
          </div>
        </div>

        {/* Group Selector Pills */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-gray-400">
            <Users size={14} className="text-[#F26522]" />
            <span>Filter By Prayer Group:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5",
                selectedGroup === 'all'
                  ? "bg-[#1A1F3C] text-white font-black shadow-md"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              )}
            >
              <span>All Groups</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-black",
                selectedGroup === 'all' ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
              )}>
                {allAbsentMembers.length}
              </span>
            </button>

            {allCommunities.map(commName => {
              const count = allAbsentMembers.filter(a => a.community.toLowerCase().trim() === commName.toLowerCase().trim()).length;
              const isEsther = commName.toLowerCase().includes('esther');
              return (
                <button
                  key={commName}
                  type="button"
                  onClick={() => setSelectedGroup(commName)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5",
                    selectedGroup === commName
                      ? isEsther 
                        ? "bg-purple-900 text-white font-black shadow-md ring-2 ring-purple-400"
                        : "bg-[#F26522] text-white font-black shadow-md"
                      : isEsther
                        ? "bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  )}
                >
                  <span>{commName}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-black",
                    selectedGroup === commName 
                      ? "bg-white/20 text-white" 
                      : isEsther ? "bg-purple-200 text-purple-900" : "bg-gray-200 text-gray-700"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Filter & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-gray-100">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search absent members by name, phone, email, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400 mr-1">Status:</span>

            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                statusFilter === 'all' ? "bg-[#1A1F3C] text-white font-black" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              All ({allAbsentMembers.length})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1",
                statusFilter === 'pending' ? "bg-amber-500 text-white font-black" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
              )}
            >
              <Clock size={12} />
              <span>Pending ({stats.pending})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('contacted')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1",
                statusFilter === 'contacted' ? "bg-emerald-600 text-white font-black" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              )}
            >
              <CheckCircle2 size={12} />
              <span>Contacted ({stats.contacted})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('excused')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1",
                statusFilter === 'excused' ? "bg-blue-600 text-white font-black" : "bg-blue-50 text-blue-800 hover:bg-blue-100"
              )}
            >
              <Shield size={12} />
              <span>Excused ({stats.excused})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('pastoral_care')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1",
                statusFilter === 'pastoral_care' ? "bg-rose-600 text-white font-black" : "bg-rose-50 text-rose-800 hover:bg-rose-100"
              )}
            >
              <HeartHandshake size={12} />
              <span>Needs Care ({stats.pastoralCare})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pastoral Care Message Template Selector Card */}
      <div className="bg-gradient-to-r from-orange-50/70 via-amber-50/40 to-white rounded-3xl p-6 border border-orange-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <MessageCircle className="text-[#F26522]" size={18} />
            <h3 className="text-sm font-black text-[#1A1F3C] uppercase tracking-wider">
              Care Message Template for 1-Click WhatsApp & SMS
            </h3>
          </div>

          <span className="text-xs text-gray-500 font-medium">
            Personalizes automatically with each member's name and date
          </span>
        </div>

        {/* Template Options Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEFAULT_FOLLOW_UP_TEMPLATES.map(tpl => {
            const isSelected = selectedTemplateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setSelectedTemplateId(tpl.id);
                  setIsEditingTemplate(false);
                }}
                className={cn(
                  "p-3.5 rounded-2xl text-left transition-all border cursor-pointer",
                  isSelected
                    ? "bg-white border-[#F26522] shadow-md ring-2 ring-[#F26522]/20"
                    : "bg-white/60 hover:bg-white border-orange-100 text-gray-600"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-xs font-black", isSelected ? "text-[#F26522]" : "text-[#1A1F3C]")}>
                    {tpl.title}
                  </span>
                  {isSelected && <Check size={14} className="text-[#F26522]" />}
                </div>
                <p className="text-[11px] text-gray-500 line-clamp-2 leading-tight">
                  {tpl.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Message Preview Box */}
        <div className="bg-white rounded-2xl p-4 border border-orange-200/60 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-500 flex items-center space-x-1.5">
              <span>Preview:</span>
              <strong className="text-[#1A1F3C]">{activeTemplate.title}</strong>
            </span>
            <span className="text-[11px] text-gray-400 font-mono">
              Variables: {'{name}'}, {'{date}'}
            </span>
          </div>

          {isEditingTemplate ? (
            <div className="space-y-2">
              <textarea
                value={customTemplateText || activeTemplate.message}
                onChange={(e) => {
                  setCustomTemplateText(e.target.value);
                  setSelectedTemplateId('custom');
                }}
                rows={3}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#F26522]"
                placeholder="Type your custom care message..."
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditingTemplate(false)}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Done Editing
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-700 font-medium leading-relaxed italic border border-gray-100 relative group">
              "{formatFollowUpMessage(activeTemplate.message, 'Sister Mary', selectedDate)}"
              <button
                type="button"
                onClick={() => setIsEditingTemplate(true)}
                className="ml-2 text-xs font-bold text-[#F26522] hover:underline cursor-pointer not-italic inline-flex items-center space-x-1"
              >
                <Edit3 size={12} />
                <span>Customize text</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Absent Members List (Cards & Quick-Action Layout) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-[#1A1F3C] uppercase tracking-wider flex items-center space-x-2">
            <span>Absent Members to Follow Up</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
              {filteredAbsentList.length} matching
            </span>
          </h3>

          <span className="text-xs text-gray-400 font-medium">
            Click <strong>WhatsApp</strong> to send care message & auto-log
          </span>
        </div>

        {filteredAbsentList.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <h4 className="text-lg font-black text-[#1A1F3C]">
              No Absent Members Found
            </h4>
            <p className="text-gray-500 text-xs max-w-md mx-auto">
              {allAbsentMembers.length === 0
                ? `Praise God! All registered members in the church roster were marked present for ${formattedDateTitle}!`
                : `No absent members matched the selected filters. Try switching the prayer group or status filter.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredAbsentList.map((item, index) => {
              const isEsther = item.community.toLowerCase().includes('esther');
              const isSavingThis = isSavingRecord === item.uid;
              const hasPhone = Boolean(item.phone);
              const isNotesOpen = editingNotesUid === item.uid;

              return (
                <div 
                  key={item.uid}
                  className={cn(
                    "bg-white rounded-2xl p-5 border transition-all shadow-xs space-y-4",
                    item.status === 'contacted' ? "border-emerald-200/80 bg-emerald-50/20" :
                    item.status === 'pastoral_care' ? "border-rose-200 bg-rose-50/30 ring-1 ring-rose-200" :
                    item.status === 'excused' ? "border-blue-200 bg-blue-50/20" :
                    "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Member Information */}
                    <div className="flex items-start space-x-3.5">
                      <div className={cn(
                        "w-11 h-11 rounded-2xl text-white font-black flex items-center justify-center shrink-0 shadow-sm text-sm",
                        item.status === 'contacted' ? "bg-emerald-600" :
                        item.status === 'pastoral_care' ? "bg-rose-600" :
                        item.status === 'excused' ? "bg-blue-600" :
                        "bg-[#1A1F3C]"
                      )}>
                        {item.displayName.substring(0, 2).toUpperCase()}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-black text-[#1A1F3C]">
                            {item.displayName}
                          </h4>

                          {/* Group Badge */}
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                            isEsther ? "bg-purple-100 text-purple-900 border border-purple-200" : "bg-gray-100 text-gray-700"
                          )}>
                            {item.community}
                          </span>

                          {/* Follow-up Status Badge */}
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center space-x-1",
                            item.status === 'contacted' ? "bg-emerald-100 text-emerald-800" :
                            item.status === 'pastoral_care' ? "bg-rose-100 text-rose-800" :
                            item.status === 'excused' ? "bg-blue-100 text-blue-800" :
                            "bg-amber-100 text-amber-800"
                          )}>
                            <span>
                              {item.status === 'contacted' ? '✅ Contacted' :
                               item.status === 'pastoral_care' ? '🚨 Needs Care' :
                               item.status === 'excused' ? '🛡️ Excused' : '⏳ Pending'}
                            </span>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-medium">
                          {hasPhone ? (
                            <span className="font-mono text-gray-700 font-bold bg-gray-100 px-2 py-0.5 rounded">
                              📞 {item.phone}
                            </span>
                          ) : (
                            <span className="text-rose-500 italic">No phone number on record</span>
                          )}

                          {item.email && (
                            <span className="font-mono text-gray-500">
                              ✉️ {item.email}
                            </span>
                          )}

                          <span className="text-gray-400">
                            • Last attended: <strong>{item.lastAttendedDate || 'Never recorded'}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Direct Contact Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* WhatsApp Care Action */}
                      <button
                        type="button"
                        onClick={() => handleLaunchWhatsApp(item)}
                        disabled={!hasPhone || isSavingThis}
                        className={cn(
                          "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer",
                          hasPhone 
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95" 
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        )}
                        title={hasPhone ? "Launch WhatsApp with care message and mark contacted" : "No phone available"}
                      >
                        <MessageCircle size={15} />
                        <span>Send WhatsApp Care</span>
                      </button>

                      {/* Phone Call Button */}
                      {hasPhone && (
                        <a
                          href={`tel:${formatPhoneForWhatsApp(item.phone)}`}
                          onClick={() => handleUpdateStatus(item, 'contacted', 'call')}
                          className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1"
                          title="Dial member directly"
                        >
                          <Phone size={14} />
                          <span>Call</span>
                        </a>
                      )}

                      {/* SMS Button */}
                      {hasPhone && (
                        <a
                          href={`sms:${formatPhoneForWhatsApp(item.phone)}?body=${encodeURIComponent(formatFollowUpMessage(activeTemplate.message, item.displayName, selectedDate))}`}
                          onClick={() => handleUpdateStatus(item, 'contacted', 'sms')}
                          className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1"
                          title="Send SMS message"
                        >
                          <Send size={14} />
                          <span>SMS</span>
                        </a>
                      )}

                      {/* Email Button */}
                      {item.email && (
                        <a
                          href={`mailto:${item.email}?subject=${encodeURIComponent(`Praying for you from LightUp Prayer Altar`)}&body=${encodeURIComponent(formatFollowUpMessage(activeTemplate.message, item.displayName, selectedDate))}`}
                          onClick={() => handleUpdateStatus(item, 'contacted', 'email')}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1"
                          title="Send Email"
                        >
                          <Mail size={14} />
                          <span>Email</span>
                        </a>
                      )}

                      {/* Copy message button */}
                      <button
                        type="button"
                        onClick={() => handleCopyMessageForMember(item)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all cursor-pointer"
                        title="Copy care message to clipboard"
                      >
                        {copiedIndividualUid === item.uid ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>

                      {/* ⚡ DIRECT CORRECTION: MARK PRESENT ON THE SPOT */}
                      <button
                        type="button"
                        onClick={() => onToggleAttendance({ member: item.member, isPresent: false, displayName: item.displayName, minutes: 0 }, 'present')}
                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1 border border-emerald-200 cursor-pointer"
                        title="Member was actually present? Click to mark Present and remove from absent"
                      >
                        <UserCheck size={14} className="text-emerald-600" />
                        <span>✓ Mark Present</span>
                      </button>
                    </div>
                  </div>

                  {/* Follow-up Status Changer & Notes Row */}
                  <div className="pt-3 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    {/* Status Pill Switcher */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-gray-400 font-bold uppercase text-[10px]">Mark Status:</span>
                      
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(item, 'pending')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                          item.status === 'pending' ? "bg-amber-500 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        ⏳ Pending
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(item, 'contacted')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                          item.status === 'contacted' ? "bg-emerald-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        ✅ Contacted
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(item, 'excused')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                          item.status === 'excused' ? "bg-blue-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        🛡️ Excused (Travel/Work/Sick)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(item, 'pastoral_care')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                          item.status === 'pastoral_care' ? "bg-rose-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        🚨 Needs Pastoral Visit
                      </button>
                    </div>

                    {/* Notes & Last Contact timestamp */}
                    <div className="flex items-center space-x-3">
                      {item.record?.notes ? (
                        <div className="flex items-center space-x-1.5 text-gray-600">
                          <span className="font-bold text-gray-400">Note:</span>
                          <span className="italic bg-gray-50 px-2 py-0.5 rounded border border-gray-200/60 max-w-xs truncate">
                            {item.record.notes}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNotesUid(item.uid);
                              setNotesDraft(item.record?.notes || '');
                            }}
                            className="text-[#F26522] hover:underline font-bold"
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNotesUid(item.uid);
                            setNotesDraft('');
                          }}
                          className="text-gray-400 hover:text-gray-700 font-bold flex items-center space-x-1 cursor-pointer"
                        >
                          <Edit3 size={12} />
                          <span>+ Add Pastoral Note</span>
                        </button>
                      )}

                      {item.record?.contactedAt && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          Contacted: {new Date(item.record.contactedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                    {/* Inline Note Editor Modal/Drawer */}
                    {isNotesOpen && (
                      <div className="pt-3 border-t border-gray-200/60 flex items-center gap-2">
                        <input
                          type="text"
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="e.g. Spoke on phone — travelling back tomorrow, requested healing prayer"
                          className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F26522]"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveNotes(item)}
                          disabled={isSavingThis}
                          className="px-3 py-1.5 bg-[#1A1F3C] text-white rounded-xl text-xs font-bold hover:bg-black transition-all cursor-pointer"
                        >
                          Save Note
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNotesUid(null)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
