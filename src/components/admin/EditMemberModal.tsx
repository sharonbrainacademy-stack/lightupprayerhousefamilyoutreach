/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, User, Mail, Phone, MapPin, Users, Shield, 
  Clock, Calendar, Save, AlertTriangle, CheckCircle2, 
  MessageCircle, FileText, RefreshCw, Sparkles, Check, Copy
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserProfile, UserRole } from '../../types';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: UserProfile | null;
  isSuperAdmin: boolean;
  dynamicCommunityOptions: string[];
  onSuccess?: (message: string) => void;
}

export const EditMemberModal: React.FC<EditMemberModalProps> = ({
  isOpen,
  onClose,
  member,
  isSuperAdmin,
  dynamicCommunityOptions,
  onSuccess
}) => {
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [whatsappCommunity, setWhatsappCommunity] = useState('');
  const [customCommunity, setCustomCommunity] = useState('');
  const [joinedWhatsappGroup, setJoinedWhatsappGroup] = useState(false);
  const [role, setRole] = useState<UserRole>('member');
  const [attendanceCount, setAttendanceCount] = useState<number>(0);
  const [totalMinutes, setTotalMinutes] = useState<number>(0);
  const [todayMinutes, setTodayMinutes] = useState<number>(0);
  const [thisYearMinutes, setThisYearMinutes] = useState<number>(0);
  const [adminNote, setAdminNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const handleCopyPhone = () => {
    const raw = phone.trim();
    if (!raw) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(raw);
      } else {
        const el = document.createElement('textarea');
        el.value = raw;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch (err) {
      console.error('Failed to copy phone:', err);
    }
  };

  // Sync state whenever member changes or modal opens
  useEffect(() => {
    if (member) {
      setDisplayName(member.displayName || '');
      setEmail(member.email || '');
      setPhone(member.phone || (member as any).phoneNumber || (member as any).whatsappNumber || '');
      setCountry(member.country || '');
      
      const comm = member.whatsappCommunity || member.whatsappGroupName || member.whatsappGroup || '';
      if (comm && dynamicCommunityOptions.includes(comm)) {
        setWhatsappCommunity(comm);
        setCustomCommunity('');
      } else if (comm) {
        setWhatsappCommunity('custom');
        setCustomCommunity(comm);
      } else {
        setWhatsappCommunity('');
        setCustomCommunity('');
      }

      setJoinedWhatsappGroup(Boolean(member.joinedWhatsappGroup));
      setRole(member.role || 'member');
      setAttendanceCount(member.attendanceCount || (member.attendanceDaysList?.length || 0));
      setTotalMinutes(member.totalMinutes || 0);
      setTodayMinutes(member.todayMinutes || 0);
      setThisYearMinutes(member.thisYearMinutes || member.thisWeekMinutes || 0);
      setAdminNote((member as any).manualAdjustmentNote || (member as any).adminNotes || '');
      setErrorMessage(null);
    }
  }, [member, isOpen, dynamicCommunityOptions]);

  if (!isOpen || !member) return null;

  const isMasterAccount = (member.email || '').toLowerCase().trim() === 'brainstormacademybsa@gmail.com' ||
    member.uid === 'admin-master-brainstormacademybsa_gmail_com';

  const formatHoursAndMinutes = (mins: number) => {
    const total = Math.max(0, Math.floor(mins || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m} mins`;
    return `${h} hr${h > 1 ? 's' : ''} ${m.toString().padStart(2, '0')} mins`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;

    // Basic Validations
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setErrorMessage('Member display name is required.');
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('A valid email address is required.');
      return;
    }

    const finalCommunity = whatsappCommunity === 'custom' 
      ? customCommunity.trim() 
      : whatsappCommunity.trim();

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const userRef = doc(db, 'users', member.uid);

      const updates: Record<string, any> = {
        displayName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        country: country.trim(),
        whatsappCommunity: finalCommunity || 'Unassigned',
        whatsappGroupName: finalCommunity || 'Unassigned',
        joinedWhatsappGroup: Boolean(joinedWhatsappGroup),
        attendanceCount: Math.max(0, Number(attendanceCount) || 0),
        totalMinutes: Math.max(0, Number(totalMinutes) || 0),
        todayMinutes: Math.max(0, Number(todayMinutes) || 0),
        thisYearMinutes: Math.max(0, Number(thisYearMinutes) || 0),
        manualAdjustmentNote: adminNote.trim() || `Updated by administrator (${user?.email || 'Admin'}) on ${new Date().toLocaleDateString()}`,
        lastEditedAt: serverTimestamp(),
        lastEditedBy: user?.email || 'admin'
      };

      // Only allow modifying roles if the admin has super_admin permission
      // and do not demote the master super admin
      if (isSuperAdmin) {
        if (isMasterAccount) {
          updates.role = 'super_admin';
        } else {
          updates.role = role;
        }
      }

      await updateDoc(userRef, updates);

      const successMsg = `Successfully updated member record for "${trimmedName}".`;
      if (onSuccess) {
        onSuccess(successMsg);
      }
      onClose();
    } catch (err: any) {
      console.error('Error updating member record:', err);
      setErrorMessage(err?.message || 'Failed to update member record in database. Please check permissions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl border border-gray-100 my-8 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-5 shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#1A1F3C] text-white flex items-center justify-center font-black text-lg shrink-0 shadow-md">
              {(displayName || email || 'M').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl sm:text-2xl font-black text-[#1A1F3C]">Edit Member Record</h3>
                {isMasterAccount && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-full">
                    Master Admin
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-xs font-mono mt-0.5">
                UID: <span className="text-gray-400 select-all">{member.uid}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-gray-400 hover:text-[#1A1F3C] hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
            title="Close editor"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center space-x-2.5 text-xs font-bold animate-in fade-in">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body (Scrollable) */}
        <form id="edit-member-form" onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-1 flex-1">
          {/* Section 1: Personal Details */}
          <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-[#1A1F3C]">
              <User size={15} className="text-[#F26522]" />
              <span>Personal Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Full Name / Display Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="member@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                    Phone / WhatsApp Number
                  </label>
                  {phone.trim() && (
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className={cn(
                        "inline-flex items-center space-x-1 text-[10px] font-black px-2 py-0.5 rounded border transition-all cursor-pointer shadow-2xs",
                        copiedPhone 
                          ? "bg-emerald-600 text-white border-emerald-600" 
                          : "bg-white hover:bg-emerald-50 text-emerald-800 border-gray-200 hover:border-emerald-300"
                      )}
                      title={`Copy phone number ${phone.trim()}`}
                    >
                      {copiedPhone ? (
                        <>
                          <Check size={11} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} className="text-gray-500" />
                          <span>Copy Phone</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +234 803 123 4567 or 08031234567"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522] focus:border-transparent transition-all font-mono"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Used for WhatsApp cell integration and automatic duplicate tracking.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Country / Region
                </label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. Nigeria, United Kingdom, USA"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522] focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Community & WhatsApp Cell */}
          <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-[#1A1F3C]">
              <MessageCircle size={15} className="text-emerald-600" />
              <span>WhatsApp Community & Cell Assignment</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Assigned Community
                </label>
                <select
                  value={whatsappCommunity}
                  onChange={(e) => setWhatsappCommunity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {dynamicCommunityOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="custom">-- Custom / Other Community --</option>
                </select>
              </div>

              {whatsappCommunity === 'custom' && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                    Custom Community Name
                  </label>
                  <input
                    type="text"
                    value={customCommunity}
                    onChange={(e) => setCustomCommunity(e.target.value)}
                    placeholder="Enter custom community name"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={joinedWhatsappGroup}
                    onChange={(e) => setJoinedWhatsappGroup(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-700">
                    Confirmed Member of WhatsApp Prayer Community
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Role & Administrative Permissions */}
          <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-[#1A1F3C]">
                <Shield size={15} className="text-purple-600" />
                <span>Account Role & Access Level</span>
              </div>
              {!isSuperAdmin && (
                <span className="text-[10px] text-gray-400 font-bold">
                  (Only Super Admins can alter roles)
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                Role Assignment
              </label>
              <select
                value={role}
                disabled={!isSuperAdmin || isMasterAccount}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className={cn(
                  "w-full px-3.5 py-2.5 rounded-xl text-sm font-bold border outline-none transition-all",
                  isSuperAdmin && !isMasterAccount 
                    ? "bg-white border-gray-200 text-[#1A1F3C] focus:ring-2 focus:ring-purple-500 cursor-pointer" 
                    : "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                )}
              >
                <option value="member">Member (Regular church attendee)</option>
                <option value="admin_assistant">Admin Assistant (Attendance & ministry duties)</option>
                <option value="super_admin">Super Admin (Full administrative access)</option>
              </select>
              {isMasterAccount && (
                <p className="text-[10px] text-amber-700 font-medium mt-1">
                  Master Super Admin role is protected and cannot be changed.
                </p>
              )}
            </div>
          </div>

          {/* Section 4: Attendance & Prayer Statistics */}
          <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-[#1A1F3C]">
                <Clock size={15} className="text-[#F26522]" />
                <span>Attendance & Prayer Time Records</span>
              </div>
              <span className="text-[10px] font-bold text-[#F26522] bg-orange-100/60 px-2 py-0.5 rounded-md">
                Total: {formatHoursAndMinutes(totalMinutes)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Attended Days Count
                </label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    value={attendanceCount}
                    onChange={(e) => setAttendanceCount(parseInt(e.target.value) || 0)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522] focus:border-transparent transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Total Prayer Minutes
                </label>
                <div className="relative">
                  <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    value={totalMinutes}
                    onChange={(e) => setTotalMinutes(parseInt(e.target.value) || 0)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522] focus:border-transparent transition-all font-mono"
                  />
                </div>
                <span className="text-[10px] text-gray-400 block mt-1 font-mono">
                  = {formatHoursAndMinutes(totalMinutes)}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Today's Minutes
                </label>
                <div className="relative">
                  <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    value={todayMinutes}
                    onChange={(e) => setTodayMinutes(parseInt(e.target.value) || 0)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522] focus:border-transparent transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Administrative Reason / Audit Note */}
          <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-[#1A1F3C]">
              <FileText size={15} className="text-gray-500" />
              <span>Administrative Modification Note (Optional)</span>
            </div>
            <textarea
              rows={2}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. Corrected misspelled name and updated WhatsApp phone number per member request."
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-[#1A1F3C] outline-none focus:ring-2 focus:ring-[#F26522] focus:border-transparent transition-all resize-none"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 pt-5 shrink-0">
          <div className="text-xs text-gray-400 font-medium">
            Changes will immediately update the database and reflect across prayer rosters.
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="edit-member-form"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#F26522] hover:bg-[#d95316] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-md shadow-orange-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Member Record</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditMemberModal;
