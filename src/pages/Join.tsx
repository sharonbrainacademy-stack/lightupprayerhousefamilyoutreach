/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { UserPlus, LogIn, MessageSquare, CheckCircle2, Flame, Globe, MessageCircle, Save, Video, Share2, Copy, Check, ExternalLink, Lock, ShieldCheck } from 'lucide-react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { markAttendanceForToday, getTodayDateString } from '../lib/attendance';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { getWhatsAppConfig, recordWhatsAppGroupJoin, isWhatsAppReferral, generateWhatsAppShareUrl, getPublicOrigin } from '../lib/whatsapp';
import { useZoomSession } from '../lib/ZoomContext';

export default function Join() {
  const { user, login, profile, authError, isLoggingIn } = useAuth();
  const { launchZoom, isMeetingActive, formatTime, activeSeconds } = useZoomSession();
  const [activeTab, setActiveTab] = useState<'register' | 'testimony'>('register');
  
  // Registration additional details state
  const [country, setCountry] = useState(profile?.country || '');
  const [timezone, setTimezone] = useState(profile?.timezone || 'WAT (Nigeria)');
  const [phone, setPhone] = useState(profile?.phone || (profile?.whatsappGroup && /^\+?[0-9\s\-()]{7,}$/.test(profile.whatsappGroup) ? profile.whatsappGroup : ''));
  const [preferredGroup, setPreferredGroup] = useState(profile?.whatsappGroupName || profile?.whatsappCommunity || (profile?.whatsappGroup && !/^\+?[0-9\s\-()]{7,}$/.test(profile.whatsappGroup) ? profile.whatsappGroup : '') || 'Global / International');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMessage, setProfileSavedMessage] = useState('');
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [attendanceNotice, setAttendanceNotice] = useState('');

  // WhatsApp group state & referral links
  const [whatsappGroups, setWhatsappGroups] = useState([
    { name: "Esther’s Group (Benin)", link: "https://chat.whatsapp.com/LightUpPrayerBenin" },
    { name: "King David’s Group (Lagos)", link: "https://chat.whatsapp.com/LightUpPrayerLagos" },
    { name: "Joyful Group (Abuja)", link: "https://chat.whatsapp.com/LightUpPrayerAbuja" },
    { name: "Grace Group (Asaba)", link: "https://chat.whatsapp.com/LightUpPrayerAsaba" },
    { name: "Global / International", link: "https://chat.whatsapp.com/LightUpPrayerGlobal" },
  ]);
  const [copiedLink, setCopiedLink] = useState(false);
  const isFromWhatsapp = isWhatsAppReferral();

  useEffect(() => {
    getWhatsAppConfig().then(cfg => {
      if (cfg.regionalGroups) {
        setWhatsappGroups([
          { name: "Esther’s Group (Benin)", link: cfg.regionalGroups.esther_benin || cfg.regionalGroups.west_africa || "https://chat.whatsapp.com/LightUpPrayerBenin" },
          { name: "King David’s Group (Lagos)", link: cfg.regionalGroups.king_david_lagos || "https://chat.whatsapp.com/LightUpPrayerLagos" },
          { name: "Joyful Group (Abuja)", link: cfg.regionalGroups.joyful_abuja || "https://chat.whatsapp.com/LightUpPrayerAbuja" },
          { name: "Grace Group (Asaba)", link: cfg.regionalGroups.grace_asaba || cfg.regionalGroups.europe_uk || "https://chat.whatsapp.com/LightUpPrayerAsaba" },
          { name: "Global / International", link: cfg.regionalGroups.global || "https://chat.whatsapp.com/LightUpPrayerGlobal" },
        ]);
      }
    });
  }, []);

  const handleJoinWhatsAppClick = (groupName: string, link: string) => {
    setPreferredGroup(groupName);
    recordWhatsAppGroupJoin(groupName, link, user ? { uid: user.uid, displayName: profile?.displayName, email: user.email } : null);
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const handleCopyReferralLink = () => {
    const url = `${getPublicOrigin()}/join?source=whatsapp`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const todayStr = getTodayDateString();
  const isAttendedToday = Boolean(
    profile?.attendanceDaysList?.includes(todayStr) || profile?.lastAttendedDate === todayStr
  );

  const handleMarkToday = async () => {
    if (!user) return;
    setMarkingAttendance(true);
    setAttendanceNotice('');
    const res = await markAttendanceForToday(user.uid);
    setMarkingAttendance(false);
    if (res.success) {
      if (res.isNewDay) {
        setAttendanceNotice(`✓ Praise God! Attendance recorded for today (${todayStr}). Total: ${res.newCount} sessions.`);
      } else {
        setAttendanceNotice(`✓ Attendance is already recorded for today (${todayStr}). Total: ${res.newCount} sessions.`);
      }
      setTimeout(() => setAttendanceNotice(''), 5000);
    }
  };

  // Testimony state
  const [testimonyName, setTestimonyName] = useState('');
  const [category, setCategory] = useState<'Healing' | 'Deliverance' | 'Provision' | 'Restoration' | 'Other'>('Healing');
  const [story, setStory] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submittingTestimony, setSubmittingTestimony] = useState(false);
  const [testimonySuccess, setTestimonySuccess] = useState('');



  useEffect(() => {
    if (profile) {
      if (profile.country) setCountry(profile.country);
      if (profile.timezone) setTimezone(profile.timezone);
      if (profile.phone) {
        setPhone(profile.phone);
      } else if (profile.whatsappGroup && /^\+?[0-9\s\-()]{7,}$/.test(profile.whatsappGroup)) {
        setPhone(profile.whatsappGroup);
      }
      if (profile.whatsappGroupName) {
        setPreferredGroup(profile.whatsappGroupName);
      } else if (profile.whatsappCommunity) {
        setPreferredGroup(profile.whatsappCommunity);
      } else if (profile.whatsappGroup && !/^\+?[0-9\s\-()]{7,}$/.test(profile.whatsappGroup)) {
        setPreferredGroup(profile.whatsappGroup);
      }
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please register/sign in with Google first.');
      return;
    }
    setSavingProfile(true);
    setProfileSavedMessage('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        country,
        timezone,
        phone,
        whatsappGroup: preferredGroup,
        whatsappGroupName: preferredGroup,
        whatsappCommunity: preferredGroup,
      });
      setProfileSavedMessage(`✓ Profile updated! The Church Admin will verify and add ${phone || 'your phone'} to ${preferredGroup} on WhatsApp.`);
      setTimeout(() => setProfileSavedMessage(''), 6000);
    } catch (err) {
      console.error('Error saving profile:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitTestimony = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in with Google to share a testimony.');
      return;
    }
    if (!story.trim()) {
      alert('Please write your testimony story.');
      return;
    }
    setSubmittingTestimony(true);
    setTestimonySuccess('');
    try {
      await addDoc(collection(db, 'testimonies'), {
        userId: user.uid,
        name: isAnonymous ? 'Anonymous' : (testimonyName || profile?.displayName || 'Member'),
        country: country || 'International',
        category,
        text: story,
        status: 'pending',
        isAnonymous,
        createdAt: serverTimestamp(),
      });
      setTestimonySuccess('Your testimony has been submitted for review! Praise God!');
      setStory('');
      setTestimonyName('');
      setTimeout(() => setTestimonySuccess(''), 5000);
    } catch (err) {
      console.error('Error submitting testimony:', err);
      handleFirestoreError(err, OperationType.CREATE, 'testimonies');
    } finally {
      setSubmittingTestimony(false);
    }
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <section className="bg-[#1A1F3C] py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h1 className="text-5xl font-black text-white uppercase tracking-tight">Join Our <span className="text-[#F26522]">Family</span></h1>
          <p className="text-gray-400 max-w-2xl mx-auto font-medium">
            Be part of a global movement of prayer and transformation. Register to connect with a regional community.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Left: Info & WhatsApp */}
          <div className="lg:w-1/3 space-y-12">
            <div className="space-y-6">
              <h2 className="text-3xl font-black text-[#1A1F3C]">Why Join Us?</h2>
              <div className="space-y-4">
                {[
                  "Placement in assigned regional WhatsApp prayer cells (added by Admin)",
                  "Daily prayer reminders & prayer points",
                  "Personal spiritual mentorship & leadership care",
                  "Community support and daily fellowship",
                  "Opportunities to serve in global kingdom missions"
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-start space-x-3">
                    <div className="mt-1"><CheckCircle2 className="w-5 h-5 text-[#F26522]" /></div>
                    <p className="text-gray-600 font-medium">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-[#1A1F3C] uppercase tracking-tight">WhatsApp Prayer Cells</h2>
                  <p className="text-gray-500 text-xs font-medium mt-0.5">Admin-Gated Regional Fellowships</p>
                </div>
                {isFromWhatsapp && (
                  <span className="px-2.5 py-1 bg-[#25D366]/10 text-[#25D366] rounded-full text-[10px] font-black uppercase border border-[#25D366]/20">
                    Referred via WhatsApp
                  </span>
                )}
              </div>

              {/* Policy note: closed to general public, added by admin */}
              <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl space-y-1.5">
                <div className="flex items-center space-x-2 text-emerald-900 font-black text-xs uppercase tracking-wider">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>Admin-Added Communities</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                  To protect community integrity, order, and spiritual focus, direct public join links are closed. Register on this page with your active WhatsApp number, and the church admin will add you to your assigned regional prayer cell.
                </p>
              </div>

              {/* Regional Communities list */}
              <div className="space-y-3">
                {whatsappGroups.map((group, idx) => {
                  const isAssigned = user && (profile?.whatsappGroupName === group.name || profile?.whatsappCommunity === group.name || preferredGroup === group.name);
                  return (
                    <div 
                      key={idx} 
                      className={cn(
                        "w-full text-left flex items-center justify-between p-4 bg-white rounded-2xl border transition-all",
                        isAssigned ? "border-emerald-400 ring-2 ring-emerald-100 bg-emerald-50/40 shadow-sm" : "border-gray-100 shadow-sm"
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={cn(
                          "p-2.5 rounded-xl",
                          isAssigned ? "bg-emerald-500 text-white shadow-sm" : "bg-[#25D366]/10 text-[#25D366]"
                        )}>
                          <MessageCircle size={18} />
                        </div>
                        <div>
                          <span className="font-black text-[#1A1F3C] text-sm block">{group.name}</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Regional Prayer Cell</span>
                        </div>
                      </div>
                      <div>
                        {isAssigned ? (
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-100/90 px-3 py-1.5 rounded-xl inline-flex items-center space-x-1 border border-emerald-200">
                            <CheckCircle2 size={12} className="text-emerald-700" />
                            <span>Your Group</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-xl inline-flex items-center space-x-1 border border-gray-200/60">
                            <Lock size={11} className="text-gray-400" />
                            <span>Admin Added</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* WhatsApp Share & Referral Link Tool */}
              <div className="p-5 bg-gradient-to-br from-[#1A1F3C] to-[#252b4d] text-white rounded-2xl space-y-3 border border-white/10 shadow-lg">
                <div className="flex items-center space-x-2 text-[#F26522]">
                  <Share2 size={18} />
                  <h3 className="text-xs font-black uppercase tracking-wider">Invite Believers to Register</h3>
                </div>
                <p className="text-xs text-gray-300 font-medium leading-relaxed">
                  Share our registration link with family, prayer partners, and friends so they can join daily live prayers and get assigned to a WhatsApp prayer cell.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <a
                    href={generateWhatsAppShareUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-md"
                  >
                    <MessageCircle size={15} />
                    <span>Share on WhatsApp</span>
                  </a>
                  <button
                    onClick={handleCopyReferralLink}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 border border-white/20 transition-all cursor-pointer"
                  >
                    {copiedLink ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Forms */}
          <div className="lg:w-2/3 bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
            <div className="flex border-b border-gray-100">
              <button 
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-6 font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center space-x-2 ${activeTab === 'register' ? 'bg-[#1A1F3C] text-white' : 'text-gray-400 hover:text-[#1A1F3C]'}`}
              >
                <UserPlus size={16} />
                <span>Membership Registration</span>
              </button>
              <button 
                onClick={() => setActiveTab('testimony')}
                className={`flex-1 py-6 font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center space-x-2 ${activeTab === 'testimony' ? 'bg-[#1A1F3C] text-white' : 'text-gray-400 hover:text-[#1A1F3C]'}`}
              >
                <MessageSquare size={16} />
                <span>Share Testimony</span>
              </button>
            </div>

            <div className="p-12">
              {activeTab === 'register' ? (
                <div className="space-y-8">
                  {user ? (
                    <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-3xl text-center space-y-4">
                      <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                        <CheckCircle2 size={32} />
                      </div>
                      <h3 className="text-2xl font-black text-emerald-900">You are Registered!</h3>
                      <p className="text-emerald-700 font-medium">Welcome to the family, {profile?.displayName}. Your spiritual journey continues here.</p>
                      
                      <div className="pt-4 grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white rounded-2xl shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Attendance</p>
                          <p className="text-2xl font-black text-[#1A1F3C]">{profile?.attendanceCount || 0} Sessions</p>
                        </div>
                        <div className="p-4 bg-white rounded-2xl shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Joined</p>
                          <p className="text-lg font-black text-[#1A1F3C]">{profile?.joinedAt ? new Date(profile.joinedAt).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>

                      {/* WhatsApp Onboarding Card */}
                      <div className="p-5 bg-white rounded-2xl border border-emerald-200/80 text-left space-y-2.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                            <MessageCircle size={14} className="text-[#25D366]" />
                            <span>Assigned WhatsApp Community</span>
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-md flex items-center space-x-1 border border-emerald-200">
                            <ShieldCheck size={11} className="text-emerald-700" />
                            <span>Admin Managed</span>
                          </span>
                        </div>
                        <p className="text-lg font-black text-[#1A1F3C]">
                          {preferredGroup || profile?.whatsappGroupName || profile?.whatsappCommunity || 'Global / International'}
                        </p>
                        <p className="text-xs text-gray-600 font-medium leading-relaxed">
                          {phone ? (
                            <span>Registered WhatsApp phone: <strong className="font-mono text-[#1A1F3C] font-bold">{phone}</strong>. Our church administrator will add you directly to this prayer cell.</span>
                          ) : (
                            <span className="text-amber-800 font-bold bg-amber-50 px-2 py-1 rounded border border-amber-200 block">
                              ⚠️ Please enter your WhatsApp phone number below so our church administrator can add you to the group.
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={(e) => launchZoom(e)}
                          className="w-full py-3.5 bg-[#F26522] text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 hover:bg-[#d9561a] transition-all shadow-md cursor-pointer"
                        >
                          <Video size={16} />
                          <span>
                            {isMeetingActive
                              ? `In Zoom (${formatTime(activeSeconds)})`
                              : "Join Daily Zoom Prayer Meeting"}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="text-center space-y-4">
                        <p className="text-gray-500 font-medium">To join the movement, receive your WhatsApp prayer cell assignment, and keep your lifetime attendance record, please sign in with your Google account.</p>
                        {authError && (
                          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl max-w-md mx-auto">
                            {authError}
                          </div>
                        )}
                        <button 
                          onClick={login}
                          disabled={isLoggingIn}
                          className="w-full sm:w-auto px-12 py-5 bg-[#F26522] disabled:opacity-60 text-white rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center space-x-3 hover:shadow-xl hover:shadow-[#F26522]/30 transition-all mx-auto cursor-pointer"
                        >
                          <LogIn size={20} />
                          <span>{isLoggingIn ? 'Connecting...' : 'Register with Google'}</span>
                        </button>
                      </div>

                      {/* Guest / Visitor Quick Option */}
                      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-6 text-center space-y-3">
                        <p className="text-xs font-bold text-amber-900">Visiting as a Guest or First-Time Visitor?</p>
                        <p className="text-xs text-amber-700">You can participate in today's Zoom prayer session directly without creating an account.</p>
                        <button
                          onClick={(e) => launchZoom(e)}
                          className="w-full py-3.5 bg-[#1A1F3C] text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 hover:bg-[#252c54] transition-all shadow cursor-pointer"
                        >
                          <Video size={16} />
                          <span>{isMeetingActive ? `In Zoom (${formatTime(activeSeconds)})` : "Join Daily Zoom As Guest Visitor"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile} className="space-y-6 pt-8 border-t border-gray-100">
                    <div>
                      <h3 className="text-sm font-black text-[#1A1F3C] uppercase tracking-widest">Profile & WhatsApp Cell Preferences</h3>
                      <p className="text-xs text-gray-500 font-medium mt-1">Provide your details so church administration can assign and add you to your WhatsApp community.</p>
                    </div>
                    {profileSavedMessage && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-2">
                        <CheckCircle2 size={16} />
                        <span>{profileSavedMessage}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-gray-400">Country</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Nigeria" 
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full px-6 py-4 rounded-xl border-2 border-gray-100 outline-none focus:border-[#F26522] font-medium" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-gray-400">Timezone</label>
                        <select 
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className="w-full px-6 py-4 rounded-xl border-2 border-gray-100 outline-none focus:border-[#F26522] font-bold"
                        >
                          <option value="WAT (Nigeria)">WAT (Nigeria)</option>
                          <option value="EST (USA/Canada)">EST (USA/Canada)</option>
                          <option value="GMT (UK)">GMT (UK)</option>
                          <option value="CAT/EAT (East/Central Africa)">CAT/EAT (East/Central Africa)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-gray-400">Phone Number (WhatsApp)</label>
                        <input 
                          type="tel" 
                          placeholder="+234..." 
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-6 py-4 rounded-xl border-2 border-gray-100 outline-none focus:border-[#F26522] font-medium" 
                        />
                        <p className="text-[11px] text-gray-500 font-medium">Enter your active WhatsApp number with country code (e.g. +234 801 234 5678). Used by the admin to add you.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-gray-400">WhatsApp Community / Region</label>
                        <select 
                          value={preferredGroup}
                          onChange={(e) => setPreferredGroup(e.target.value)}
                          className="w-full px-6 py-4 rounded-xl border-2 border-gray-100 outline-none focus:border-[#F26522] font-bold"
                        >
                          <option value="Esther’s Group (Benin)">Esther’s Group (Benin)</option>
                          <option value="King David’s Group (Lagos)">King David’s Group (Lagos)</option>
                          <option value="Joyful Group (Abuja)">Joyful Group (Abuja)</option>
                          <option value="Grace Group (Asaba)">Grace Group (Asaba)</option>
                          <option value="Global / International">Global / International</option>
                        </select>
                        <p className="text-[11px] text-gray-500 font-medium">Select your regional prayer cell. The Admin will assign and add you to this group.</p>
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={savingProfile}
                      className="w-full py-4 bg-[#1A1F3C] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#252b4d] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                    >
                      <Save size={18} />
                      <span>{savingProfile ? 'Saving...' : 'Save Profile Information'}</span>
                    </button>
                  </form>
                </div>
              ) : (
                <form onSubmit={handleSubmitTestimony} className="space-y-8">
                  {testimonySuccess && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-2">
                      <CheckCircle2 size={16} />
                      <span>{testimonySuccess}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400">Full Name</label>
                      <input 
                        type="text" 
                        placeholder={profile?.displayName || "Your Name"} 
                        value={testimonyName}
                        onChange={(e) => setTestimonyName(e.target.value)}
                        className="w-full px-6 py-4 rounded-xl border-2 border-gray-100 outline-none focus:border-[#F26522] font-medium" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400">Category</label>
                      <select 
                        value={category}
                        onChange={(e) => setCategory(e.target.value as any)}
                        className="w-full px-6 py-4 rounded-xl border-2 border-gray-100 outline-none focus:border-[#F26522] font-bold"
                      >
                        <option value="Healing">Healing</option>
                        <option value="Deliverance">Deliverance</option>
                        <option value="Provision">Provision</option>
                        <option value="Restoration">Restoration</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Your Story</label>
                    <textarea 
                      placeholder="Share what God has done for you..." 
                      value={story}
                      onChange={(e) => setStory(e.target.value)}
                      className="w-full px-6 py-4 rounded-xl border-2 border-gray-100 outline-none focus:border-[#F26522] font-medium h-48"
                    ></textarea>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input 
                      type="checkbox" 
                      id="anonymous" 
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-[#F26522] focus:ring-[#F26522]" 
                    />
                    <label htmlFor="anonymous" className="text-sm font-bold text-gray-600">Share as Anonymous</label>
                  </div>
                  <button 
                    type="submit" 
                    disabled={submittingTestimony}
                    className="w-full py-5 bg-[#F26522] text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-[#F26522]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {submittingTestimony ? 'Submitting...' : 'Submit Testimony for Review'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
