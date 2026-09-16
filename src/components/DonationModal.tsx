/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Building2, Copy, Check, Gift, ShieldCheck, ExternalLink, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const [copied, setCopied] = useState(false);

  // Close on Escape key press and prevent background scrolling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  const accountNumber = '1311999667';
  const bankName = 'Zenith Bank International';
  const accountName = 'Light Up Prayer House Family Outreach';

  const handleCopy = () => {
    navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Donations & Giving Portal"
      >
        {/* Floating Top-Right Direct Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="fixed top-4 right-4 z-[130] p-3 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-lg border border-white/20 shadow-2xl transition-all cursor-pointer flex items-center space-x-1 text-xs font-bold"
          title="Return to Website (Esc)"
        >
          <X size={20} />
          <span className="hidden sm:inline pr-1">Close</span>
        </button>

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden z-10 border border-gray-100 my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header Banner */}
          <div className="bg-[#1A1F3C] text-white p-5 sm:p-7 relative shrink-0">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                title="Go back to the previous page"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 bg-white/10 hover:bg-rose-600/80 text-white rounded-xl transition-all cursor-pointer flex items-center space-x-1 text-xs font-bold"
                aria-label="Close modal"
              >
                <X size={18} />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>

            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#F26522]/20 border border-[#F26522]/30 text-[#F26522] text-[11px] font-black uppercase tracking-widest my-2">
              <Gift className="w-3.5 h-3.5" />
              <span>Giving Is Worship</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black leading-tight text-white">
              Partner With Our <br className="hidden sm:inline" />
              <span className="text-[#F26522]">Global Mission</span>
            </h3>
            <p className="text-gray-300 text-xs sm:text-sm font-medium mt-1 leading-relaxed">
              Your seed fuels our daily prayer altar, global revival rallies, and community outreach.
            </p>
          </div>

          <div className="p-5 sm:p-7 space-y-5 overflow-y-auto flex-1">
            {/* Direct Bank Wire Card - Light Up Account Details */}
            <div className="bg-orange-50/70 border-2 border-orange-200/80 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[#F26522] font-black text-xs uppercase tracking-wider">
                  <Building2 size={18} />
                  <span>Light Up Account Details</span>
                </div>
                <span className="text-[10px] font-black bg-white text-[#1A1F3C] px-2.5 py-1 rounded-full border border-orange-200 uppercase tracking-wider">
                  Direct Bank Transfer
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bank Name</p>
                  <p className="text-sm sm:text-base font-black text-[#1A1F3C]">{bankName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Name</p>
                  <p className="text-xs sm:text-sm font-black text-[#1A1F3C] leading-snug">{accountName}</p>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Number</p>
                  <p className="text-2xl sm:text-3xl font-black text-[#F26522] tracking-wider select-all">{accountNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md shrink-0 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#F26522] text-white hover:bg-[#d9561a] hover:scale-105 active:scale-95'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check size={16} />
                      <span>Account Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Copy Account Number</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-start space-x-2 text-xs text-gray-600 font-medium">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Transfer directly via mobile banking app, USSD, or counter deposit.</span>
                </div>
                <div className="flex items-start space-x-2 text-xs text-gray-600 font-medium">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Kindly reference your seed type (e.g. Outreach, Tithe, Mission) in your transfer description.</span>
                </div>
              </div>
            </div>

            {/* Guarantees & Full Outreach Link */}
            <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-gray-500 font-medium">
              <div className="flex items-center space-x-1.5 text-gray-600">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <span>100% Direct Field & Prayer Outreach Impact</span>
              </div>
              <Link
                to="/outreach"
                onClick={onClose}
                className="text-[#F26522] font-black flex items-center space-x-1 hover:underline"
              >
                <span>View Outreach Projects</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>

          {/* Footer Back & Close Button */}
          <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100 shrink-0 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-white hover:bg-gray-100 text-[#1A1F3C] rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 border border-gray-200 cursor-pointer shadow-sm"
            >
              <ArrowLeft size={16} />
              <span>Return to Website</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
