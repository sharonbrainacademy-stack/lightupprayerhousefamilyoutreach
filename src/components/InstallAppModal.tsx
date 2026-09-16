/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, Smartphone, Share2, PlusSquare, 
  Check, X, Sparkles, ShieldCheck, Zap, Flame, 
  CheckCircle2, ArrowRight, Copy 
} from 'lucide-react';
import { useSiteBranding } from '../lib/settings';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onInstalled?: () => void;
}

export function InstallAppModal({ isOpen, onClose, deferredPrompt, onInstalled }: InstallAppModalProps) {
  const branding = useSiteBranding();
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIPhoneOrIPad = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIPhoneOrIPad);

    // Detect if already installed / standalone
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          if (onInstalled) onInstalled();
          onClose();
        }
      } catch (err) {
        console.error('Install prompt error:', err);
      } finally {
        setInstalling(false);
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#1A1F3C]/80 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100"
        >
          {/* Top Banner Header */}
          <div className="bg-gradient-to-br from-[#1A1F3C] via-[#242b52] to-[#1A1F3C] text-white p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <Flame size={150} />
            </div>

            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-all cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-lg ring-4 ring-white/10 shrink-0 overflow-hidden flex items-center justify-center">
                <img
                  src={branding.logoUrl}
                  alt={branding.siteName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <span className="inline-flex items-center space-x-1.5 bg-[#F26522] text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-1">
                  <Sparkles size={11} />
                  <span>Official App</span>
                </span>
                <h3 className="text-2xl font-black tracking-tight">{branding.siteName}</h3>
                <p className="text-xs text-gray-300 font-medium">Install on your phone or tablet</p>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-8 space-y-6">
            {isStandalone ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 size={24} />
                </div>
                <h4 className="text-lg font-black text-emerald-900">App Already Installed!</h4>
                <p className="text-xs text-emerald-700 font-medium">
                  You are currently using the installed Light Up standalone application.
                </p>
              </div>
            ) : isIOS ? (
              /* iOS Instructions */
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center space-x-3 text-amber-800 text-xs font-bold">
                  <Smartphone className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Installing on iPhone / iPad (Safari)</span>
                </div>

                <div className="space-y-3 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <div className="flex items-start space-x-3">
                    <div className="w-7 h-7 rounded-full bg-[#1A1F3C] text-white font-black text-xs flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="text-xs text-gray-700 font-medium leading-relaxed">
                      Tap the <strong className="text-[#1A1F3C] font-black">Share</strong> icon at the bottom of Safari <span className="inline-block p-1 bg-gray-200 rounded text-gray-800 align-middle"><Share2 size={12} /></span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-7 h-7 rounded-full bg-[#1A1F3C] text-white font-black text-xs flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="text-xs text-gray-700 font-medium leading-relaxed">
                      Scroll down and tap <strong className="text-[#1A1F3C] font-black">Add to Home Screen</strong> <span className="inline-block p-1 bg-gray-200 rounded text-gray-800 align-middle"><PlusSquare size={12} /></span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-7 h-7 rounded-full bg-[#F26522] text-white font-black text-xs flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="text-xs text-gray-700 font-medium leading-relaxed">
                      Tap <strong className="text-[#F26522] font-black">Add</strong> in the top right corner. The app icon will appear on your home screen!
                    </div>
                  </div>
                </div>
              </div>
            ) : deferredPrompt ? (
              /* Direct Install prompt button for Android / Chrome */
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 text-xs font-bold text-gray-700">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                    <span>Instant 1-tap access to 5:00 AM WAT Live Prayers</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs font-bold text-gray-700">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                    <span>Runs full-screen like a native app (no browser tabs)</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs font-bold text-gray-700">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                    <span>Quick access to Zoom prayer room and attendance tracker</span>
                  </div>
                </div>

                <button
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="w-full py-4 bg-[#F26522] text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-[#F26522]/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2"
                >
                  <Download size={18} />
                  <span>{installing ? 'Installing...' : 'Install Light Up App Now'}</span>
                </button>
              </div>
            ) : (
              /* Fallback instructions for Android / Desktop */
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs font-medium text-blue-900 leading-relaxed">
                  <p className="font-bold text-blue-950 mb-1">To install on your device:</p>
                  <p>Tap your browser menu (<strong className="font-bold">⋮</strong> or <strong className="font-bold">Share</strong>) and select <strong className="font-bold text-[#F26522]">"Install App"</strong> or <strong className="font-bold text-[#F26522]">"Add to Home Screen"</strong>.</p>
                </div>
              </div>
            )}

            {/* Share App Link with Others */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center space-x-2 text-xs text-gray-500 hover:text-[#1A1F3C] font-bold transition-colors cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Link Copied to Clipboard!' : 'Copy App Link to Share'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-xs text-gray-400 hover:text-gray-600 font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
