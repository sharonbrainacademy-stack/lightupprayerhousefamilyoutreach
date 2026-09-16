/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Calendar, User, BookOpen, ExternalLink, Flame, Maximize2, X, Download, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WeeklyTheme } from '../types';
import FlyerModal from '../components/FlyerModal';
import { getThemeFlyerUrl } from '../lib/image-utils';

const DEFAULT_THEMES: WeeklyTheme[] = [
  {
    id: '1',
    title: "THE ASSIGNMENT OF GOD IN MY LIFE",
    scripture: "Jeremiah 1:5, Proverbs 3:5-6",
    minister: "Pastor Osaro Aghedo & other Anointed Ministers of God",
    dates: "July 27 – 31, 2026",
    imageUrl: "/theme_assignment.jpg",
    prayerPoints: ["Discovery of divine assignment", "Grace for fulfillment", "Strategic direction"],
    isCurrent: true
  },
  {
    id: '2',
    title: "CHOSEN FOR GREATNESS",
    scripture: "Jer. 1:6, Gen. 12:1-3, Deut. 7:6",
    minister: "Pastor Osaro Aghedo & other Anointed Ministers of God",
    dates: "July 20 – 24, 2026",
    imageUrl: "/theme_greatness.jpg",
    prayerPoints: ["Covenant blessings", "Divine identity", "Manifestation of greatness"],
    isCurrent: false
  },
  {
    id: '3',
    title: "LET FIRE FALL",
    scripture: "1 Kings 18:36-39",
    minister: "Pastor Osaro Aghedo & other Anointed Ministers of God",
    dates: "July 13 – 17, 2026",
    imageUrl: "/theme_fire.jpg",
    prayerPoints: ["Divine intervention", "Answer by fire", "Revival of the spirit"],
    isCurrent: false
  }
];

export default function Themes() {
  const [themes, setThemes] = useState<WeeklyTheme[]>(DEFAULT_THEMES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFlyer, setSelectedFlyer] = useState<{ title: string; imageUrl: string; dates?: string; scripture?: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'themes'),
      (snapshot) => {
        const list: WeeklyTheme[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as WeeklyTheme);
        });
        if (list.length > 0) {
          setThemes(list);
        }
      },
      (err) => {
        console.error('Error listening to themes:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  const currentTheme = themes.find(t => t.isCurrent) || themes[0];

  const filteredThemes = themes.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.minister && t.minister.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="pb-24">
      {/* Full Screen Flyer Modal */}
      <FlyerModal
        isOpen={!!selectedFlyer}
        onClose={() => setSelectedFlyer(null)}
        flyer={selectedFlyer}
      />

      {/* Header */}
      <section className="bg-[#1A1F3C] py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h1 className="text-5xl font-black text-white uppercase tracking-tight">Weekly <span className="text-[#F26522]">Themes</span></h1>
          <p className="text-gray-400 max-w-2xl mx-auto font-medium">
            Explore the spiritual themes that guide our prayers and meditations throughout the year.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-12">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search themes or ministers..." 
              className="w-full pl-12 pr-6 py-4 rounded-xl border-2 border-gray-100 focus:border-[#F26522] outline-none transition-all font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="flex items-center space-x-2 px-6 py-4 bg-white border-2 border-gray-100 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all">
            <Filter className="w-5 h-5" />
            <span>Filter</span>
          </button>
        </div>

        {/* Current Theme Highlight */}
        {currentTheme && (
          <div className="mb-16">
            <h2 className="text-xs font-black text-[#F26522] uppercase tracking-[0.3em] mb-6">Current Week Highlight</h2>
            <div className="bg-[#1A1F3C] rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row border border-white/5">
              <div 
                onClick={() => setSelectedFlyer({
                  title: currentTheme.title,
                  imageUrl: getThemeFlyerUrl(currentTheme),
                  dates: currentTheme.dates,
                  scripture: currentTheme.scripture
                })}
                className="lg:w-2/5 min-h-[320px] relative group cursor-pointer overflow-hidden bg-black/40 flex items-center justify-center"
              >
                <img 
                  src={getThemeFlyerUrl(currentTheme)} 
                  alt={currentTheme.title || "Current Theme Flyer"} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/theme_assignment.jpg';
                  }}
                  referrerPolicy="no-referrer" 
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="px-4 py-2 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xl flex items-center space-x-2">
                    <Maximize2 size={16} />
                    <span>View Theme Flyer</span>
                  </div>
                </div>
              </div>

              <div className="lg:w-3/5 p-8 lg:p-12 space-y-6 text-white flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#F26522] text-[10px] font-black uppercase tracking-widest">
                    <Flame className="w-3 h-3" />
                    <span>Active Weekly Theme</span>
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-black italic leading-tight">{currentTheme.title}</h3>
                  <div className="flex flex-wrap gap-6 text-gray-400 text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-[#F26522]" />
                      <span>{currentTheme.dates}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-[#F26522]" />
                      <span>{currentTheme.minister}</span>
                    </div>
                  </div>
                  <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                    <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-[#F26522]">
                      <BookOpen className="w-4 h-4" />
                      <span>Scripture Focus</span>
                    </div>
                    <p className="text-lg lg:text-xl font-serif italic text-gray-200">"{currentTheme.scripture}"</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                  <button 
                    onClick={() => setSelectedFlyer({
                      title: currentTheme.title,
                      imageUrl: getThemeFlyerUrl(currentTheme),
                      dates: currentTheme.dates,
                      scripture: currentTheme.scripture
                    })}
                    className="px-6 py-3.5 bg-[#F26522] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#d9561a] transition-all flex items-center space-x-2 shadow-lg"
                  >
                    <Maximize2 size={16} />
                    <span>View Theme Flyer</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Theme Archive Grid */}
        <h2 className="text-xs font-black text-[#1A1F3C] uppercase tracking-[0.3em] mb-8">Theme Archive</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredThemes.map((theme) => (
            <motion.div 
              key={theme.id}
              whileHover={{ y: -6 }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 flex flex-col group"
            >
              <div 
                onClick={() => setSelectedFlyer({
                  title: theme.title,
                  imageUrl: getThemeFlyerUrl(theme),
                  dates: theme.dates,
                  scripture: theme.scripture
                })}
                className="aspect-[4/3] relative overflow-hidden bg-gray-900 cursor-pointer"
              >
                <img 
                  src={getThemeFlyerUrl(theme)} 
                  alt={theme.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/theme_assignment.jpg';
                  }}
                  referrerPolicy="no-referrer" 
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="px-3 py-1.5 bg-[#F26522] text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 shadow-lg">
                    <Maximize2 size={14} />
                    <span>Enlarge Flyer</span>
                  </span>
                </div>
                {theme.isCurrent && (
                  <div className="absolute top-4 left-4 px-2.5 py-1 bg-[#F26522] text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">
                    Active Theme
                  </div>
                )}
              </div>
              <div className="p-6 space-y-4 flex-grow">
                <div className="text-[10px] font-black text-[#F26522] uppercase tracking-widest">{theme.dates}</div>
                <h3 className="text-xl font-black text-[#1A1F3C] group-hover:text-[#F26522] transition-colors leading-tight line-clamp-2">
                  {theme.title}
                </h3>
                <p className="text-xs font-serif italic text-gray-500 line-clamp-2">"{theme.scripture}"</p>
                <div className="flex items-center space-x-2 text-xs text-gray-500 font-bold pt-1">
                  <User className="w-4 h-4 text-[#F26522]" />
                  <span>{theme.minister}</span>
                </div>
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <button 
                  onClick={() => setSelectedFlyer({
                    title: theme.title,
                    imageUrl: getThemeFlyerUrl(theme),
                    dates: theme.dates,
                    scripture: theme.scripture
                  })}
                  className="text-[10px] font-black uppercase tracking-widest text-[#F26522] hover:underline flex items-center space-x-1"
                >
                  <span>View Full Flyer</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 30-Day Scripture Reading Plan Callout Banner */}
        <div className="mt-20 bg-gradient-to-r from-[#1A1F3C] via-[#242A52] to-[#1A1F3C] rounded-3xl p-8 sm:p-12 text-white border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-[#F26522]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 text-center lg:text-left max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#F26522]/20 text-amber-300 rounded-full text-xs font-black uppercase tracking-wider border border-[#F26522]/30">
                <Flame size={14} className="fill-current text-[#F26522]" />
                <span>30-Day Spiritual Journey</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white">
                Take the 30-Day Scripture <br className="hidden sm:inline" />
                <span className="text-[#F26522]">Reading & Prayer Plan</span>
              </h2>
              <p className="text-gray-300 text-sm font-medium leading-relaxed">
                Complement these weekly themes with a structured day-by-day scripture plan. Track your progress, listen to verses aloud, take personal reflection notes, and build an unshakeable prayer life.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 shrink-0">
              <Link
                to="/reading-plan"
                className="px-8 py-4 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#F26522]/30 flex items-center justify-center space-x-2 transition-all hover:scale-105"
              >
                <BookOpen size={16} />
                <span>Open 30-Day Plan</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
