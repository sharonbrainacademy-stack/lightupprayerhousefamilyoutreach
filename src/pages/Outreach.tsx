/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Heart, Users, Globe, ArrowRight, Gift, CheckCircle2, 
  HandHeart, Play, Video, MapPin, Calendar, Sparkles, ExternalLink, X,
  Building2, Copy, Check, ShieldCheck 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeOutreach, OutreachProject } from '../lib/outreach';
import { parseVideoUrl } from '../lib/video-utils';

export default function Outreach() {
  const [projects, setProjects] = useState<OutreachProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideoProject, setSelectedVideoProject] = useState<OutreachProject | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const accountNumber = '1311999667';
  const bankName = 'Zenith Bank International';
  const accountName = 'Light Up Prayer House Family Outreach';

  const handleCopy = () => {
    navigator.clipboard.writeText(accountNumber);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  useEffect(() => {
    const unsubscribe = subscribeOutreach((items) => {
      setProjects(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedVideoProject) {
        setSelectedVideoProject(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedVideoProject]);

  return (
    <div className="pb-24">
      {/* Header */}
      <section className="bg-[#1A1F3C] py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#F26522_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <span className="px-3.5 py-1 bg-[#F26522]/20 text-[#F26522] border border-[#F26522]/30 rounded-full text-xs font-black uppercase tracking-widest inline-block">
            Global Compassion & Charity Foundation
          </span>
          <h1 className="text-5xl font-black text-white uppercase tracking-tight">Outreach & <span className="text-[#F26522]">NGO</span></h1>
          <p className="text-gray-300 max-w-2xl mx-auto font-medium text-sm sm:text-base">
            Extending the hands of Christ to the broken, the needy, and the forgotten through evangelism, food aid, and hospital missions.
          </p>
        </div>
      </section>

      {/* Donation Portal Section - Light Up Account Details */}
      <section id="donate" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-24">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col lg:flex-row">
          <div className="lg:w-1/2 bg-[#1A1F3C] p-8 sm:p-12 text-white space-y-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#F26522]/20 border border-[#F26522]/30 text-[#F26522] text-xs font-bold uppercase tracking-widest">
                <Gift className="w-4 h-4" />
                <span>Giving Is Worship</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black leading-tight">Partner With Our <br /><span className="text-[#F26522]">Global Mission</span></h2>
              <p className="text-gray-300 font-medium leading-relaxed text-sm sm:text-base">
                Your seeds help us reach orphanages, hospitals, and rural communities with food, medicine, and the gospel of Jesus Christ.
              </p>
              <div className="space-y-4 text-sm">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-[#F26522] shrink-0" />
                  <span className="font-bold">100% Direct Field Impact Guarantee</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-[#F26522] shrink-0" />
                  <span className="font-bold">Video & Photographic Field Transparency Reports</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-[#F26522] shrink-0" />
                  <span className="font-bold">Spiritual Prayers & Blessings for All Donors</span>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10 flex items-center space-x-3 text-xs text-gray-300 font-medium">
              <ShieldCheck className="w-5 h-5 text-[#F26522] shrink-0" />
              <span>All donations are directly administered by Light Up Prayer House Family Outreach.</span>
            </div>
          </div>

          <div className="lg:w-1/2 p-8 sm:p-12 bg-gray-50/50 space-y-6 flex flex-col justify-center">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-[#F26522] font-black text-xs uppercase tracking-wider">
                <Building2 size={16} />
                <span>Official Giving Channel</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-[#1A1F3C]">Light Up Account Details</h3>
              <p className="text-xs text-gray-500 font-medium">
                Make your seed donations or mission partnership contributions directly via bank transfer.
              </p>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-orange-200/80 space-y-5 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bank Name</p>
                  <p className="text-base sm:text-lg font-black text-[#1A1F3C]">{bankName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Name</p>
                  <p className="text-sm sm:text-base font-black text-[#1A1F3C] leading-snug">{accountName}</p>
                </div>
              </div>

              <div className="bg-orange-50/70 p-4 sm:p-5 rounded-2xl border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Number</p>
                  <p className="text-2xl sm:text-3xl font-black text-[#F26522] tracking-wider select-all">{accountNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md shrink-0 ${
                    copiedAccount
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#F26522] text-white hover:bg-[#d9561a] hover:scale-105 active:scale-95'
                  }`}
                >
                  {copiedAccount ? (
                    <>
                      <Check size={16} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Copy Account</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-start space-x-2 text-xs text-gray-600 font-medium">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Transfer directly via mobile app, internet banking, or bank branch.</span>
                </div>
                <div className="flex items-start space-x-2 text-xs text-gray-600 font-medium">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Your generous giving powers our field food relief, hospital care, and crusades.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Current Projects & Field Mission Videos */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-orange-50 text-[#F26522] rounded-full text-xs font-black uppercase tracking-widest inline-block">
              Field Impact & Relief
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1A1F3C]">Active Outreach Projects & Documentaries</h2>
            <p className="text-gray-500 font-medium text-sm">
              Watch video reports from our ground missions and sponsor ongoing humanitarian aid.
            </p>
          </div>
          <div className="text-xs font-bold text-gray-400">
            Showing {projects.length} Humanitarian Projects
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#F26522] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 font-bold text-sm">Loading field missions & outreach records...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((proj) => {
              return (
                <div 
                  key={proj.id} 
                  className="bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl border border-gray-100 flex flex-col justify-between group transition-all"
                >
                  <div>
                    {/* Media / Video Banner */}
                    <div 
                      className="h-56 relative overflow-hidden bg-gray-900 cursor-pointer"
                      onClick={() => proj.videoUrl && setSelectedVideoProject(proj)}
                    >
                      <img 
                        src={proj.image} 
                        alt={proj.title} 
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80';
                        }}
                      />
                      
                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-[#F26522] shadow">
                        {proj.category}
                      </div>

                      {proj.status === 'completed' && (
                        <div className="absolute top-3 right-3 bg-emerald-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow">
                          Completed
                        </div>
                      )}

                      {/* Video Play Overlay */}
                      {proj.videoUrl ? (
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center space-y-2 opacity-90 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 bg-[#F26522] rounded-full flex items-center justify-center text-white shadow-xl transform scale-95 group-hover:scale-110 transition-transform">
                            <Play size={22} className="fill-current translate-x-0.5" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-white bg-black/60 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                            Watch Mission Video
                          </span>
                        </div>
                      ) : (
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur rounded text-[9px] font-bold text-gray-200 flex items-center space-x-1">
                          <MapPin size={10} className="text-[#F26522]" />
                          <span>{proj.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between text-xs text-gray-400 font-bold">
                        <span className="flex items-center space-x-1">
                          <MapPin size={12} className="text-[#F26522]" />
                          <span className="truncate max-w-[140px]">{proj.location}</span>
                        </span>
                        {proj.beneficiariesCount && (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md text-[10px] font-black">
                            Impact: {proj.beneficiariesCount}
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-black text-[#1A1F3C] leading-snug group-hover:text-[#F26522] transition-colors">
                        {proj.title}
                      </h3>
                      
                      <p className="text-gray-500 text-xs font-medium leading-relaxed line-clamp-3">
                        {proj.description}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-6 pb-6 pt-3 flex items-center justify-between border-t border-gray-50">
                    {proj.videoUrl ? (
                      <button 
                        onClick={() => setSelectedVideoProject(proj)}
                        className="text-xs font-black uppercase tracking-wider text-[#1A1F3C] hover:text-[#F26522] flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Video size={14} className="text-[#F26522]" />
                        <span>Watch Video</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-gray-400 flex items-center space-x-1">
                        <Calendar size={12} />
                        <span>{proj.date}</span>
                      </span>
                    )}

                    <a 
                      href="#donate"
                      className="px-4 py-2 bg-[#1A1F3C] hover:bg-[#F26522] text-white rounded-xl text-xs font-bold transition-all shadow flex items-center space-x-1"
                    >
                      <span>Sponsor</span>
                      <ArrowRight size={12} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Outreach Video Modal */}
      <AnimatePresence>
        {selectedVideoProject && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto cursor-pointer"
            onClick={() => setSelectedVideoProject(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col cursor-default my-auto relative"
            >
              {/* Modal Top Header with Prominent Close Button */}
              <div className="px-6 py-4 bg-[#1A1F3C] text-white flex items-center justify-between border-b border-white/10 shrink-0">
                <div className="flex items-center space-x-2.5 overflow-hidden pr-2">
                  <span className="px-2.5 py-0.5 bg-[#F26522] text-white text-[10px] font-black uppercase tracking-widest rounded-full shrink-0">
                    {selectedVideoProject.category}
                  </span>
                  <h4 className="font-black text-sm sm:text-base text-white truncate">
                    {selectedVideoProject.title}
                  </h4>
                </div>

                <button 
                  type="button"
                  onClick={() => setSelectedVideoProject(null)}
                  className="p-2 bg-white/10 hover:bg-[#F26522] text-white rounded-full transition-all shrink-0 flex items-center justify-center shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                  title="Close Video (Esc)"
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Video Player / Media Frame */}
              <div className="relative aspect-video bg-black flex items-center justify-center shrink-0">
                {(() => {
                  const videoInfo = parseVideoUrl(selectedVideoProject.videoUrl);
                  if (videoInfo.embedUrl) {
                    return (
                      <iframe 
                        src={videoInfo.embedUrl}
                        title={selectedVideoProject.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      ></iframe>
                    );
                  }

                  if (videoInfo.directVideoUrl) {
                    return (
                      <video
                        src={videoInfo.directVideoUrl}
                        controls
                        autoPlay
                        className="w-full h-full"
                      />
                    );
                  }

                  // Fallback for non-embeddable or channel URLs
                  return (
                    <div className="relative w-full h-full overflow-hidden">
                      <img 
                        src={selectedVideoProject.image} 
                        alt={selectedVideoProject.title} 
                        className="w-full h-full object-cover opacity-50"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80';
                        }}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-black/50 space-y-4">
                        <div className="w-16 h-16 bg-[#F26522] rounded-full flex items-center justify-center text-white shadow-xl">
                          <Play size={28} className="translate-x-0.5" />
                        </div>
                        <div className="space-y-1 max-w-md">
                          <p className="text-base font-black">Outreach Documentary & Field Broadcast</p>
                          <p className="text-xs text-gray-300">
                            {selectedVideoProject.videoUrl 
                              ? "Click below to watch this recording directly on our video channel."
                              : "This outreach recording is cataloged in our ministry media archive."}
                          </p>
                        </div>
                        {selectedVideoProject.videoUrl ? (
                          <a 
                            href={selectedVideoProject.videoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-2 px-6 py-3 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#d9561a] transition-all shadow-lg shadow-[#F26522]/30 hover:scale-105"
                          >
                            <span>Watch on Video Channel</span>
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <a 
                            href="https://www.youtube.com/@lightupprayerhouse" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-2 px-6 py-3 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#d9561a] transition-all shadow-lg shadow-[#F26522]/30 hover:scale-105"
                          >
                            <span>Visit YouTube Channel</span>
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Modal Body & Description */}
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-xs text-gray-500 font-bold">
                    <MapPin size={14} className="text-[#F26522]" />
                    <span>{selectedVideoProject.location || 'Mission Field'}</span>
                    {selectedVideoProject.date && (
                      <>
                        <span>•</span>
                        <span>{selectedVideoProject.date}</span>
                      </>
                    )}
                  </div>
                  {selectedVideoProject.beneficiariesCount && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      Impact: {selectedVideoProject.beneficiariesCount}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-[#1A1F3C] leading-snug">
                    {selectedVideoProject.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-2 font-medium leading-relaxed">
                    {selectedVideoProject.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-xs font-bold text-gray-500">
                    <span>Field Outreach Documentary & Mission Report</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button 
                      type="button"
                      onClick={() => setSelectedVideoProject(null)}
                      className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#1A1F3C] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Close Window
                    </button>
                    <a 
                      href="#donate"
                      onClick={() => setSelectedVideoProject(null)}
                      className="px-5 py-2.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-bold transition-all shadow shadow-[#F26522]/20"
                    >
                      Sponsor Mission
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Volunteer Signup */}
      <section className="bg-[#1A1F3C] py-24 text-white overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <h2 className="text-4xl sm:text-5xl font-black leading-tight">Become a <br /><span className="text-[#F26522]">Volunteer</span></h2>
            <p className="text-gray-300 text-base sm:text-lg font-medium leading-relaxed">
              Use your skills and passion to serve God's people. Whether you're a medical professional, teacher, driver, or just have a willing heart, we need you on the field.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {[
                { title: "Medical & Health", icon: Users },
                { title: "Education & Schools", icon: Globe },
                { title: "Logistics & Food Packs", icon: HandHeart },
                { title: "Prayer & Counseling", icon: Heart },
              ].map((skill, idx) => (
                <div key={idx} className="flex items-center space-x-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="text-[#F26522]"><skill.icon size={24} /></div>
                  <span className="font-bold text-sm">{skill.title}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl">
            <h3 className="text-2xl font-black text-[#1A1F3C] mb-6">Sign Up to Serve on Field</h3>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Thank you for volunteering! Our outreach team will reach out to you shortly.'); }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="text" required placeholder="First Name" className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-100 text-[#1A1F3C] outline-none focus:border-[#F26522] font-bold text-sm" />
                <input type="text" required placeholder="Last Name" className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-100 text-[#1A1F3C] outline-none focus:border-[#F26522] font-bold text-sm" />
              </div>
              <input type="email" required placeholder="Email Address" className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-100 text-[#1A1F3C] outline-none focus:border-[#F26522] font-bold text-sm" />
              <input type="tel" required placeholder="Phone / WhatsApp Number" className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-100 text-[#1A1F3C] outline-none focus:border-[#F26522] font-bold text-sm" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-100 text-[#1A1F3C] outline-none focus:border-[#F26522] font-bold text-sm">
                  <option>Select Country</option>
                  <option>Nigeria</option>
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>Canada</option>
                  <option>Other</option>
                </select>
                <select className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-100 text-[#1A1F3C] outline-none focus:border-[#F26522] font-bold text-sm">
                  <option>Interest Area</option>
                  <option>Medical Aid</option>
                  <option>Food & Logistics</option>
                  <option>Education</option>
                  <option>Evangelism & Prayer</option>
                </select>
              </div>
              <textarea placeholder="Tell us about your background or availability..." className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-100 text-[#1A1F3C] outline-none focus:border-[#F26522] font-medium text-sm h-28"></textarea>
              <button type="submit" className="w-full py-4 bg-[#1A1F3C] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#F26522] transition-all text-xs shadow-lg cursor-pointer">
                Submit Volunteer Application
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

