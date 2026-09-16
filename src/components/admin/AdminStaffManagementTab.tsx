/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Crown, ShieldCheck, UserPlus, Trash2, CheckCircle2, 
  AlertCircle, Search, Mail, Shield, User, Sparkles, X, ChevronDown, Key, Lock, RefreshCw
} from 'lucide-react';
import { collection, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserProfile } from '../../types';
import { useAuth, SUPER_ADMIN_EMAILS } from '../../lib/auth';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

interface AdminStaffManagementTabProps {
  members: UserProfile[];
}

export default function AdminStaffManagementTab({ members }: AdminStaffManagementTabProps) {
  const { user, profile, updateAdminPassword } = useAuth();

  // Super Admin helper check
  const isUserSuperAdmin = (u?: UserProfile | null, email?: string | null) => {
    if (!u && !email) return false;
    if (u?.role === 'super_admin') return true;
    const userEmail = (u?.email || email || '').toLowerCase().trim();
    return Boolean(userEmail && SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail));
  };

  const isSuperAdmin = isUserSuperAdmin(profile, user?.email);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
  const [passChangeLoading, setPassChangeLoading] = useState(false);
  const [passChangeError, setPassChangeError] = useState<string | null>(null);
  const [passChangeSuccess, setPassChangeSuccess] = useState<string | null>(null);

  const [newAdminMode, setNewAdminMode] = useState<'select_member' | 'email'>('select_member');
  const [selectedMemberUid, setSelectedMemberUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin_assistant' | 'super_admin'>('admin_assistant');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassChangeError(null);
    setPassChangeSuccess(null);

    if (newPasswordValue.length < 4) {
      setPassChangeError('Password must be at least 4 characters long.');
      return;
    }

    if (newPasswordValue !== confirmPasswordValue) {
      setPassChangeError('Passwords do not match.');
      return;
    }

    setPassChangeLoading(true);
    try {
      const ok = await updateAdminPassword(newPasswordValue);
      if (ok) {
        setPassChangeSuccess('Your admin password has been updated successfully!');
        setNewPasswordValue('');
        setConfirmPasswordValue('');
        setTimeout(() => {
          setShowChangePassModal(false);
          setPassChangeSuccess(null);
        }, 2000);
      } else {
        setPassChangeError('Failed to update password.');
      }
    } catch (err: any) {
      setPassChangeError(err?.message || 'Error changing password.');
    } finally {
      setPassChangeLoading(false);
    }
  };

  // Filtered admin staff: hide super admins if the viewer is not a Super Admin
  const adminStaff = members.filter(m => {
    if (!m.role || m.role === 'member') return false;
    if (!isSuperAdmin && isUserSuperAdmin(m)) return false;
    return true;
  });
  
  // Non-admin registered members for promotion dropdown
  const regularMembers = members.filter(m => !m.role || m.role === 'member');

  // Search filtered admins (strictly excluding super admins for non-super admins)
  const displayedAdmins = adminStaff.filter(admin => {
    if (!isSuperAdmin && isUserSuperAdmin(admin)) return false;
    const q = searchQuery.toLowerCase();
    const emailMatch = (admin.email || '').toLowerCase().includes(q);
    const roleMatch = (admin.role || '').toLowerCase().includes(q);
    return emailMatch || roleMatch;
  });

  // Handle Add Admin submit
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      alert('Only Super Admins can add or promote administrators.');
      return;
    }

    setActionLoading(true);
    setFeedback(null);

    try {
      if (newAdminMode === 'select_member') {
        if (!selectedMemberUid) {
          setFeedback({ type: 'error', message: 'Please select a member from the list.' });
          setActionLoading(false);
          return;
        }

        const targetMember = members.find(m => m.uid === selectedMemberUid);
        await updateDoc(doc(db, 'users', selectedMemberUid), { role: newAdminRole });
        setFeedback({ 
          type: 'success', 
          message: `Promoted ${targetMember?.email || 'Member'} to ${newAdminRole === 'super_admin' ? 'Super Admin' : 'Admin Assistant'} successfully!` 
        });
      } else {
        const cleanEmail = newAdminEmail.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          setFeedback({ type: 'error', message: 'Please enter a valid email address.' });
          setActionLoading(false);
          return;
        }

        const existingMember = members.find(m => m.email?.toLowerCase() === cleanEmail);
        if (existingMember) {
          await updateDoc(doc(db, 'users', existingMember.uid), { role: newAdminRole });
          setFeedback({ 
            type: 'success', 
            message: `User ${cleanEmail} already has an account and was elevated to ${newAdminRole === 'super_admin' ? 'Super Admin' : 'Admin Assistant'}!` 
          });
        } else {
          // Pre-assign admin role in users collection
          const newDocRef = doc(collection(db, 'users'));
          await setDoc(newDocRef, {
            email: cleanEmail,
            role: newAdminRole,
            joinedAt: new Date().toISOString(),
            attendanceCount: 0,
            isPreAssignedAdmin: true
          });
          setFeedback({ 
            type: 'success', 
            message: `Pre-authorized ${cleanEmail} as ${newAdminRole === 'super_admin' ? 'Super Admin' : 'Admin Assistant'}. When they log in with Google, their admin privileges will be activated automatically!` 
          });
        }
      }

      setTimeout(() => {
        setShowAddAdminModal(false);
        setSelectedMemberUid('');
        setNewAdminEmail('');
        setFeedback(null);
      }, 1800);
    } catch (err: any) {
      console.error('Error adding administrator:', err);
      setFeedback({ type: 'error', message: err?.message || 'Failed to add administrator.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Change existing staff role
  const handleChangeRole = async (targetAdmin: UserProfile, newRole: 'member' | 'admin_assistant' | 'super_admin') => {
    if (!isSuperAdmin) {
      alert('Only Super Admins can modify administrator roles.');
      return;
    }

    if (targetAdmin.email?.toLowerCase() === 'brainstormacademybsa@gmail.com' && newRole !== 'super_admin') {
      alert('The primary root Super Admin account is protected and cannot be modified or demoted.');
      return;
    }

    if (targetAdmin.uid === user?.uid && newRole === 'member') {
      if (!confirm('Warning: You are about to revoke your own admin access. Proceed?')) return;
    }

    try {
      await updateDoc(doc(db, 'users', targetAdmin.uid), { role: newRole });
    } catch (err) {
      console.error('Error modifying admin role:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetAdmin.uid}`);
    }
  };

  return (
    <div id="admin-staff-management-container" className="space-y-8">
      {/* Top Banner & Action Header */}
      <div className="bg-gradient-to-br from-[#1A1F3C] via-[#242A4E] to-[#1A1F3C] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#F26522]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-white/10 backdrop-blur rounded-full text-[10px] font-black uppercase tracking-widest text-[#F26522] flex items-center space-x-1.5">
                <Crown size={12} className="text-[#F26522]" />
                <span>Super Admin Portal</span>
              </span>
              <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-[10px] font-bold">
                {adminStaff.length} Active {adminStaff.length === 1 ? 'Administrator' : 'Administrators'}
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
              Administrator Staff Management
            </h3>

            <p className="text-gray-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Super Admins have full authorization to appoint new administrators, assign elevated security roles, and manage platform permissions across the Light Up ecosystem.
            </p>

            {isSuperAdmin && (
              <div className="pt-2 flex items-center space-x-2 text-[11px] text-gray-400 font-medium">
                <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                <span>Authorization Level: <strong className="text-white font-semibold">Elevated Super Admin Access</strong></span>
              </div>
            )}
          </div>

          {/* Add Admin & Password Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => setShowChangePassModal(true)}
              className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold text-xs transition-all flex items-center justify-center space-x-2 border border-white/20 cursor-pointer shadow"
            >
              <Key size={16} className="text-amber-400 shrink-0" />
              <span>Change My Admin Password</span>
            </button>

            {isSuperAdmin ? (
              <button
                id="btn-open-add-admin-modal"
                onClick={() => setShowAddAdminModal(true)}
                className="px-6 py-3.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-2xl font-black uppercase text-xs tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#F26522]/30 cursor-pointer"
              >
                <UserPlus size={18} />
                <span>Add Administrator</span>
              </button>
            ) : (
              <div className="px-4 py-3 bg-white/10 backdrop-blur rounded-2xl text-xs text-gray-300 border border-white/10 max-w-xs">
                <div className="font-bold text-white flex items-center space-x-1.5 mb-1">
                  <Shield size={14} className="text-yellow-400" />
                  <span>Admin Assistant Access</span>
                </div>
                <span>Role assignments and additions are managed by the Super Admin.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search administrators by email or role..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-xs font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522]"
          />
        </div>
        <div className="text-xs font-bold text-gray-400 flex items-center space-x-2 shrink-0">
          <span>Showing {displayedAdmins.length} of {adminStaff.length} Admins</span>
        </div>
      </div>

      {/* Admin Staff Table & Cards */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="p-5">Administrator Email</th>
                <th className="p-5">Role Level</th>
                <th className="p-5">Platform Privileges</th>
                {isSuperAdmin && <th className="p-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {displayedAdmins.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 4 : 3} className="p-12 text-center text-gray-400 text-xs font-bold">
                    No administrators found matching your search.
                  </td>
                </tr>
              ) : (
                displayedAdmins.map((admin) => {
                  const isRootAdmin = admin.email?.toLowerCase() === 'brainstormacademybsa@gmail.com';
                  const isCurrentSuper = admin.role === 'super_admin';

                  return (
                    <tr key={admin.uid} className="hover:bg-gray-50/70 transition-colors">
                      {/* Email & Avatar */}
                      <td className="p-5">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-sm ${
                            isCurrentSuper ? 'bg-gradient-to-br from-purple-600 to-indigo-700' : 'bg-gradient-to-br from-[#1A1F3C] to-slate-700'
                          }`}>
                            {(admin.email?.[0] || 'A').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-mono text-xs font-bold text-[#1A1F3C] flex items-center space-x-1.5">
                              <span>{admin.email}</span>
                              {isRootAdmin && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black uppercase rounded-full font-sans">
                                  Root
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 font-medium">
                              Joined {admin.joinedAt ? new Date(admin.joinedAt).toLocaleDateString() : 'Active Staff'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Level Badge */}
                      <td className="p-5">
                        {isCurrentSuper ? (
                          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-200">
                            <Crown size={12} className="text-purple-600" />
                            <span>Super Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-200">
                            <ShieldCheck size={12} className="text-blue-600" />
                            <span>Admin Assistant</span>
                          </span>
                        )}
                      </td>

                      {/* Privileges Description */}
                      <td className="p-5 text-xs text-gray-500 font-medium max-w-xs">
                        {isCurrentSuper ? (
                          <span className="text-purple-900 font-semibold">
                            Full Control: Role assignments, Zoom sync, Themes, Media, Outreach & Settings.
                          </span>
                        ) : (
                          <span>
                            Daily Attendance, Live Guest Roster, Themes, Sermons & Testimony Moderation.
                          </span>
                        )}
                      </td>

                      {/* Actions (for Super Admin) */}
                      {isSuperAdmin && (
                        <td className="p-5 text-right">
                          {isRootAdmin ? (
                            <span className="text-[11px] font-bold text-gray-400 italic">Protected</span>
                          ) : (
                            <div className="flex items-center justify-end space-x-2">
                              {/* Quick Role Dropdown */}
                              <select
                                value={admin.role}
                                onChange={(e) => handleChangeRole(admin, e.target.value as any)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl border border-gray-200 outline-none cursor-pointer"
                              >
                                <option value="admin_assistant">Admin Assistant</option>
                                <option value="super_admin">Super Admin</option>
                                <option value="member">Demote to Member</option>
                              </select>

                              {/* Remove/Demote Button */}
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to revoke admin permissions for ${admin.email}?`)) {
                                    handleChangeRole(admin, 'member');
                                  }
                                }}
                                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors"
                                title="Revoke Admin Permissions"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD ADMINISTRATOR MODAL */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <div>
                <h4 className="text-xl font-black text-[#1A1F3C] flex items-center space-x-2">
                  <UserPlus size={20} className="text-[#F26522]" />
                  <span>Add New Administrator</span>
                </h4>
                <p className="text-xs text-gray-400 font-medium">Grant staff administrative permissions.</p>
              </div>
              <button 
                onClick={() => setShowAddAdminModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* Feedback Alert */}
            {feedback && (
              <div className={`p-4 rounded-2xl text-xs font-bold flex items-center space-x-2 ${
                feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {feedback.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-red-600 shrink-0" />}
                <span>{feedback.message}</span>
              </div>
            )}

            <form onSubmit={handleAddAdmin} className="space-y-5">
              {/* Promotion Mode Toggle */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-2">
                  Select Method
                </label>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setNewAdminMode('select_member')}
                    className={`py-2.5 text-xs font-black uppercase rounded-xl transition-all ${
                      newAdminMode === 'select_member' ? 'bg-white text-[#1A1F3C] shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    From Members List
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAdminMode('email')}
                    className={`py-2.5 text-xs font-black uppercase rounded-xl transition-all ${
                      newAdminMode === 'email' ? 'bg-white text-[#1A1F3C] shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    By Email Address
                  </button>
                </div>
              </div>

              {/* Mode 1: Select Registered Member */}
              {newAdminMode === 'select_member' ? (
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                    Select Member to Promote *
                  </label>
                  <select
                    value={selectedMemberUid}
                    onChange={(e) => setSelectedMemberUid(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522]"
                  >
                    <option value="">-- Choose a registered member ({regularMembers.length} available) --</option>
                    {regularMembers.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.email}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-gray-400 font-medium mt-1 block">
                    Only regular members are listed here.
                  </span>
                </div>
              ) : (
                /* Mode 2: Add by Email */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                      Administrator Email Address *
                    </label>
                    <input 
                      type="email" 
                      required
                      placeholder="e.g. colleague@gmail.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522]"
                    />
                  </div>
                </div>
              )}

              {/* Role Level Selection */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-2">
                  Administrative Role Level *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Admin Assistant */}
                  <label className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                    newAdminRole === 'admin_assistant'
                      ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-blue-700 font-black text-xs uppercase tracking-wider">
                        <ShieldCheck size={16} />
                        <span>Admin Assistant</span>
                      </div>
                      <input 
                        type="radio" 
                        name="adminRole" 
                        checked={newAdminRole === 'admin_assistant'}
                        onChange={() => setNewAdminRole('admin_assistant')}
                        className="text-blue-600"
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                      Manages daily attendance, live guest rosters, weekly themes, outreach projects, and media teachings.
                    </p>
                  </label>

                  {/* Super Admin */}
                  <label className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                    newAdminRole === 'super_admin'
                      ? 'border-purple-500 bg-purple-50/50 ring-2 ring-purple-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-purple-700 font-black text-xs uppercase tracking-wider">
                        <Crown size={16} />
                        <span>Super Admin</span>
                      </div>
                      <input 
                        type="radio" 
                        name="adminRole" 
                        checked={newAdminRole === 'super_admin'}
                        onChange={() => setNewAdminRole('super_admin')}
                        className="text-purple-600"
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                      Full administrative authority, including adding other administrators, system branding, and user permissions.
                    </p>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-3 bg-[#F26522] text-white rounded-xl font-black uppercase text-xs hover:bg-[#d9561a] shadow-lg shadow-[#F26522]/20 disabled:opacity-50 transition-all flex items-center space-x-2"
                >
                  <UserPlus size={16} />
                  <span>{actionLoading ? 'Processing...' : 'Grant Admin Role'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Admin Password Modal */}
      {showChangePassModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 bg-[#1A1F3C] text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#F26522]/20 flex items-center justify-center text-[#F26522]">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg">Change Admin Password</h3>
                  <p className="text-xs text-gray-300">{profile?.email}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowChangePassModal(false);
                  setPassChangeError(null);
                  setPassChangeSuccess(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                Update your custom personal password used to access the Light Up Administrator Portal.
              </p>

              {passChangeError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl flex items-center space-x-2">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span>{passChangeError}</span>
                </div>
              )}

              {passChangeSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center space-x-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{passChangeSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  New Admin Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    placeholder="Enter new password (min. 4 chars)"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={confirmPasswordValue}
                    onChange={(e) => setConfirmPasswordValue(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowChangePassModal(false)}
                  className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passChangeLoading}
                  className="px-6 py-3 bg-[#F26522] text-white rounded-xl font-black uppercase text-xs hover:bg-[#d9561a] shadow-lg shadow-[#F26522]/20 disabled:opacity-50 transition-all flex items-center space-x-2 cursor-pointer"
                >
                  {passChangeLoading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Key size={16} />
                  )}
                  <span>{passChangeLoading ? 'Saving...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
