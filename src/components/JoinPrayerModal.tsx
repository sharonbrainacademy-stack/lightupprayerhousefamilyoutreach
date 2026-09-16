/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, UserCheck, Users, Flame, Video, CheckCircle2, 
  ArrowRight, ShieldCheck, Globe, Phone, Mail, User, 
  Sparkles, Heart, Check, ExternalLink, LogIn, ChevronRight
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useZoomSession } from '../lib/ZoomContext';
import { WHATSAPP_COMMUNITY_OPTIONS } from '../lib/whatsapp';

interface JoinPrayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'member' | 'visitor';
}

export function JoinPrayerModal({ isOpen, onClose, defaultTab = 'visitor' }: JoinPrayerModalProps) {
  const { user, profile, login, authError, isLoggingIn } = useAuth();
  const { 
    launchZoom, 
    guestName, 
    guestPhone, 
    setGuestName, 
    setGuestPhone,
    yearlySeconds,
    formatTime,
    saveMemberRegistration,
    localMemberProfile,
  } = useZoomSession();

  const [activeTab, setActiveTab] = useState<'member' | 'visitor'>(defaultTab);

  // Visitor Form State
  const [visitorName, setVisitorName] = useState(guestName || localStorage.getItem('zoom_guest_name') || '');
  const [visitorPhone, setVisitorPhone] = useState(guestPhone || localStorage.getItem('zoom_guest_phone') || '');
  const [visitorCountry, setVisitorCountry] = useState(localStorage.getItem('zoom_guest_country') || '');

  // Member Registration Form State
  const [memberName, setMemberName] = useState(
    profile?.displayName || localMemberProfile?.displayName || visitorName || ''
  );
  const [memberEmail, setMemberEmail] = useState(
    user?.email || profile?.email || localMemberProfile?.email || ''
  );
  const [memberPhone, setMemberPhone] = useState(
    profile?.phone || localMemberProfile?.phone || visitorPhone || ''
  );
  const [memberCountry, setMemberCountry] = useState(
    profile?.country || localMemberProfile?.country || visitorCountry || 'Nigeria'
  );
  const [memberCommunity, setMemberCommunity] = useState(
    profile?.whatsappCommunity || profile?.whatsappGroupName || localMemberProfile?.whatsappCommunity || 'Global Prayer Altar'
  );
  const [isRegisteringMember, setIsRegisteringMember] = useState(false);
  const [regSuccessMessage, setRegSuccessMessage] = useState('');
  const [regErrorMessage, setRegErrorMessage] = useState('');

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      const storedGuestName = guestName || localStorage.getItem('zoom_guest_name') || '';
      const storedGuestPhone = guestPhone || localStorage.getItem('zoom_guest_phone') || '';
      const storedCountry = localStorage.getItem('zoom_guest_country') || '';
      
      setVisitorName(storedGuestName);
      setVisitorPhone(storedGuestPhone);
      setVisitorCountry(storedCountry);

      if (profile?.displayName || localMemberProfile?.displayName) {
        setMemberName(profile?.displayName || localMemberProfile?.displayName || '');
      } else if (storedGuestName && !memberName) {
        setMemberName(storedGuestName);
      }

      if (profile?.email || localMemberProfile?.email || user?.email) {
        setMemberEmail(profile?.email || localMemberProfile?.email || user?.email || '');
      }

      if (profile?.phone || localMemberProfile?.phone) {
        setMemberPhone(profile?.phone || localMemberProfile?.phone || '');
      } else if (storedGuestPhone && !memberPhone) {
        setMemberPhone(storedGuestPhone);
      }

      if (profile?.country || localMemberProfile?.country) {
        setMemberCountry(profile?.country || localMemberProfile?.country || 'Nigeria');
      }

      if (defaultTab) {
        setActiveTab(defaultTab);
      }
    }
  }, [isOpen, defaultTab, profile, localMemberProfile, user, guestName, guestPhone]);

  if (!isOpen) return null;

  const isAlreadyRegisteredMember = Boolean(
    user || profile?.displayName || localMemberProfile?.isRegistered
  );

  const effectiveDisplayName = profile?.displayName || localMemberProfile?.displayName || user?.displayName;

  // Handle Visitor launch
  const handleContinueAsVisitor = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = visitorName.trim() || 'Visitor';
    const cleanPhone = visitorPhone.trim();
    
    setGuestName(cleanName);
    setGuestPhone(cleanPhone);
    if (visitorCountry) {
      localStorage.setItem('zoom_guest_country', visitorCountry.trim());
    }

    onClose();
    launchZoom(undefined, false, cleanName, cleanPhone);
  };

  // Handle Member Registration submission
  const handleMemberRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) {
      setRegErrorMessage('Please enter your full name.');
      return;
    }
    if (!memberEmail.trim()) {
      setRegErrorMessage('Please enter your email address.');
      return;
    }

    setIsRegisteringMember(true);
    setRegErrorMessage('');
    setRegSuccessMessage('');

    try {
      const result = await saveMemberRegistration({
        displayName: memberName.trim(),
        email: memberEmail.trim().toLowerCase(),
        phone: memberPhone.trim(),
        country: memberCountry.trim(),
        whatsappCommunity: memberCommunity.trim(),
        whatsappGroupName: memberCommunity.trim(),
      });

      if (result.success) {
        setRegSuccessMessage('🎉 Membership registration successful! Welcome to Light Up Prayer House family.');
        setTimeout(() => {
          onClose();
          launchZoom(undefined, false, memberName.trim(), memberPhone.trim());
        }, 1200);
      } else {
        setRegErrorMessage(result.error || 'Failed to complete registration. Please try again.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setRegErrorMessage(err?.message || 'Could not complete registration. Please check your connection.');
    } finally {
      setIsRegisteringMember(false);
    }
  };

  // Switch to Member Registration from Visitor view
  const handleSwitchToMemberReg = () => {
    if (visitorName && !memberName) setMemberName(visitorName);
    if (visitorPhone && !memberPhone) setMemberPhone(visitorPhone);
    if (visitorCountry && !memberCountry) setMemberCountry(visitorCountry);
    setActiveTab('member');
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-[#1A1F3C]/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-gray-100 z-10"
      >
        {/* Modal Header */}
        <div className="bg-[#1A1F3C] text-white p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Flame size={120} />
          </div>

          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-[#F26522]/20 border border-[#F26522]/40 text-[#F26522] text-[10px] font-black uppercase tracking-widest">
                <Flame size={12} className="fill-current" />
                <span>Daily Prayer Altar</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight">Join Daily Prayer Meeting</h2>
              <p className="text-xs text-gray-300">
                Live intercession every weekday at 5:00 AM WAT
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-gray-300 hover:text-white cursor-pointer"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Switcher: Member vs Visitor */}
          <div className="grid grid-cols-2 gap-2 mt-5 p-1.5 bg-white/10 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('member')}
              className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'member'
                  ? 'bg-[#F26522] text-white shadow-lg shadow-[#F26522]/30'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <UserCheck size={16} />
              <span>I am a Member</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('visitor')}
              className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'visitor'
                  ? 'bg-[#F26522] text-white shadow-lg shadow-[#F26522]/30'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users size={16} />
              <span>I am a Visitor</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* TAB 1: MEMBER FLOW */}
          {activeTab === 'member' && (
            <div className="space-y-6">
              {isAlreadyRegisteredMember ? (
                /* Already Registered Member View */
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-6 text-center space-y-4">
                  <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 size={30} />
                  </div>
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-full">
                      Verified Member
                    </span>
                    <h3 className="text-xl font-black text-emerald-950">
                      Welcome, {effectiveDisplayName || 'Valued Member'}!
                    </h3>
                    <p className="text-xs text-emerald-800 font-medium">
                      Your membership is registered. Your prayer minutes and attendance will be automatically credited to your altar record.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        launchZoom(undefined, false, effectiveDisplayName, profile?.phone || localMemberProfile?.phone);
                      }}
                      className="w-full py-4 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[#F26522]/30 flex items-center justify-center space-x-2 transition-all cursor-pointer hover:scale-[1.01]"
                    >
                      <Video size={16} />
                      <span>Enter Prayer Meeting Now</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  <div className="flex items-center justify-center space-x-4 pt-2 text-[11px] text-gray-500">
                    <span>Community: <strong className="text-gray-700">{profile?.whatsappCommunity || localMemberProfile?.whatsappCommunity || 'Global Altar'}</strong></span>
                  </div>
                </div>
              ) : (
                /* One-Time Member Registration Form */
                <div className="space-y-5">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-[#F26522]">
                      <ShieldCheck size={18} />
                      <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F3C]">
                        One-Time Member Registration
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Please register once to join the Light Up Prayer House family. This secures your lifetime prayer log, assigns you to a prayer altar, and remembers you on all future prayer sessions.
                    </p>
                  </div>

                  {/* Google Quick Sign-In Alternative */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-center space-y-2.5">
                    <p className="text-[11px] font-bold text-gray-600">Have a Google Account? Instant 1-Click Registration:</p>
                    <button
                      type="button"
                      disabled={isLoggingIn}
                      onClick={async () => {
                        const success = await login();
                        if (success) {
                          setRegSuccessMessage('Signed in successfully! Launching prayer...');
                          setTimeout(() => {
                            onClose();
                            launchZoom();
                          }, 1000);
                        }
                      }}
                      className="w-full py-2.5 px-4 bg-white hover:bg-gray-100 disabled:opacity-60 text-gray-800 border border-gray-300 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
                    >
                      <LogIn size={15} className="text-[#F26522]" />
                      <span>{isLoggingIn ? 'Signing in...' : 'Register with Google Account'}</span>
                    </button>
                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-gray-200"></div>
                      <span className="flex-shrink mx-2 text-[10px] text-gray-400 font-bold uppercase">Or Fill Quick Form</span>
                      <div className="flex-grow border-t border-gray-200"></div>
                    </div>
                  </div>

                  {(regErrorMessage || authError) && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
                      {regErrorMessage || authError}
                    </div>
                  )}

                  {regSuccessMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-2">
                      <CheckCircle2 size={16} />
                      <span>{regSuccessMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleMemberRegistrationSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          required
                          value={memberName}
                          onChange={(e) => setMemberName(e.target.value)}
                          placeholder="e.g. Sister Grace Oladipo / Bro Emmanuel"
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold text-[#1A1F3C] outline-none focus:border-[#F26522] focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="email"
                            required
                            value={memberEmail}
                            onChange={(e) => setMemberEmail(e.target.value)}
                            placeholder="your.email@example.com"
                            className="w-full pl-10 pr-3 py-3 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold text-[#1A1F3C] outline-none focus:border-[#F26522] focus:bg-white transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          WhatsApp / Phone
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="tel"
                            value={memberPhone}
                            onChange={(e) => setMemberPhone(e.target.value)}
                            placeholder="+234 800 000 0000"
                            className="w-full pl-10 pr-3 py-3 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold text-[#1A1F3C] outline-none focus:border-[#F26522] focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          Country of Residence
                        </label>
                        <div className="relative">
                          <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            value={memberCountry}
                            onChange={(e) => setMemberCountry(e.target.value)}
                            placeholder="e.g. Nigeria, United Kingdom, USA"
                            className="w-full pl-10 pr-3 py-3 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold text-[#1A1F3C] outline-none focus:border-[#F26522] focus:bg-white transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          WhatsApp Prayer Community
                        </label>
                        <select
                          value={memberCommunity}
                          onChange={(e) => setMemberCommunity(e.target.value)}
                          className="w-full px-3 py-3 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold text-[#1A1F3C] outline-none focus:border-[#F26522] focus:bg-white transition-all"
                        >
                          <option value="Global Prayer Altar">Global Prayer Altar</option>
                          <option value="Esther’s Group (Benin)">Esther’s Group (Benin)</option>
                          <option value="King David’s Group (Lagos)">King David’s Group (Lagos)</option>
                          <option value="Joyful Group (Abuja)">Joyful Group (Abuja)</option>
                          <option value="Grace Group (Asaba)">Grace Group (Asaba)</option>
                          <option value="Youth on Fire Altar">Youth on Fire Altar</option>
                          <option value="Men of Intercession">Men of Intercession</option>
                          <option value="Women of Grace & Power">Women of Grace & Power</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isRegisteringMember}
                      className="w-full py-4 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[#F26522]/30 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isRegisteringMember ? (
                        <span>Completing Registration...</span>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>Complete One-Time Registration & Join Prayer</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VISITOR FLOW */}
          {activeTab === 'visitor' && (
            <div className="space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 space-y-2">
                <div className="flex items-center space-x-2 text-amber-700">
                  <Sparkles size={18} />
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Welcome to Light Up Prayer House!
                  </h3>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                  We are delighted to have you fellowship with us today. As a visitor, you are warmly invited to lift up your voice with believers around the globe.
                </p>
              </div>

              {/* Continuous Opportunity to Become a Member Banner */}
              <div className="bg-gradient-to-br from-[#1A1F3C] to-[#2a3261] text-white p-5 rounded-2xl shadow-md space-y-3 border border-white/10">
                <div className="flex items-center space-x-2 text-[#F26522]">
                  <Heart size={18} className="fill-current text-[#F26522]" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">
                    Become a Full Member Anytime
                  </h4>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Continue today as an honored visitor, or complete a 1-minute registration to have your personal prayer milestones permanently recorded.
                </p>
                <button
                  type="button"
                  onClick={handleSwitchToMemberReg}
                  className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <span>Register as a Member (One-Time)</span>
                  <ChevronRight size={14} className="text-amber-400" />
                </button>
              </div>

              {/* Visitor Quick Form */}
              <form onSubmit={handleContinueAsVisitor} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Your Name / Greeting Title
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F26522]" size={16} />
                    <input
                      type="text"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="e.g. John / Sis Ruth (or Guest)"
                      className="w-full pl-11 pr-4 py-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold text-[#1A1F3C] outline-none focus:border-[#F26522] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Phone / WhatsApp
                      </label>
                      <span className="text-[9px] text-gray-400 font-bold uppercase">Optional</span>
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#F26522]" size={16} />
                      <input
                        type="tel"
                        value={visitorPhone}
                        onChange={(e) => setVisitorPhone(e.target.value)}
                        placeholder="+234 800 000 0000"
                        className="w-full pl-10 pr-3 py-3 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold text-[#1A1F3C] outline-none focus:border-[#F26522] focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        City / Country
                      </label>
                      <span className="text-[9px] text-gray-400 font-bold uppercase">Optional</span>
                    </div>
                    <div className="relative">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#F26522]" size={16} />
                      <input
                        type="text"
                        value={visitorCountry}
                        onChange={(e) => setVisitorCountry(e.target.value)}
                        placeholder="e.g. London, Lagos, Dallas"
                        className="w-full pl-10 pr-3 py-3 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold text-[#1A1F3C] outline-none focus:border-[#F26522] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-4 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[#F26522]/30 flex items-center justify-center space-x-2 transition-all cursor-pointer hover:scale-[1.01]"
                  >
                    <Video size={16} />
                    <span>Continue to Prayer Meeting as Visitor</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
