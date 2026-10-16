/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  ArrowRight, 
  Play, 
  Users, 
  Globe, 
  Calendar, 
  Quote, 
  CheckCircle2, 
  ChevronRight, 
  Maximize2, 
  X, 
  Download, 
  MapPin, 
  Tag, 
  Video, 
  Heart, 
  Sparkles, 
  ExternalLink, 
  Image as ImageIcon,
  Check
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { PrayerClock } from '../components/PrayerClock';
import { ZoomAttendanceCard } from '../components/ZoomAttendanceCard';
import { db } from '../lib/firebase';
import { WeeklyTheme, ProgramItem } from '../types';
import { ProgramFlyerCard } from '../components/ProgramFlyerCard';
import { isProgramExpired } from '../lib/programs';
import FlyerModal from '../components/FlyerModal';
import { 
  subscribeStoryPictures, 
  StoryPicture, 
  subscribeOutreach, 
  OutreachProject 
} from '../lib/outreach';
import { subscribeSermons, SermonItem } from '../lib/media';
import { parseVideoUrl } from '../lib/video-utils';
import { getThemeFlyerUrl } from '../lib/image-utils';

const DEFAULT_HOME_PROGRAMS: ProgramItem[] = [
  {
    id: 'prog-1',
    title: "Back to Eden Lagos Revival Rally",
    series: "Back to Eden",
    theme: "Light Up Lagos: Spiritual Awakening and Restoration",
    date: "Upcoming Revival Gathering",
    time: "5:00 PM – 9:00 PM WAT",
    location: "Lagos, Nigeria",
    imageUrl: "/flyer_lagos.jpg"
  },
  {
    id: 'prog-2',
    title: "Back to Eden Edo State Crusade",
    series: "Back to Eden",
    theme: "Restoration of Glory, Power and Apostolic Fire",
    date: "Upcoming Crusade Series",
    time: "4:30 PM WAT Daily",
    location: "Benin City, Edo State",
    imageUrl: "/flyer_edo.jpg"
  },
  {
    id: 'prog-3',
    title: "Back to Eden Asaba Prophetic Encounter",
    series: "Back to Eden",
    theme: "Encountering the Glory and Fire of God",
    date: "Upcoming Regional Rally",
    time: "5:00 PM WAT",
    location: "Asaba, Delta State",
    imageUrl: "/flyer_asaba.jpg"
  }
];

export default function Home() {
  const [selectedFlyer, setSelectedFlyer] = useState<{ title: string; imageUrl: string; dates?: string; scripture?: string; videoUrl?: string } | null>(null);
  const [programs, setPrograms] = useState<ProgramItem[]>(DEFAULT_HOME_PROGRAMS);
  const [currentTheme, setCurrentTheme] = useState<WeeklyTheme | null>({
    id: '1',
    title: "THE ASSIGNMENT OF GOD IN MY LIFE",
    scripture: "Jeremiah 1:5, Proverbs 3:5-6",
    minister: "Pastor Osaro Aghedo & other Anointed Ministers of God",
    dates: "July 27 – 31, 2026",
    imageUrl: "/theme_assignment.jpg",
    prayerPoints: ["Discovery of divine assignment", "Grace for fulfillment", "Strategic direction"],
    isCurrent: true
  });

  // Story pictures & Lightbox state
  const [storyPictures, setStoryPictures] = useState<StoryPicture[]>([]);
  const [selectedStoryPhoto, setSelectedStoryPhoto] = useState<StoryPicture | null>(null);

  // Outreach projects & Video player state
  const [outreachProjects, setOutreachProjects] = useState<OutreachProject[]>([]);
  const [selectedVideoProject, setSelectedVideoProject] = useState<OutreachProject | null>(null);

  // Sermons & Video teachings state
  const [sermons, setSermons] = useState<SermonItem[]>([]);
  const [selectedSermonVideo, setSelectedSermonVideo] = useState<SermonItem | null>(null);

  useEffect(() => {
    const unsubThemes = onSnapshot(
      collection(db, 'themes'),
      (snapshot) => {
        const list: WeeklyTheme[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as WeeklyTheme);
        });
        const active = list.find(t => t.isCurrent) || list[0];
        if (active) {
          setCurrentTheme(active);
        }
      },
      (err) => {
        console.error('Error fetching themes for Home:', err);
      }
    );

    const unsubPrograms = onSnapshot(
      collection(db, 'programs'),
      (snapshot) => {
        const list: ProgramItem[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as ProgramItem);
        });
        setPrograms(list);
      },
      (err) => {
        console.error('Error fetching programs for Home:', err);
      }
    );

    // Subscribe to Story Pictures
    const unsubStoryPics = subscribeStoryPictures((pics) => {
      setStoryPictures(pics.filter(p => p.showOnHomeStory !== false));
    });

    // Subscribe to Outreach Projects
    const unsubOutreach = subscribeOutreach((projects) => {
      setOutreachProjects(projects);
    });

    // Subscribe to Sermons
    const unsubSermons = subscribeSermons((items) => {
      setSermons(items);
    });

    return () => {
      unsubThemes();
      unsubPrograms();
      unsubStoryPics();
      unsubOutreach();
      unsubSermons();
    };
  }, []);

  // Helper to get embeddable video URL for YouTube or raw video
  const getEmbedVideoUrl = (url?: string) => {
    if (!url) return null;
    const trimmed = url.trim();
    const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
    }
    return null;
  };

  return (
    <div className="space-y-20 pb-20">
      {/* Full Screen Flyer Modal */}
      <FlyerModal
        isOpen={!!selectedFlyer}
        onClose={() => setSelectedFlyer(null)}
        flyer={selectedFlyer}
      />

      {/* Story Photo Lightbox Modal */}
      <AnimatePresence>
        {selectedStoryPhoto && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col border border-white/20 max-h-[90vh]"
            >
              <div className="relative bg-black flex items-center justify-center max-h-[60vh] overflow-hidden group">
                <img 
                  src={selectedStoryPhoto.imageUrl} 
                  alt={selectedStoryPhoto.title}
                  className="w-full h-full object-contain max-h-[60vh]"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={() => setSelectedStoryPhoto(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all cursor-pointer z-10"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 md:p-8 bg-white space-y-4 overflow-y-auto">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    {selectedStoryPhoto.category && (
                      <span className="px-3 py-1 bg-[#F26522]/10 text-[#F26522] rounded-full text-xs font-black uppercase tracking-wider">
                        {selectedStoryPhoto.category}
                      </span>
                    )}
                    {selectedStoryPhoto.location && (
                      <span className="flex items-center space-x-1 text-xs text-gray-500 font-bold">
                        <MapPin size={13} className="text-[#F26522]" />
                        <span>{selectedStoryPhoto.location}</span>
                      </span>
                    )}
                  </div>
                  {selectedStoryPhoto.date && (
                    <span className="text-xs font-mono font-bold text-gray-400">
                      {selectedStoryPhoto.date}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-2xl font-black text-[#1A1F3C]">{selectedStoryPhoto.title}</h3>
                  {selectedStoryPhoto.caption && (
                    <p className="text-gray-600 font-medium text-base mt-2 leading-relaxed">
                      {selectedStoryPhoto.caption}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <Link 
                    to="/outreach" 
                    onClick={() => setSelectedStoryPhoto(null)}
                    className="inline-flex items-center space-x-2 text-[#F26522] font-black text-xs uppercase tracking-wider hover:underline"
                  >
                    <span>Support This Ministry Mission</span>
                    <ArrowRight size={14} />
                  </Link>
                  <button
                    onClick={() => setSelectedStoryPhoto(null)}
                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Outreach Video Player Modal */}
      <AnimatePresence>
        {selectedVideoProject && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1A1F3C] rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col border border-white/10 text-white max-h-[92vh]"
            >
              {/* Header */}
              <div className="p-4 px-6 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-[#F26522]/20 text-[#F26522] flex items-center justify-center">
                    <Video size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">{selectedVideoProject.title}</h3>
                    <p className="text-xs text-gray-400 font-medium">Field Outreach Video Footage</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVideoProject(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Video Player Box */}
              <div className="relative aspect-video w-full bg-black">
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
                      />
                    );
                  } else if (videoInfo.directVideoUrl) {
                    return (
                      <video
                        src={videoInfo.directVideoUrl}
                        controls
                        autoPlay
                        className="w-full h-full"
                      />
                    );
                  } else {
                    return (
                      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-4 bg-gradient-to-br from-[#1A1F3C] to-black">
                        <Video size={48} className="text-[#F26522] animate-bounce" />
                        <div>
                          <h4 className="text-lg font-black">Watch on Ministry Channel</h4>
                          <p className="text-xs text-gray-400 max-w-md mt-1 font-medium">
                            {selectedVideoProject.videoUrl 
                              ? "Click below to watch this video broadcast on our official channel." 
                              : "This documentary is hosted on our official media broadcast archive."}
                          </p>
                        </div>
                        {selectedVideoProject.videoUrl ? (
                          <a
                            href={selectedVideoProject.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-6 py-3 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-lg transition-all"
                          >
                            <span>Open Video Broadcast</span>
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <a
                            href="https://www.youtube.com/@lightupprayerhouse"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-6 py-3 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-lg transition-all"
                          >
                            <span>Visit YouTube Channel</span>
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Description Footer */}
              <div className="p-6 bg-white/5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 bg-[#F26522] text-white text-[10px] font-black uppercase rounded-md tracking-wider">
                      {selectedVideoProject.category}
                    </span>
                    {selectedVideoProject.location && (
                      <span className="text-xs text-gray-300 flex items-center space-x-1 font-medium">
                        <MapPin size={12} className="text-[#F26522]" />
                        <span>{selectedVideoProject.location}</span>
                      </span>
                    )}
                  </div>
                  {selectedVideoProject.beneficiariesCount && (
                    <span className="text-xs text-emerald-400 font-bold">
                      ✨ Impact: {selectedVideoProject.beneficiariesCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-300 leading-relaxed font-medium">
                  {selectedVideoProject.description}
                </p>
                <div className="pt-2 flex justify-between items-center">
                  <Link
                    to="/outreach"
                    onClick={() => setSelectedVideoProject(null)}
                    className="px-5 py-2.5 bg-[#F26522] hover:bg-[#d9561a] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center space-x-2"
                  >
                    <Heart size={14} />
                    <span>Support This Project</span>
                  </Link>
                  <button
                    onClick={() => setSelectedVideoProject(null)}
                    className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                  >
                    Close Video
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Teaching & Sermon Video Player Modal on Home */}
      <AnimatePresence>
        {selectedSermonVideo && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1A1F3C] rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col border border-white/10 text-white max-h-[92vh]"
            >
              {/* Modal Top Header */}
              <div className="p-4 px-6 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center space-x-3 overflow-hidden pr-2">
                  <span className="px-2.5 py-0.5 bg-[#F26522] text-white text-[10px] font-black uppercase tracking-widest rounded-full shrink-0">
                    {selectedSermonVideo.type === 'video' ? 'Video Teaching' : 'Audio Message'}
                  </span>
                  <h4 className="font-black text-sm sm:text-base text-white truncate">
                    {selectedSermonVideo.title}
                  </h4>
                </div>
                <button 
                  onClick={() => setSelectedSermonVideo(null)}
                  className="p-2 bg-white/10 hover:bg-[#F26522] text-white rounded-xl transition-all shrink-0 flex items-center justify-center cursor-pointer shadow-md"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Media Playback Frame */}
              <div className="relative aspect-video w-full bg-black">
                {(() => {
                  const videoInfo = parseVideoUrl(selectedSermonVideo.mediaUrl);
                  
                  if (videoInfo.embedUrl) {
                    return (
                      <iframe 
                        src={videoInfo.embedUrl}
                        title={selectedSermonVideo.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
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

                  if (selectedSermonVideo.type === 'audio' && selectedSermonVideo.mediaUrl && (selectedSermonVideo.mediaUrl.endsWith('.mp3') || selectedSermonVideo.mediaUrl.includes('audio'))) {
                    return (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#1A1F3C] to-slate-900 text-white space-y-6">
                        <div className="w-20 h-20 bg-[#F26522] rounded-full flex items-center justify-center text-white shadow-xl animate-pulse">
                          <Play size={36} className="ml-1 fill-current" />
                        </div>
                        <div className="text-center space-y-1">
                          <h4 className="font-black text-lg">{selectedSermonVideo.title}</h4>
                          <p className="text-xs text-gray-300 font-bold">{selectedSermonVideo.minister}</p>
                        </div>
                        <audio controls autoPlay className="w-full max-w-md mt-2">
                          <source src={selectedSermonVideo.mediaUrl} type="audio/mpeg" />
                          Your browser does not support audio playback.
                        </audio>
                      </div>
                    );
                  }

                  return (
                    <div className="relative w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-4 bg-gradient-to-br from-[#1A1F3C] to-black">
                      <Video size={48} className="text-[#F26522] animate-bounce" />
                      <div>
                        <h4 className="text-lg font-black">Watch Live & Archived Broadcast</h4>
                        <p className="text-xs text-gray-400 max-w-md mt-1 font-medium">
                          {selectedSermonVideo.mediaUrl 
                            ? "This spiritual teaching is hosted on our ministry broadcast archive." 
                            : "Visit our YouTube media channel to stream full service recordings and messages."}
                        </p>
                      </div>
                      {selectedSermonVideo.mediaUrl ? (
                        <a 
                          href={selectedSermonVideo.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-3 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#d9561a] transition-all flex items-center space-x-2 shadow-lg shadow-[#F26522]/30"
                        >
                          <span>Open Teaching Link</span>
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <a 
                          href="https://www.youtube.com/@lightupprayerhouse"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-3 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#d9561a] transition-all flex items-center space-x-2 shadow-lg shadow-[#F26522]/30"
                        >
                          <span>Visit YouTube Channel</span>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Teaching Details & Actions */}
              <div className="p-6 bg-white/5 space-y-4 overflow-y-auto">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs text-[#F26522] font-black uppercase tracking-wider">
                      {selectedSermonVideo.date || 'Recent Service'}
                    </span>
                    {selectedSermonVideo.duration && (
                      <span className="text-xs text-gray-400 font-mono font-bold">
                        ⏱ {selectedSermonVideo.duration}
                      </span>
                    )}
                  </div>
                  {selectedSermonVideo.mediaUrl && (
                    <a
                      href={selectedSermonVideo.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-gray-300 hover:text-white flex items-center space-x-1"
                    >
                      <span>Open in New Tab</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white leading-snug">
                    {selectedSermonVideo.title}
                  </h3>
                  <p className="text-xs text-gray-300 font-bold mt-1">
                    Minister: <span className="text-white">{selectedSermonVideo.minister || 'Anointed Minister of God'}</span>
                  </p>
                </div>

                {selectedSermonVideo.scripture && (
                  <p className="text-xs text-[#F26522] font-serif italic bg-white/5 p-3 rounded-xl border border-white/10">
                    📖 Scripture: {selectedSermonVideo.scripture}
                  </p>
                )}

                {selectedSermonVideo.description && (
                  <p className="text-xs text-gray-300 font-medium leading-relaxed">
                    {selectedSermonVideo.description}
                  </p>
                )}

                <div className="pt-2 flex items-center justify-between border-t border-white/10">
                  <Link
                    to="/media"
                    onClick={() => setSelectedSermonVideo(null)}
                    className="text-xs font-black uppercase tracking-wider text-[#F26522] hover:underline flex items-center space-x-1.5"
                  >
                    <span>Explore Full Media Archive</span>
                    <ArrowRight size={14} />
                  </Link>
                  <button
                    onClick={() => setSelectedSermonVideo(null)}
                    className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative h-[85vh] flex items-center overflow-hidden bg-[#1A1F3C]">
        <div className="absolute inset-0 opacity-40">
          <img 
            src="https://images.unsplash.com/photo-1544427920-c49ccfb85579?auto=format&fit=crop&q=80" 
            alt="Prayer Silhouette" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1A1F3C] to-transparent"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl space-y-6"
          >
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#F26522]/20 border border-[#F26522]/30 text-[#F26522] text-xs font-bold uppercase tracking-widest">
              <Flame className="w-4 h-4" />
              <span>We Move By Fire</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.1]">
              Igniting <span className="text-[#F26522]">Revival</span> & Transformation
            </h1>
            <p className="text-xl text-white font-medium max-w-xl">
              "Heaven Is Our Goal. As We Aspire For Excellence." Join our global family as we pray for the nations every weekday at 5:00 AM WAT.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link to="/join" className="px-8 py-4 bg-[#F26522] text-white rounded-lg font-bold text-lg hover:bg-[#d9561a] transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#F26522]/20">
                <span>Join Live Prayer</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/about" className="px-8 py-4 bg-white/10 text-white border border-white/20 rounded-lg font-bold text-lg hover:bg-white/20 transition-all backdrop-blur-sm flex items-center justify-center">
                Learn Our Vision
              </Link>
            </div>
          </motion.div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/30 flex justify-center p-1">
            <div className="w-1 h-3 bg-white rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Prayer Times & Zoom Attendance */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-20 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <PrayerClock />
          </div>
          <div className="lg:col-span-1">
            <ZoomAttendanceCard />
          </div>
        </div>
      </section>

      {/* This Week's Theme */}
      {currentTheme && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col lg:flex-row border border-gray-100">
            <div 
              onClick={() => setSelectedFlyer({
                title: currentTheme.title,
                imageUrl: getThemeFlyerUrl(currentTheme),
                dates: currentTheme.dates,
                scripture: currentTheme.scripture
              })}
              className="lg:w-1/2 relative min-h-[400px] cursor-pointer group overflow-hidden bg-black/40"
            >
              <img 
                src={getThemeFlyerUrl(currentTheme)} 
                alt={currentTheme.title || "Weekly Theme"} 
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/theme_assignment.jpg';
                }}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:via-black/40 transition-colors"></div>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="px-3 py-1.5 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-xl">
                  <Maximize2 size={14} />
                  <span>View Flyer</span>
                </span>
              </div>
              <div className="absolute bottom-8 left-8 right-8 text-white">
                <span className="bg-[#F26522] text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest mb-2 inline-block">Current Week</span>
                <h2 className="text-3xl font-black uppercase italic leading-tight">{currentTheme.title}</h2>
              </div>
            </div>
            <div className="lg:w-1/2 p-12 space-y-8 flex flex-col justify-center bg-gray-50/50">
              <div className="space-y-4">
                <h3 className="text-sm font-black text-[#F26522] uppercase tracking-[0.3em]">Scripture Focus</h3>
                <p className="text-2xl font-serif italic text-[#1A1F3C] leading-relaxed">
                  "{currentTheme.scripture}"
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-sm font-black text-[#1A1F3C] uppercase tracking-[0.3em]">Ministering</h3>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-[#1A1F3C] flex items-center justify-center text-white font-black text-sm tracking-wider">LP</div>
                  <div>
                    <p className="font-bold text-[#1A1F3C] text-base">{currentTheme.minister || 'Pastor Osaro Aghedo & other Anointed Ministers of God'}</p>
                    <p className="text-xs text-gray-500 font-medium">Light Up Prayer House Family Outreach</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-2 text-sm text-gray-600 font-bold mb-4">
                  <Calendar className="w-4 h-4 text-[#F26522]" />
                  <span>{currentTheme.dates}</span>
                </div>
                <Link to="/themes" className="inline-flex items-center space-x-2 text-[#F26522] font-black uppercase tracking-widest text-xs hover:translate-x-2 transition-transform">
                  <span>View Full Theme Details</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* About Snippet & NGO — With Dynamic Outreach Photos Under Our Full Story */}
      <section className="bg-white py-24 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Main Story Text */}
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#F26522]/10 text-[#F26522] text-xs font-black uppercase tracking-widest">
              <Heart size={14} className="fill-current" />
              <span>Compassion & Fire In Motion</span>
            </div>

            <h2 className="text-4xl sm:text-5xl font-black text-[#1A1F3C] leading-tight">
              A Global Community <br />
              <span className="text-[#F26522]">Moving By Fire</span>
            </h2>
            <p className="text-gray-600 text-lg sm:text-xl leading-relaxed max-w-3xl mx-auto font-medium">
              Light Up Prayer House Family Outreach is a non-denominational Christian NGO dedicated to restoring the fire of God in the hearts of believers. Through constant prayer, deep study of the word, and impactful community outreach, we seek to transform lives and prepare a generation for the coming of our Lord.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto py-2">
              {[
                "Daily 5:00 AM WAT Prayers",
                "Orphanage & Hospital Visits",
                "Global Membership Network",
                "Spirit-filled Weekly Themes"
              ].map(item => (
                <div key={item} className="flex items-center justify-center space-x-2 bg-gray-50 border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-[#F26522] flex-shrink-0" />
                  <span className="font-bold text-[#1A1F3C] text-sm">{item}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
              <Link to="/about" className="inline-flex items-center space-x-2 px-8 py-4 bg-[#1A1F3C] text-white rounded-xl font-bold hover:bg-[#252b4d] transition-all shadow-md">
                <span>Our Full Story</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/outreach" className="inline-flex items-center space-x-2 px-8 py-4 bg-gray-100 hover:bg-gray-200 text-[#1A1F3C] rounded-xl font-bold transition-all">
                <span>Explore Outreach Missions</span>
              </Link>
            </div>
          </div>

          {/* DYNAMIC OUTREACH PICTURES GALLERY UNDER OUR FULL STORY */}
          {storyPictures.length > 0 && (
            <div className="pt-10 border-t border-gray-100 space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2 text-[#F26522] text-xs font-black uppercase tracking-widest mb-1">
                    <ImageIcon size={16} />
                    <span>Outreach In Action</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-[#1A1F3C]">
                    Touching Lives Across Communities
                  </h3>
                  <p className="text-gray-500 text-sm font-medium">
                    Real field photos from our humanitarian missions, food relief drives, and hospital visits.
                  </p>
                </div>
                <Link 
                  to="/outreach" 
                  className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-[#F26522] hover:translate-x-1 transition-transform"
                >
                  <span>View All Outreach Projects</span>
                  <ChevronRight size={16} />
                </Link>
              </div>

              {/* Photo Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {storyPictures.map((pic) => (
                  <motion.div
                    key={pic.id}
                    whileHover={{ y: -6 }}
                    onClick={() => setSelectedStoryPhoto(pic)}
                    className="group bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-gray-200">
                      <img 
                        src={pic.imageUrl} 
                        alt={pic.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                      
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase rounded-lg tracking-wider">
                          {pic.category || 'Outreach'}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-8 h-8 rounded-full bg-white text-[#1A1F3C] flex items-center justify-center shadow-lg">
                          <Maximize2 size={14} />
                        </div>
                      </div>

                      {pic.location && (
                        <div className="absolute bottom-3 left-3 right-3 text-white flex items-center space-x-1 text-[11px] font-bold drop-shadow">
                          <MapPin size={12} className="text-[#F26522] shrink-0" />
                          <span className="truncate">{pic.location}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h4 className="font-black text-[#1A1F3C] text-base group-hover:text-[#F26522] transition-colors line-clamp-1">
                          {pic.title}
                        </h4>
                        {pic.caption && (
                          <p className="text-xs text-gray-500 font-medium line-clamp-2 mt-1 leading-relaxed">
                            {pic.caption}
                          </p>
                        )}
                      </div>
                      {pic.date && (
                        <div className="pt-2 text-[10px] font-mono font-bold text-gray-400 flex items-center justify-between border-t border-gray-100">
                          <span>{pic.date}</span>
                          <span className="text-[#F26522] font-black group-hover:underline">View Photo &rarr;</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* OUTREACH VIDEOS & FIELD DOCUMENTARIES SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-[#1A1F3C] rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl border border-white/10 space-y-12">
          {/* Glowing Accents */}
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#F26522]/15 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>

          {/* Section Header */}
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#F26522]/20 border border-[#F26522]/30 text-[#F26522] text-xs font-black uppercase tracking-widest">
                <Video size={14} />
                <span>Field Documentaries & Media</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                Outreach Videos & Impact In Motion
              </h2>
              <p className="text-gray-300 text-sm sm:text-base max-w-2xl font-medium">
                Watch live footage and documentary recordings from our outreach programs, hospital visitations, and community food distributions.
              </p>
            </div>
            <Link
              to="/outreach"
              className="inline-flex items-center space-x-2 px-6 py-3.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-[#F26522]/20 transition-all shrink-0"
            >
              <Heart size={15} />
              <span>Partner With Us</span>
            </Link>
          </div>

          {/* Video Cards Grid */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(() => {
              const activeHomeProjects = outreachProjects.filter(p => p.showOnHome !== false);
              const listToDisplay = activeHomeProjects.length > 0 ? activeHomeProjects.slice(0, 6) : outreachProjects.slice(0, 3);
              
              return listToDisplay.map((project) => {
                return (
                  <div
                    key={project.id}
                    className="bg-white/5 backdrop-blur-md rounded-3xl overflow-hidden border border-white/10 flex flex-col justify-between group hover:border-[#F26522]/50 transition-all"
                  >
                    <div 
                      onClick={() => setSelectedVideoProject(project)}
                      className="relative aspect-video bg-black/60 overflow-hidden cursor-pointer"
                    >
                      <img 
                        src={project.image || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80'} 
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-70"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                      {/* Play Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-[#F26522] text-white flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform ring-4 ring-white/20">
                          <Play size={24} className="fill-current ml-1" />
                        </div>
                      </div>

                      <div className="absolute top-3 left-3">
                        <span className="px-3 py-1 bg-black/70 backdrop-blur-md text-white text-[10px] font-black uppercase rounded-lg tracking-wider">
                          {project.category}
                        </span>
                      </div>

                      {project.beneficiariesCount && (
                        <div className="absolute bottom-3 left-3 right-3 text-[11px] font-bold text-emerald-400 drop-shadow">
                          ✨ {project.beneficiariesCount}
                        </div>
                      )}
                    </div>

                    <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-medium">
                          <MapPin size={12} className="text-[#F26522]" />
                          <span>{project.location || 'Outreach Mission'}</span>
                        </div>
                        <h3 className="text-xl font-black text-white group-hover:text-[#F26522] transition-colors line-clamp-1">
                          {project.title}
                        </h3>
                        <p className="text-xs text-gray-300 font-medium line-clamp-2 leading-relaxed">
                          {project.description}
                        </p>
                      </div>

                      {/* Action */}
                      <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                        <button
                          onClick={() => setSelectedVideoProject(project)}
                          className="text-xs font-black uppercase tracking-wider text-[#F26522] hover:underline flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Play size={14} className="fill-current" />
                          <span>Watch Field Video</span>
                        </button>
                        <Link
                          to="/outreach"
                          className="text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white"
                        >
                          Details &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </section>

      {/* Upcoming Programs Teaser */}
      {(() => {
        const upcoming = programs.filter(p => !isProgramExpired(p.date, p.isAlwaysVisible));
        const displayedPrograms = upcoming.length > 0 
          ? upcoming 
          : (programs.length > 0 ? programs.slice(0, 3) : DEFAULT_HOME_PROGRAMS);
        if (displayedPrograms.length === 0) return null;
        return (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-3xl font-black text-[#1A1F3C]">Upcoming & Active Programs</h2>
                <p className="text-gray-500 font-medium">Join our revival series across Nigeria.</p>
              </div>
              <Link to="/schedule" className="text-[#F26522] font-bold text-sm hover:underline">View Full Schedule</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {displayedPrograms.map((program) => (
                <ProgramFlyerCard
                  key={program.id}
                  program={program}
                  onSelectFlyer={(p) => setSelectedFlyer({
                    title: p.title,
                    imageUrl: p.imageUrl || '/flyer_lagos.jpg',
                    dates: p.date,
                    scripture: p.theme,
                    videoUrl: p.videoUrl
                  })}
                />
              ))}
            </div>
          </section>
        );
      })()}

      {/* Latest Media snippet */}
      {(() => {
        const featuredSermon = sermons.find(s => s.type === 'video') || sermons[0];
        if (!featuredSermon) return null;
        return (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-3xl font-black text-[#1A1F3C]">Latest Teaching</h2>
                <p className="text-gray-500 font-medium">Re-ignite your spirit with our recent messages.</p>
              </div>
              <Link to="/media" className="text-[#F26522] font-bold text-sm hover:underline flex items-center space-x-1">
                <span>Browse Archive</span>
                <ChevronRight size={16} />
              </Link>
            </div>
            <div 
              onClick={() => setSelectedSermonVideo(featuredSermon)}
              className="bg-[#1A1F3C] rounded-3xl overflow-hidden aspect-video relative group shadow-2xl border border-white/10 cursor-pointer"
            >
              <img 
                src={featuredSermon.thumbnailUrl || "https://images.unsplash.com/photo-1490161705155-d28c4210e9c1?auto=format&fit=crop&q=80"} 
                alt={featuredSermon.title} 
                className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSermonVideo(featuredSermon);
                  }}
                  className="w-20 h-20 bg-[#F26522] rounded-full flex items-center justify-center text-white shadow-2xl transform group-hover:scale-110 transition-transform cursor-pointer ring-4 ring-white/20"
                  aria-label="Play video"
                >
                  <Play className="w-8 h-8 fill-current ml-1" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 to-transparent">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="px-2.5 py-0.5 bg-[#F26522] text-white text-[10px] font-black uppercase tracking-wider rounded-md">
                    {featuredSermon.type === 'video' ? 'Video Teaching' : 'Audio Message'}
                  </span>
                  {featuredSermon.duration && (
                    <span className="text-gray-300 text-xs font-mono">{featuredSermon.duration}</span>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-[#F26522] transition-colors">{featuredSermon.title}</h3>
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 text-sm font-medium">
                    {featuredSermon.date ? `${featuredSermon.date} • ` : ''}{featuredSermon.minister || 'Anointed Minister of God'}
                  </p>
                  <span className="text-xs font-black uppercase text-[#F26522] group-hover:underline flex items-center space-x-1">
                    <span>Watch Now</span>
                    <Play size={12} className="fill-current" />
                  </span>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Testimonies Teaser */}
      <section className="bg-[#1A1F3C] py-24 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#F26522]/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-black">Miracles and Testimonies</h2>
            <p className="text-gray-400 max-w-2xl mx-auto italic font-medium">
              "And they overcame him by the blood of the Lamb and by the word of their testimony." — Revelation 12:11
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                text: "I was battling a chronic illness for 5 years, but after joining the 5:00 AM WAT prayers, God completely healed me. The doctors were amazed!",
                author: "Sister Grace",
                country: "United Kingdom",
                category: "Healing"
              },
              {
                text: "Financial doors that had been shut for years suddenly opened. I am now a partner in the Outreach program because of God's provision.",
                author: "Brother Emmanuel",
                country: "Nigeria",
                category: "Provision"
              },
              {
                text: "My family was on the verge of breaking apart, but the prayer points for Restoration saved my home. Glory to God!",
                author: "Anonymous",
                country: "Canada",
                category: "Restoration"
              }
            ].map((testimony, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -10 }}
                className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl space-y-6"
              >
                <div className="bg-[#F26522] w-10 h-10 rounded-lg flex items-center justify-center">
                  <Quote className="w-5 h-5 text-white" />
                </div>
                <p className="text-gray-300 leading-relaxed italic">"{testimony.text}"</p>
                <div className="flex justify-between items-center pt-4 border-t border-white/10">
                  <div>
                    <p className="font-bold">{testimony.author}</p>
                    <p className="text-[10px] uppercase tracking-widest text-[#F26522]">{testimony.country}</p>
                  </div>
                  <span className="text-[10px] bg-white/10 px-2 py-1 rounded font-bold uppercase tracking-widest">{testimony.category}</span>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to="/media" className="text-[#F26522] font-black uppercase tracking-[0.3em] text-xs hover:opacity-80">
              Read More Testimonies
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-8">
        <h2 className="text-3xl font-black text-[#1A1F3C]">Get Weekly Prayer Points</h2>
        <p className="text-gray-600 font-medium">Subscribe to receive this week's theme, scripture, and prayer points directly in your inbox.</p>
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            alert('Thank you for subscribing to Light Up weekly prayer alerts!');
          }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <input 
            type="email" 
            placeholder="Your Email Address" 
            className="flex-grow px-6 py-4 rounded-xl border-2 border-gray-100 focus:border-[#F26522] outline-none transition-all font-medium"
            required
          />
          <button className="px-10 py-4 bg-[#F26522] text-white rounded-xl font-bold hover:shadow-lg hover:shadow-[#F26522]/30 transition-all cursor-pointer">
            Subscribe Now
          </button>
        </form>
      </section>
    </div>
  );
}
