/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, MapPin, Phone, Mail, Share2, Camera, Video, User, Radio, Download, Smartphone, Sparkles, Flame, Heart, Gift } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useSiteBranding } from '../lib/settings';
import { cn } from '../lib/utils';
import { useZoomSession } from '../lib/ZoomContext';
import { motion, AnimatePresence } from 'motion/react';
import { InstallAppModal } from './InstallAppModal';
import { DonationModal } from './DonationModal';

const navItems = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'Beliefs', path: '/beliefs' },
  { name: 'Schedule', path: '/schedule' },
  { name: 'Themes', path: '/themes' },
  { name: '30-Day Scriptures', path: '/reading-plan' },
  { name: 'Outreach', path: '/outreach' },
  { name: 'Media', path: '/media' },
  { name: 'Membership', path: '/join' },
  { name: 'Contact', path: '/contact' },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const { user, profile, login, logout } = useAuth();
  const { isMeetingActive, activeSeconds, isGlobalMeetingLive, launchZoom, openJoinPrayerModal, formatTime } = useZoomSession();
  const branding = useSiteBranding();
  const location = useLocation();

  // Auto-close mobile menu on route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <nav className="sticky top-0 z-50 bg-[#1A1F3C] text-white border-b border-[#F26522]/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-2">
          {/* Logo Branding */}
          <Link to="/" className="flex items-center space-x-2.5 sm:space-x-3 group min-w-0 shrink">
            <div className="bg-white p-0.5 rounded-full transform group-hover:rotate-12 transition-transform overflow-hidden w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0 shadow-sm">
              <img 
                src={branding.logoUrl} 
                alt={`${branding.siteName} Logo`} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-black text-sm sm:text-base lg:text-lg leading-tight tracking-tight truncate">{branding.siteName}</span>
              <span className="text-[8px] sm:text-[9px] text-gray-300 uppercase tracking-[0.15em] sm:tracking-[0.2em] truncate">{branding.tagline}</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-0.5 xl:space-x-1 shrink-0">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "px-2 xl:px-2.5 py-1.5 rounded-md text-xs xl:text-sm font-medium transition-colors hover:text-[#F26522]",
                  location.pathname === item.path ? "text-[#F26522] bg-white/5 font-bold" : "text-gray-300"
                )}
              >
                {item.name}
              </Link>
            ))}

            {/* Header Action Buttons: Donate with Join Prayer placed under it */}
            <div className="flex flex-col space-y-1.5 ml-2 xl:ml-3 py-1">
              <button
                onClick={() => setShowDonateModal(true)}
                className="w-full px-3 py-1.5 bg-gradient-to-r from-amber-500 to-[#F26522] hover:from-amber-600 hover:to-[#d9561a] text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all shadow-sm hover:shadow-orange-500/20 cursor-pointer"
                title="Partner with us through donations & giving"
              >
                <Heart className="w-3.5 h-3.5 fill-current text-white/90" />
                <span>Donate</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (isMeetingActive) {
                    launchZoom(e);
                  } else {
                    openJoinPrayerModal('visitor');
                  }
                }}
                className={cn(
                  "w-full px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all shadow-sm cursor-pointer border",
                  isMeetingActive
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 animate-pulse"
                    : isGlobalMeetingLive
                    ? "bg-[#F26522] hover:bg-[#d9561a] text-white border-[#F26522] ring-2 ring-emerald-400/60"
                    : "bg-white/10 hover:bg-white/20 text-white border-white/20"
                )}
                title="Join Daily Prayer Session"
              >
                <Flame className="w-3 h-3 fill-current text-amber-400" />
                <span>
                  {isMeetingActive
                    ? `In Prayer (${formatTime(activeSeconds)})`
                    : isGlobalMeetingLive
                    ? "🟢 Live Prayer"
                    : "Join Prayer"}
                </span>
              </button>
            </div>
            
            {user ? (
              <div className="flex items-center space-x-3 ml-2 pl-2 border-l border-white/10">
                {profile?.role !== 'member' && (
                  <Link to="/admin" className="text-xs xl:text-sm font-semibold text-amber-400 hover:text-amber-300">
                    Admin
                  </Link>
                )}
                <button onClick={logout} className="text-xs xl:text-sm text-gray-400 hover:text-white cursor-pointer">Sign Out</button>
                <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-full bg-[#F26522] flex items-center justify-center font-black text-xs">
                  {profile?.displayName ? profile.displayName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                </div>
              </div>
            ) : (
              <button
                onClick={login}
                className="ml-2 px-3 py-1.5 bg-white/10 text-white border border-white/20 rounded-lg text-xs font-bold hover:bg-white/20 transition-all cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Mobile and Tablet Header Actions: Stacked Donate on top, Join Prayer underneath + Hamburger */}
          <div className="lg:hidden flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <div className="flex flex-col space-y-1">
              <button
                onClick={() => setShowDonateModal(true)}
                className="px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-[#F26522] text-white rounded-md text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1 shadow-sm cursor-pointer whitespace-nowrap"
                title="Partner with us through donations & giving"
              >
                <Heart className="w-2.5 h-2.5 fill-current shrink-0" />
                <span>Donate</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (isMeetingActive) {
                    launchZoom(e);
                  } else {
                    openJoinPrayerModal('visitor');
                  }
                }}
                className={cn(
                  "px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1 transition-all shadow-sm cursor-pointer border whitespace-nowrap",
                  isMeetingActive
                    ? "bg-emerald-600 text-white border-emerald-500 animate-pulse"
                    : isGlobalMeetingLive
                    ? "bg-[#F26522] text-white border-[#F26522]"
                    : "bg-white/10 text-white border-white/20"
                )}
                title="Join Daily Prayer Session"
              >
                <Flame className="w-2.5 h-2.5 fill-current text-amber-400 shrink-0" />
                <span>
                  {isMeetingActive
                    ? "In Prayer"
                    : isGlobalMeetingLive
                    ? "Live Prayer"
                    : "Join Prayer"}
                </span>
              </button>
            </div>

            {/* Hamburger Toggle Button */}
            <button
              onClick={() => setIsOpen(prev => !prev)}
              className="inline-flex items-center justify-center p-2.5 rounded-xl text-gray-200 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 focus:outline-none cursor-pointer shrink-0 min-w-[42px] min-h-[42px]"
              aria-label="Toggle Navigation Menu"
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="w-5 h-5 text-[#F26522]" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isOpen && (
        <div className="lg:hidden bg-[#1A1F3C] border-t border-white/10 shadow-2xl transition-all">
          <div className="px-4 pt-3 pb-6 space-y-1.5 max-h-[calc(100vh-80px)] overflow-y-auto">
            {/* Mobile Quick Action Buttons: Donate on top, Join Prayer underneath */}
            <div className="flex flex-col space-y-2 mb-3 pb-3 border-b border-white/10">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowDonateModal(true);
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer"
              >
                <Heart className="w-4 h-4 fill-current" />
                <span>Donate & Partner</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                  if (isMeetingActive) {
                    launchZoom(e);
                  } else {
                    openJoinPrayerModal('visitor');
                  }
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer"
              >
                <Flame className="w-4 h-4 fill-current text-amber-300" />
                <span>
                  {isMeetingActive
                    ? `In Prayer (${formatTime(activeSeconds)})`
                    : isGlobalMeetingLive
                    ? "🟢 Live Prayer Session"
                    : "Join Daily Prayer"}
                </span>
              </button>
            </div>

            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "block px-3.5 py-2.5 rounded-xl text-base font-semibold transition-colors",
                  location.pathname === item.path ? "text-white bg-[#F26522] font-black" : "text-gray-200 hover:text-white hover:bg-white/5"
                )}
              >
                {item.name}
              </Link>
            ))}

            {user && profile?.role !== 'member' && (
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="block px-3.5 py-2.5 rounded-xl text-base font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
              >
                Admin Dashboard
              </Link>
            )}

            <div className="pt-2 border-t border-white/10 mt-2">
              {user ? (
                <button
                  onClick={() => { logout(); setIsOpen(false); }}
                  className="w-full text-left px-3.5 py-2.5 text-gray-300 hover:text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-white/5"
                >
                  Sign Out ({profile?.displayName || user.email})
                </button>
              ) : (
                <button
                  onClick={() => { login(); setIsOpen(false); }}
                  className="w-full text-center px-3.5 py-3 bg-white/10 text-white rounded-xl text-sm font-black uppercase tracking-wider cursor-pointer hover:bg-white/20"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Donation Modal */}
      <DonationModal
        isOpen={showDonateModal}
        onClose={() => setShowDonateModal(false)}
      />
    </nav>
  );
}

export function Footer() {
  const branding = useSiteBranding();
  return (
    <footer className="bg-[#1A1F3C] text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-white p-0.5 shrink-0 flex items-center justify-center">
                <img 
                  src={branding.logoUrl} 
                  alt={`${branding.siteName} Logo`} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="font-bold text-xl leading-tight">{branding.siteName}</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Heaven Is Our Goal. As We Aspire For Excellence. We Move By Fire.
            </p>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/profile.php?id=61585056902769&mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#F26522] transition-colors"><Share2 className="w-5 h-5" /></a>
              <a href="https://www.instagram.com/lightupprayerhousefamily" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#F26522] transition-colors"><Camera className="w-5 h-5" /></a>
              <a href="https://www.youtube.com/@lightupprayerhouse" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#F26522] transition-colors"><Video className="w-5 h-5" /></a>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-bold mb-6 text-[#F26522]">Quick Links</h4>
            <ul className="space-y-4">
              {navItems.slice(1, 5).map(item => (
                <li key={item.path}><Link to={item.path} className="text-gray-400 hover:text-white text-sm transition-colors">{item.name}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-bold mb-6 text-[#F26522]">NGO & Outreach</h4>
            <ul className="space-y-4">
              {navItems.slice(5, 9).map(item => (
                <li key={item.path}><Link to={item.path} className="text-gray-400 hover:text-white text-sm transition-colors">{item.name}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-bold mb-6 text-[#F26522]">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-[#F26522] shrink-0" />
                <span className="text-gray-400 text-sm">Worldwide Presence in 12+ Countries</span>
              </li>
              <li className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-[#F26522] shrink-0" />
                <span className="text-gray-400 text-sm">+234 123 456 7890</span>
              </li>
              <li className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-[#F26522] shrink-0" />
                <span className="text-gray-400 text-sm">ligtupprayerhouse@gmail.com</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-gray-500 text-xs">
          <p>© 2026 Light Up Prayer House Family Outreach. All Rights Reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0 items-center">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms of Service</a>
            <Link to="/admin" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">
              Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { 
    isGlobalMeetingLive, 
    isMeetingActive, 
    activeSeconds, 
    launchZoom, 
    stopZoomSession, 
    endGlobalLiveMeeting,
    formatTime,
    showNamePrompt,
    setShowNamePrompt,
    guestName,
    setGuestName,
    guestPhone,
    setGuestPhone
  } = useZoomSession();

  const [localName, setLocalName] = useState(guestName || localStorage.getItem('zoom_guest_name') || '');
  const [localPhone, setLocalPhone] = useState(guestPhone || localStorage.getItem('zoom_guest_phone') || '');

  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running in standalone PWA mode
    const standalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (showNamePrompt) {
      const savedName = guestName || localStorage.getItem('zoom_guest_name') || '';
      const savedPhone = guestPhone || localStorage.getItem('zoom_guest_phone') || '';
      if (savedName) setLocalName(savedName);
      if (savedPhone) setLocalPhone(savedPhone);
    }
  }, [showNamePrompt, guestName, guestPhone]);

  const handleSubmitName = (e: React.FormEvent) => {
    e.preventDefault();
    const name = localName.trim() || 'Visitor';
    const phone = localPhone.trim();
    setGuestName(name);
    setGuestPhone(phone);
    setShowNamePrompt(false);
    launchZoom(undefined, false, name, phone);
  };

  const handleJoinQuick = () => {
    const name = localName.trim() || 'Visitor';
    const phone = localPhone.trim();
    setGuestName(name);
    if (phone) setGuestPhone(phone);
    setShowNamePrompt(false);
    launchZoom(undefined, false, name, phone);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      {/* PWA INSTALL MODAL */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onInstalled={() => {
          setDeferredPrompt(null);
          setIsStandalone(true);
        }}
      />

      {/* GUEST NAME PROMPT MODAL */}
      <AnimatePresence>
        {showNamePrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNamePrompt(false)}
              className="absolute inset-0 bg-[#1A1F3C]/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-[#1A1F3C]">Joining Zoom</h3>
                    <p className="text-gray-500 font-medium text-sm">Please sign the prayer log to proceed</p>
                  </div>
                  <button 
                    onClick={() => setShowNamePrompt(false)}
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmitName} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Your Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F26522]" size={20} />
                      <input 
                        autoFocus
                        type="text"
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        placeholder="e.g. John Doe / Sis Ruth"
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-[#F26522] focus:bg-white outline-none font-bold text-[#1A1F3C] transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Phone Number</label>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded-full">Optional</span>
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F26522]" size={20} />
                      <input 
                        type="tel"
                        value={localPhone}
                        onChange={(e) => setLocalPhone(e.target.value)}
                        placeholder="e.g. +234 800 000 0000"
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-[#F26522] focus:bg-white outline-none font-bold text-[#1A1F3C] transition-all"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-[#F26522] text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-[#F26522]/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Continue to Zoom
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleJoinQuick}
                    className="text-xs text-gray-400 hover:text-[#1A1F3C] font-bold underline cursor-pointer"
                  >
                    Or Join Quickly as Guest Visitor
                  </button>
                </div>

                <p className="text-[10px] text-center text-gray-400 font-medium italic leading-relaxed">
                  Non-registered attendance records help us track our collective prayer impact and reach out for testimonies.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {(isGlobalMeetingLive || isMeetingActive) && (
        <div className="bg-gradient-to-r from-[#F26522] via-amber-600 to-[#1A1F3C] text-white text-xs font-bold py-2.5 px-4 flex flex-wrap items-center justify-between gap-2 shadow-md z-50">
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
            <span>
              {isMeetingActive 
                ? `🔥 Zoom Session Active! Time elapsed: ${formatTime(activeSeconds)}` 
                : "🔥 Live Prayer Session is currently ongoing on Zoom! Click to join directly."}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {isMeetingActive && (
              <button 
                onClick={stopZoomSession} 
                className="bg-rose-600 text-white px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider hover:bg-rose-700 transition-all cursor-pointer shrink-0 shadow flex items-center space-x-1"
              >
                <span>⏹ Exited Zoom? Save Time</span>
              </button>
            )}
            <button 
              onClick={(e) => launchZoom(e)} 
              className="bg-white text-[#1A1F3C] px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider hover:bg-emerald-400 hover:text-white transition-all cursor-pointer shrink-0 shadow"
            >
              {isMeetingActive ? "Re-Open Zoom Window" : "Join Live Meeting"}
            </button>
            {profile?.role && profile.role !== 'member' && isGlobalMeetingLive && (
              <button
                onClick={endGlobalLiveMeeting}
                className="bg-red-900/90 hover:bg-red-800 text-white border border-red-400/50 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 shadow flex items-center space-x-1"
                title="Admin: Immediately stop live broadcast banner for all visitors"
              >
                <X className="w-3 h-3" />
                <span>End Broadcast</span>
              </button>
            )}
          </div>
        </div>
      )}
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}

