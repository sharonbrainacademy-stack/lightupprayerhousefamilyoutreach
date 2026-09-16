import React, { useEffect, useState } from 'react';
import { X, Download, MapPin, ArrowLeft, Play, Image as ImageIcon, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseVideoUrl } from '../lib/video-utils';

export interface FlyerModalData {
  title: string;
  imageUrl: string;
  videoUrl?: string;
  dates?: string;
  date?: string;
  theme?: string;
  scripture?: string;
  location?: string;
  minister?: string;
}

interface FlyerModalProps {
  isOpen: boolean;
  onClose: () => void;
  flyer: FlyerModalData | null;
}

export default function FlyerModal({ isOpen, onClose, flyer }: FlyerModalProps) {
  const [activeTab, setActiveTab] = useState<'flyer' | 'video'>('flyer');

  // Sync tab when flyer changes
  useEffect(() => {
    if (flyer?.videoUrl && !flyer?.imageUrl) {
      setActiveTab('video');
    } else {
      setActiveTab('flyer');
    }
  }, [flyer]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Lock body scroll while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !flyer) return null;

  const displayDate = flyer.dates || flyer.date;
  const videoInfo = flyer.videoUrl ? parseVideoUrl(flyer.videoUrl) : null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/85 backdrop-blur-md"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={flyer.title}
      >
        {/* Floating Top-Right Direct Dismiss Button for Mobile */}
        <button
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

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-4xl w-full bg-[#1A1F3C] text-white rounded-3xl overflow-hidden shadow-2xl border border-white/15 my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-5 sm:p-6 border-b border-white/10 shrink-0 bg-[#151932]">
            <div className="space-y-0.5 pr-4">
              {displayDate && (
                <span className="text-[#F26522] text-[10px] font-black uppercase tracking-widest block">
                  {displayDate}
                </span>
              )}
              <h3 className="text-lg sm:text-2xl font-black leading-tight text-white">{flyer.title}</h3>
              {flyer.theme && (
                <p className="text-xs text-gray-300 italic">{flyer.theme}</p>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {flyer.videoUrl && (
                <div className="flex bg-white/10 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setActiveTab('flyer')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      activeTab === 'flyer' ? 'bg-[#F26522] text-white shadow' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    <ImageIcon size={14} />
                    <span>Flyer</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('video')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      activeTab === 'video' ? 'bg-[#F26522] text-white shadow' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    <Video size={14} />
                    <span>Watch Video</span>
                  </button>
                </div>
              )}

              <button
                onClick={onClose}
                className="p-2.5 bg-white/10 hover:bg-rose-600/80 text-white rounded-xl transition-all cursor-pointer shrink-0 flex items-center space-x-1.5 text-xs font-bold"
                aria-label="Close dialog"
              >
                <X size={18} />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          {/* Media Display Area */}
          <div className="relative flex-1 min-h-0 p-3 sm:p-6 flex items-center justify-center overflow-auto bg-black/50">
            {activeTab === 'video' && videoInfo ? (
              <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10">
                {videoInfo.embedUrl ? (
                  <iframe 
                    src={videoInfo.embedUrl}
                    title={flyer.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : videoInfo.directVideoUrl ? (
                  <video
                    src={videoInfo.directVideoUrl}
                    controls
                    autoPlay
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <Video size={48} className="text-[#F26522]" />
                    <p className="text-sm font-bold text-gray-200">Video link available on external player</p>
                    {flyer.videoUrl && (
                      <a
                        href={flyer.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider"
                      >
                        Open Video Stream
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <img
                src={flyer.imageUrl || '/theme_assignment.jpg'}
                alt={flyer.title}
                className="max-h-[60vh] sm:max-h-[65vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/theme_assignment.jpg';
                }}
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          {/* Details & Action Footer */}
          <div className="p-4 sm:p-6 border-t border-white/10 space-y-3 shrink-0 bg-[#151932]">
            {flyer.scripture && (
              <p className="text-center font-serif italic text-gray-200 text-xs sm:text-sm px-2">
                "{flyer.scripture}"
              </p>
            )}

            {flyer.location && (
              <p className="text-center font-bold text-gray-300 text-xs flex items-center justify-center space-x-1.5">
                <MapPin size={15} className="text-[#F26522]" />
                <span>{flyer.location}</span>
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center space-x-2 border border-white/15 cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Return to Website</span>
              </button>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                {flyer.videoUrl && activeTab !== 'video' && (
                  <button
                    onClick={() => setActiveTab('video')}
                    className="flex-1 sm:flex-initial px-6 py-3 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#F26522]/30 cursor-pointer"
                  >
                    <Play size={16} className="fill-current" />
                    <span>Watch Video</span>
                  </button>
                )}

                <a
                  href={flyer.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 sm:flex-initial px-6 py-3 bg-white/15 hover:bg-white/25 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center space-x-2 border border-white/20 cursor-pointer"
                >
                  <Download size={16} />
                  <span>Download Flyer</span>
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
