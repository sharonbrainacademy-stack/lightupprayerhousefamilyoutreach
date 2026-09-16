/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Video, Lock, ExternalLink, Globe, MapPin, Maximize2, X, Download, History, Sparkles, BookOpen, Flame } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { PrayerClock } from '../components/PrayerClock';
import { ZoomAttendanceCard } from '../components/ZoomAttendanceCard';
import { db } from '../lib/firebase';
import { ProgramItem, WeeklyTheme } from '../types';
import { ProgramFlyerCard } from '../components/ProgramFlyerCard';
import { isProgramExpired } from '../lib/programs';
import FlyerModal from '../components/FlyerModal';
import { getThemeFlyerUrl } from '../lib/image-utils';

const DEFAULT_SCHEDULE_PROGRAMS: ProgramItem[] = [
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

export default function Schedule() {
  const [programs, setPrograms] = useState<ProgramItem[]>(DEFAULT_SCHEDULE_PROGRAMS);
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
  const [activeProgramTab, setActiveProgramTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedFlyer, setSelectedFlyer] = useState<{ title: string; imageUrl: string; theme?: string; date?: string; location?: string; videoUrl?: string; scripture?: string } | null>(null);

  useEffect(() => {
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
        console.error('Error fetching programs:', err);
      }
    );

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
        console.error('Error fetching themes for Schedule:', err);
      }
    );

    return () => {
      unsubPrograms();
      unsubThemes();
    };
  }, []);

  const upcomingPrograms = programs.filter(p => !isProgramExpired(p.date, p.isAlwaysVisible));
  const pastPrograms = programs.filter(p => isProgramExpired(p.date, p.isAlwaysVisible));

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
          <h1 className="text-5xl font-black text-white uppercase tracking-tight">Prayer <span className="text-[#F26522]">Schedule</span></h1>
          <p className="text-gray-400 max-w-2xl mx-auto font-medium">
            Join our global family every weekday as we lift up our voices to the King of Kings.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left: Rhythm & Zoom */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 space-y-6">
              <div className="flex items-center space-x-3 text-[#F26522]">
                <Clock className="w-6 h-6" />
                <h2 className="text-xl font-black uppercase tracking-tight">Weekly Rhythm</h2>
              </div>
              <p className="text-gray-600 font-medium leading-relaxed">
                Our main prayer sessions happen every weekday from <span className="font-bold text-[#1A1F3C]">Monday to Friday</span>.
              </p>
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <div className="text-3xl font-black text-[#1A1F3C]">5:00 AM</div>
                <div className="text-xs font-black text-[#F26522] uppercase tracking-widest mt-1">Nigeria Time (WAT)</div>
              </div>
            </div>

            <ZoomAttendanceCard />
          </div>

          {/* Right: Timezone Converter & Calendar */}
          <div className="lg:col-span-2 space-y-12">
            <div>
              <div className="flex items-center space-x-3 mb-8">
                <Globe className="w-8 h-8 text-[#F26522]" />
                <h2 className="text-3xl font-black text-[#1A1F3C]">Global Time Converter</h2>
              </div>
              <PrayerClock />
            </div>

            {/* Weekly Theme Banner */}
            {currentTheme && (
              <div className="bg-[#1A1F3C] rounded-3xl overflow-hidden shadow-xl border border-white/10 text-white flex flex-col md:flex-row">
                <div 
                  onClick={() => setSelectedFlyer({
                    title: currentTheme.title,
                    imageUrl: getThemeFlyerUrl(currentTheme),
                    date: currentTheme.dates,
                    scripture: currentTheme.scripture,
                    theme: currentTheme.title
                  })}
                  className="md:w-2/5 min-h-[220px] relative group cursor-pointer overflow-hidden bg-black/40 flex items-center justify-center shrink-0"
                >
                  <img 
                    src={getThemeFlyerUrl(currentTheme)} 
                    alt={currentTheme.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/theme_assignment.jpg';
                    }}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="px-3 py-1.5 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-xl">
                      <Maximize2 size={14} />
                      <span>View Theme Flyer</span>
                    </span>
                  </div>
                </div>

                <div className="md:w-3/5 p-6 md:p-8 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#F26522] text-[10px] font-black uppercase tracking-widest mb-3">
                      <Flame className="w-3 h-3" />
                      <span>This Week's Theme</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-black italic text-white leading-snug">{currentTheme.title}</h3>
                    <p className="text-xs font-serif italic text-gray-300 mt-2">"{currentTheme.scripture}"</p>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-bold">{currentTheme.dates}</span>
                    <button 
                      onClick={() => setSelectedFlyer({
                        title: currentTheme.title,
                        imageUrl: getThemeFlyerUrl(currentTheme),
                        date: currentTheme.dates,
                        scripture: currentTheme.scripture,
                        theme: currentTheme.title
                      })}
                      className="text-xs font-black uppercase tracking-widest text-[#F26522] hover:text-[#d9561a] flex items-center space-x-1.5"
                    >
                      <span>Enlarge Flyer</span>
                      <Maximize2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center space-x-3">
                  <CalendarIcon className="w-8 h-8 text-[#F26522]" />
                  <div>
                    <h2 className="text-3xl font-black text-[#1A1F3C]">Ministry Calendar</h2>
                    <p className="text-xs font-bold text-[#F26522] uppercase tracking-wider">Live Prayer Sessions: Monday to Friday (5:00 AM WAT)</p>
                  </div>
                </div>
              </div>

              {/* Calendar Legend Bar */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span className="text-[#1A1F3C]"><strong>Monday – Friday:</strong> 5:00 AM WAT Live Prayer</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-[#F26522]"></span>
                  <span className="text-[#1A1F3C]"><strong>Special Revival Programs:</strong> Intensive Weeks</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-gray-300"></span>
                  <span className="text-gray-500"><strong>Sat & Sun:</strong> Weekend Fellowship</span>
                </div>
              </div>
              
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
                  {[
                    { label: 'Sun', isWeekday: false },
                    { label: 'Mon', isWeekday: true },
                    { label: 'Tue', isWeekday: true },
                    { label: 'Wed', isWeekday: true },
                    { label: 'Thu', isWeekday: true },
                    { label: 'Fri', isWeekday: true },
                    { label: 'Sat', isWeekday: false },
                  ].map((day, idx) => (
                    <div 
                      key={idx} 
                      className={`py-3 text-center text-[11px] font-black uppercase tracking-widest border-r border-gray-100 last:border-0 ${
                        day.isWeekday ? "text-[#F26522] bg-amber-500/5" : "text-gray-400"
                      }`}
                    >
                      {day.label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 min-h-[420px]">
                  {Array.from({ length: 35 }).map((_, i) => {
                    const colIndex = i % 7;
                    const isMonToFri = colIndex >= 1 && colIndex <= 5;
                    const dayNum = i + 1;

                    return (
                      <div 
                        key={i} 
                        className={`border-r border-b border-gray-100 p-2.5 group transition-colors relative flex flex-col justify-between ${
                          isMonToFri ? "bg-amber-500/5 hover:bg-amber-500/10" : "bg-gray-50/40 hover:bg-gray-100/50"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`text-xs font-black ${isMonToFri ? "text-[#1A1F3C]" : "text-gray-400"}`}>
                            {dayNum}
                          </span>
                          {isMonToFri && (
                            <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                              PRAYER
                            </span>
                          )}
                        </div>

                        {i >= 26 && i <= 30 && (
                          <div className="my-1 bg-[#F26522] text-white text-[8px] font-black p-1 rounded-md uppercase tracking-tighter shadow-sm">
                            🔥 Assignment Program
                          </div>
                        )}

                        {isMonToFri ? (
                          <div className="mt-1 bg-emerald-600/10 border border-emerald-500/20 text-emerald-800 text-[8px] font-black p-1 rounded-md uppercase tracking-tighter flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                            <span className="truncate">5:00 AM Prayer</span>
                          </div>
                        ) : (
                          <div className="mt-1 text-gray-400 text-[8px] font-bold uppercase tracking-tighter italic">
                            Weekend
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-gray-100">
        <div className="text-center mb-10 space-y-4">
          <h2 className="text-4xl font-black text-[#1A1F3C] uppercase tracking-tight">
            {activeProgramTab === 'upcoming' ? (
              <>Upcoming <span className="text-[#F26522]">Programs</span></>
            ) : (
              <>Past Programs <span className="text-[#F26522]">Archive</span></>
            )}
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto font-medium">
            {activeProgramTab === 'upcoming' 
              ? 'Join us across Nigeria for our powerful upcoming revival services, rallies, and special programs.'
              : 'Browse recordings and details from our previous powerful church gatherings and rallies.'}
          </p>

          {/* Tab Switcher if past programs exist */}
          {pastPrograms.length > 0 && (
            <div className="inline-flex items-center p-1.5 bg-gray-100 rounded-2xl space-x-1.5 shadow-inner mt-4">
              <button
                type="button"
                onClick={() => setActiveProgramTab('upcoming')}
                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-2 ${
                  activeProgramTab === 'upcoming'
                    ? 'bg-[#1A1F3C] text-white shadow-md'
                    : 'text-gray-600 hover:text-[#1A1F3C]'
                }`}
              >
                <Sparkles size={14} className={activeProgramTab === 'upcoming' ? 'text-[#F26522]' : ''} />
                <span>Upcoming Programs ({upcomingPrograms.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveProgramTab('past')}
                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-2 ${
                  activeProgramTab === 'past'
                    ? 'bg-[#1A1F3C] text-white shadow-md'
                    : 'text-gray-600 hover:text-[#1A1F3C]'
                }`}
              >
                <History size={14} className={activeProgramTab === 'past' ? 'text-[#F26522]' : ''} />
                <span>Past Archive ({pastPrograms.length})</span>
              </button>
            </div>
          )}
        </div>

        {activeProgramTab === 'upcoming' ? (
          upcomingPrograms.length === 0 ? (
            pastPrograms.length > 0 ? (
              <div className="space-y-8">
                <div className="bg-orange-50/80 border border-orange-200 p-4 rounded-2xl text-center max-w-xl mx-auto">
                  <p className="text-xs font-bold text-orange-950">
                    Displaying active revival series rallies and scheduled gatherings below:
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {pastPrograms.map((program) => (
                    <ProgramFlyerCard
                      key={program.id}
                      program={program}
                      onSelectFlyer={(p) => setSelectedFlyer({
                        title: p.title,
                        imageUrl: p.imageUrl || '/flyer_lagos.jpg',
                        theme: p.theme,
                        date: p.date,
                        location: p.location,
                        videoUrl: p.videoUrl
                      })}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-3xl p-12 text-center border border-gray-100 max-w-xl mx-auto space-y-3">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto text-gray-400 shadow-sm">
                  <CalendarIcon size={24} />
                </div>
                <h4 className="text-lg font-black text-[#1A1F3C]">No Upcoming Programs Scheduled</h4>
                <p className="text-gray-500 text-xs leading-relaxed">
                  There are no active upcoming programs at the moment. Check back soon for announcements on our next revival rallies and special church programs.
                </p>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {upcomingPrograms.map((program) => (
                <ProgramFlyerCard
                  key={program.id}
                  program={program}
                  onSelectFlyer={(p) => setSelectedFlyer({
                    title: p.title,
                    imageUrl: p.imageUrl || '/flyer_lagos.jpg',
                    theme: p.theme,
                    date: p.date,
                    location: p.location,
                    videoUrl: p.videoUrl
                  })}
                />
              ))}
            </div>
          )
        ) : (
          /* Past Programs Archive View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pastPrograms.map((program) => (
              <ProgramFlyerCard
                key={program.id}
                program={program}
                onSelectFlyer={(p) => setSelectedFlyer({
                  title: p.title,
                  imageUrl: p.imageUrl || '/flyer_lagos.jpg',
                  theme: p.theme,
                  date: p.date,
                  location: p.location,
                  videoUrl: p.videoUrl
                })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
