/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  Flame, 
  Sparkles, 
  Search, 
  Share2, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  ExternalLink, 
  PenTool, 
  Printer, 
  RotateCcw, 
  ChevronRight, 
  ChevronDown, 
  Award, 
  Calendar, 
  Heart, 
  ArrowRight,
  Filter,
  Layers,
  FileText,
  X,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  THIRTY_DAYS_READING_PLAN, 
  getLocalReadingPlanProgress, 
  saveLocalReadingPlanProgress, 
  syncUserReadingProgress, 
  loadUserReadingProgress 
} from '../lib/reading-plan';
import { ReadingPlanDay, ReadingPlanProgress } from '../types';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';
import { generateWhatsAppShareUrl } from '../lib/whatsapp';

export default function ReadingPlan() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ReadingPlanProgress>(getLocalReadingPlanProgress());
  const [activeDayNumber, setActiveDayNumber] = useState<number>(1);
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<number | 'all' | 'uncompleted' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedDay, setCopiedDay] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [activeSpeakingDay, setActiveSpeakingDay] = useState<number | null>(null);
  const [expandedNotesDay, setExpandedNotesDay] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [showCelebrationModal, setShowCelebrationModal] = useState<boolean>(false);
  const [printMode, setPrintMode] = useState<boolean>(false);
  const [quickDayDetailModal, setQuickDayDetailModal] = useState<ReadingPlanDay | null>(null);

  // Sync with Firestore if user is authenticated
  useEffect(() => {
    async function syncProgress() {
      if (user?.uid) {
        const cloudProgress = await loadUserReadingProgress(user.uid);
        if (cloudProgress && cloudProgress.completedDays.length > 0) {
          setProgress(prev => {
            const mergedCompleted = Array.from(new Set([...prev.completedDays, ...cloudProgress.completedDays]));
            const mergedNotes = { ...prev.notes, ...cloudProgress.notes };
            const updated = {
              ...prev,
              completedDays: mergedCompleted,
              notes: mergedNotes,
              streak: Math.max(prev.streak, cloudProgress.streak, mergedCompleted.length)
            };
            saveLocalReadingPlanProgress(updated);
            return updated;
          });
        }
      }
    }
    syncProgress();
  }, [user]);

  // Set active day to first uncompleted day on initial load
  useEffect(() => {
    const firstIncomplete = THIRTY_DAYS_READING_PLAN.find(d => !progress.completedDays.includes(d.day));
    if (firstIncomplete) {
      setActiveDayNumber(firstIncomplete.day);
    }
  }, []);

  const totalDays = THIRTY_DAYS_READING_PLAN.length;
  const completedCount = progress.completedDays.length;
  const completionPercentage = Math.round((completedCount / totalDays) * 100);

  // Check if today was just completed
  const handleToggleComplete = (dayNum: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    setProgress(prev => {
      const isAlreadyDone = prev.completedDays.includes(dayNum);
      const newCompleted = isAlreadyDone 
        ? prev.completedDays.filter(d => d !== dayNum)
        : [...prev.completedDays, dayNum];

      const newStreak = newCompleted.length;
      const updated: ReadingPlanProgress = {
        ...prev,
        completedDays: newCompleted,
        lastActiveDate: new Date().toISOString(),
        streak: newStreak
      };

      saveLocalReadingPlanProgress(updated);
      if (user?.uid) {
        syncUserReadingProgress(user.uid, updated);
      }

      // If user completed the 30th day (or all 30 days), trigger celebration
      if (!isAlreadyDone && newCompleted.length === 30) {
        setShowCelebrationModal(true);
      }

      return updated;
    });
  };

  const handleSaveNote = (dayNum: number) => {
    setProgress(prev => {
      const updatedNotes = {
        ...prev.notes,
        [dayNum]: noteText
      };
      const updated: ReadingPlanProgress = {
        ...prev,
        notes: updatedNotes
      };
      saveLocalReadingPlanProgress(updated);
      if (user?.uid) {
        syncUserReadingProgress(user.uid, updated);
      }
      return updated;
    });
    setExpandedNotesDay(null);
  };

  const handleResetProgress = () => {
    if (window.confirm('Are you sure you want to reset your 30-Day Reading Plan progress? Your notes and completed checkmarks will be cleared.')) {
      const reset: ReadingPlanProgress = {
        completedDays: [],
        notes: {},
        startDate: new Date().toISOString(),
        lastActiveDate: new Date().toISOString(),
        streak: 0
      };
      setProgress(reset);
      saveLocalReadingPlanProgress(reset);
      if (user?.uid) {
        syncUserReadingProgress(user.uid, reset);
      }
    }
  };

  // Speech synthesis audio narration
  const handleToggleSpeak = (day: ReadingPlanDay) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this browser.');
      return;
    }

    if (isSpeaking && activeSpeakingDay === day.day) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setActiveSpeakingDay(null);
      return;
    }

    window.speechSynthesis.cancel();

    const textToRead = `Day ${day.day}. ${day.theme}. Scripture: ${day.scriptureReference}. Key Verse from ${day.keyVerse}: "${day.keyVerseText}". Devotional Insight: ${day.devotionalInsight}. Daily Prayer Points: ${day.prayerPoints.join('. ')}. Declaration: ${day.declaration}.`;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => {
      setIsSpeaking(false);
      setActiveSpeakingDay(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setActiveSpeakingDay(null);
    };

    setActiveSpeakingDay(day.day);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Copy Day content to clipboard
  const handleCopyDay = (day: ReadingPlanDay, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const formatted = `🔥 LIGHT UP PRAYER HOUSE — 30-DAY SCRIPTURE PLAN\n\n📖 DAY ${day.day}: ${day.theme.toUpperCase()}\n📖 Passage: ${day.scriptureReference}\n\nKey Verse (${day.keyVerse}):\n"${day.keyVerseText}"\n\n💡 Devotional Insight:\n${day.devotionalInsight}\n\n🙏 Prayer Points:\n${day.prayerPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n🗣️ Prophetic Declaration:\n"${day.declaration}"\n\nJoin our Daily Online Prayers at: https://lightupprayerhousefamilyoutreach.com`;

    navigator.clipboard.writeText(formatted);
    setCopiedDay(day.day);
    setTimeout(() => setCopiedDay(null), 3000);
  };

  // Share to WhatsApp
  const handleShareWhatsApp = (day: ReadingPlanDay, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const text = `*LIGHT UP PRAYER HOUSE — 30-DAY SCRIPTURE PLAN*\n\n🔥 *DAY ${day.day}: ${day.theme.toUpperCase()}*\n📖 *Passage:* ${day.scriptureReference}\n\n*Key Verse (${day.keyVerse}):*\n"${day.keyVerseText}"\n\n💡 *Devotional Insight:*\n${day.devotionalInsight}\n\n🙏 *Prayer Points:*\n${day.prayerPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n🗣️ *Declaration:*\n"${day.declaration}"`;
    
    const url = generateWhatsAppShareUrl(text);
    window.open(url, '_blank');
  };

  // Filter days
  const filteredDays = useMemo(() => {
    return THIRTY_DAYS_READING_PLAN.filter(day => {
      // Week / Completion filter
      if (selectedWeekFilter === 'completed') {
        if (!progress.completedDays.includes(day.day)) return false;
      } else if (selectedWeekFilter === 'uncompleted') {
        if (progress.completedDays.includes(day.day)) return false;
      } else if (selectedWeekFilter !== 'all') {
        if (day.week !== selectedWeekFilter) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTheme = day.theme.toLowerCase().includes(query);
        const matchesScripture = day.scriptureReference.toLowerCase().includes(query);
        const matchesVerse = day.keyVerseText.toLowerCase().includes(query);
        const matchesInsight = day.devotionalInsight.toLowerCase().includes(query);
        const matchesDay = `day ${day.day}`.includes(query) || `${day.day}` === query;
        if (!matchesTheme && !matchesScripture && !matchesVerse && !matchesInsight && !matchesDay) {
          return false;
        }
      }

      return true;
    });
  }, [selectedWeekFilter, searchQuery, progress.completedDays]);

  const activeDay = THIRTY_DAYS_READING_PLAN.find(d => d.day === activeDayNumber) || THIRTY_DAYS_READING_PLAN[0];

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A1F3C] pb-28">
      {/* Header Banner */}
      <section className="bg-gradient-to-br from-[#121528] via-[#1A1F3C] to-[#252C54] text-white py-16 sm:py-20 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#F26522]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/10 text-amber-300 text-xs font-black uppercase tracking-widest border border-white/10 shadow-sm">
                <Flame size={14} className="fill-current text-[#F26522]" />
                <span>Spiritual Growth & Prayer Journey</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-tight">
                30-Day Scripture <br className="hidden sm:inline" />
                <span className="text-[#F26522]">Reading Plan</span>
              </h1>
              <p className="text-gray-300 text-sm sm:text-base font-medium leading-relaxed">
                Awaken the Holy Spirit fire, discover your divine kingdom assignment, build prevailing prayer strength, and walk in total covenant victory with curated daily scriptures, devotional insights, and prayer decrees.
              </p>
              
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
                <button
                  onClick={() => {
                    const firstIncomplete = THIRTY_DAYS_READING_PLAN.find(d => !progress.completedDays.includes(d.day));
                    if (firstIncomplete) {
                      setActiveDayNumber(firstIncomplete.day);
                      setQuickDayDetailModal(firstIncomplete);
                    } else {
                      setQuickDayDetailModal(THIRTY_DAYS_READING_PLAN[0]);
                    }
                  }}
                  className="px-6 py-3.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-[#F26522]/30 flex items-center space-x-2 transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <BookOpen size={16} />
                  <span>
                    {progress.completedDays.length === 30 ? 'Review All 30 Days' : `Read Day ${activeDayNumber} Today`}
                  </span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer"
                  title="Print entire 30-Day Guide"
                >
                  <Printer size={16} />
                  <span>Print Guide</span>
                </button>

                {progress.completedDays.length > 0 && (
                  <button
                    onClick={handleResetProgress}
                    className="px-4 py-3.5 text-gray-400 hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                    title="Reset reading progress"
                  >
                    <RotateCcw size={14} />
                    <span>Reset Progress</span>
                  </button>
                )}
              </div>
            </div>

            {/* Progress & Streak Card */}
            <div className="w-full lg:w-96 bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/15 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider block">Your 30-Day Journey</span>
                  <h3 className="text-xl font-black text-white">Overall Progress</h3>
                </div>
                <div className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-black flex items-center space-x-1">
                  <Flame size={14} className="fill-current text-[#F26522]" />
                  <span>{progress.streak} Day Streak</span>
                </div>
              </div>

              {/* Progress Bar & Stat */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-gray-300">
                  <span>{completedCount} of 30 Days Completed</span>
                  <span className="text-[#F26522] font-black">{completionPercentage}%</span>
                </div>
                <div className="w-full h-3.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-amber-500 to-[#F26522] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPercentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* 4 Weekly Breakdown Mini Status */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/10">
                {[
                  { label: 'Week 1', desc: 'Fire', range: [1, 2, 3, 4, 5, 6, 7] },
                  { label: 'Week 2', desc: 'Identity', range: [8, 9, 10, 11, 12, 13, 14] },
                  { label: 'Week 3', desc: 'Warfare', range: [15, 16, 17, 18, 19, 20, 21] },
                  { label: 'Week 4+', desc: 'Victory', range: [22, 23, 24, 25, 26, 27, 28, 29, 30] },
                ].map((w, idx) => {
                  const doneInWeek = w.range.filter(d => progress.completedDays.includes(d)).length;
                  const isWeekFull = doneInWeek === w.range.length;
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedWeekFilter(idx === 3 ? 4 : idx + 1)}
                      className={cn(
                        "p-2 rounded-xl text-center border transition-all cursor-pointer",
                        isWeekFull 
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                          : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                      )}
                    >
                      <span className="text-[10px] font-black uppercase block">{w.label}</span>
                      <span className="text-[9px] text-gray-400 block truncate">{w.desc}</span>
                      <span className="text-xs font-black text-white mt-1 block">
                        {doneInWeek}/{w.range.length}
                      </span>
                    </div>
                  );
                })}
              </div>

              {completionPercentage === 100 && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-400/50 rounded-2xl flex items-center space-x-2 text-emerald-200 text-xs font-bold">
                  <Award size={20} className="text-amber-400 shrink-0" />
                  <span>Glory to God! You have completed all 30 days of scripture reading!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Controls & Filter Bar */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search scripture, topic, verse or day..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 rounded-2xl text-xs sm:text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522] focus:bg-white transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center space-x-2 text-xs font-black uppercase text-gray-500 self-start md:self-center">
              <span>Showing:</span>
              <span className="px-3 py-1 bg-[#1A1F3C] text-white rounded-full">
                {filteredDays.length} {filteredDays.length === 1 ? 'Day' : 'Days'}
              </span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            {[
              { id: 'all', label: 'All 30 Days' },
              { id: 1, label: 'Week 1: Fire & Awakening' },
              { id: 2, label: 'Week 2: Identity & Assignment' },
              { id: 3, label: 'Week 3: Prayer & Warfare' },
              { id: 4, label: 'Week 4: Restoration & Healing' },
              { id: 5, label: 'Days 29-30: Covenant Praise' },
              { id: 'uncompleted', label: 'Remaining To Read' },
              { id: 'completed', label: 'Completed' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedWeekFilter(f.id as any)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                  selectedWeekFilter === f.id
                    ? "bg-[#F26522] text-white shadow-md shadow-[#F26522]/30 font-black"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 30-Day Grid Layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Days Grid Column (Left/Center) */}
          <div className="lg:col-span-8 space-y-4">
            {filteredDays.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 space-y-3">
                <BookOpen size={48} className="mx-auto text-gray-300" />
                <h4 className="text-lg font-black text-[#1A1F3C]">No reading days match your search.</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Try clearing your search query or selecting "All 30 Days" filter to see the complete guide.
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedWeekFilter('all'); }}
                  className="px-4 py-2 bg-[#F26522] text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              filteredDays.map((day) => {
                const isCompleted = progress.completedDays.includes(day.day);
                const isSelected = activeDayNumber === day.day;
                const hasNote = !!progress.notes[day.day];

                return (
                  <motion.div
                    key={day.day}
                    layout
                    id={`day-${day.day}`}
                    onClick={() => {
                      setActiveDayNumber(day.day);
                    }}
                    className={cn(
                      "bg-white rounded-3xl p-5 sm:p-6 transition-all border cursor-pointer group shadow-sm hover:shadow-md relative overflow-hidden",
                      isSelected 
                        ? "border-[#F26522] ring-2 ring-[#F26522]/20" 
                        : isCompleted 
                        ? "border-emerald-200 bg-emerald-50/20" 
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    {/* Top Row: Day Badge + Week Theme + Action Buttons */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        {/* Interactive Checkbox */}
                        <button
                          onClick={(e) => handleToggleComplete(day.day, e)}
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0",
                            isCompleted 
                              ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105" 
                              : "bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600 border border-gray-300"
                          )}
                          title={isCompleted ? "Mark as unread" : "Mark as read & completed"}
                        >
                          {isCompleted ? <Check size={18} strokeWidth={3} /> : <Circle size={18} />}
                        </button>

                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={cn(
                              "text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                              isCompleted 
                                ? "bg-emerald-100 text-emerald-800" 
                                : "bg-[#1A1F3C] text-white"
                            )}>
                              DAY {day.day < 10 ? `0${day.day}` : day.day}
                            </span>
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
                              Week {day.week}: {day.weekTitle}
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-black text-[#1A1F3C] mt-1 group-hover:text-[#F26522] transition-colors">
                            {day.theme}
                          </h3>
                        </div>
                      </div>

                      {/* Right action tools */}
                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Audio Speak */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSpeak(day);
                          }}
                          className={cn(
                            "p-2 rounded-xl transition-all cursor-pointer",
                            isSpeaking && activeSpeakingDay === day.day
                              ? "bg-[#F26522] text-white animate-pulse"
                              : "text-gray-400 hover:text-[#1A1F3C] hover:bg-gray-100"
                          )}
                          title="Listen to scripture & prayer aloud"
                        >
                          {isSpeaking && activeSpeakingDay === day.day ? <Volume2 size={16} /> : <Volume2 size={16} />}
                        </button>

                        {/* WhatsApp Share */}
                        <button
                          onClick={(e) => handleShareWhatsApp(day, e)}
                          className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer"
                          title="Share to WhatsApp"
                        >
                          <Share2 size={16} />
                        </button>

                        {/* Copy Day */}
                        <button
                          onClick={(e) => handleCopyDay(day, e)}
                          className="p-2 text-gray-400 hover:text-[#F26522] hover:bg-orange-50 rounded-xl transition-all cursor-pointer"
                          title="Copy scripture & prayer"
                        >
                          {copiedDay === day.day ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Scripture Reference Banner */}
                    <div className="mt-3.5 p-3.5 bg-orange-50/60 rounded-2xl border border-orange-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <BookOpen size={16} className="text-[#F26522] shrink-0" />
                        <span className="text-xs font-black text-[#1A1F3C]">
                          Passage: <span className="text-[#F26522] font-black">{day.scriptureReference}</span>
                        </span>
                      </div>

                      <a
                        href={`https://www.biblegateway.com/passage/?search=${day.bibleGatewayQuery || encodeURIComponent(day.scriptureReference)}&version=KJV`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] font-black text-[#1A1F3C] hover:text-[#F26522] flex items-center space-x-1 self-start sm:self-center"
                      >
                        <span>Open in Bible Gateway</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    {/* Key Verse Quote Box */}
                    <div className="mt-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                        Memory Verse ({day.keyVerse})
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-gray-800 italic leading-relaxed">
                        "{day.keyVerseText}"
                      </p>
                    </div>

                    {/* Expanded Content Preview (Always visible or toggled) */}
                    <div className="mt-4 space-y-3 pt-3 border-t border-gray-100">
                      <div>
                        <span className="text-[11px] font-black uppercase text-[#1A1F3C] block mb-1">
                          Devotional Insight:
                        </span>
                        <p className="text-xs text-gray-600 leading-relaxed font-medium">
                          {day.devotionalInsight}
                        </p>
                      </div>

                      {/* Prayer Points */}
                      <div className="space-y-1.5 bg-amber-50/40 p-3 rounded-2xl border border-amber-200/50">
                        <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider flex items-center space-x-1">
                          <Flame size={12} className="text-[#F26522]" />
                          <span>Today's Prayer Decrees:</span>
                        </span>
                        <ul className="space-y-1 text-xs font-semibold text-gray-700">
                          {day.prayerPoints.map((p, pIdx) => (
                            <li key={pIdx} className="flex items-start space-x-1.5">
                              <span className="text-[#F26522] font-black shrink-0">•</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Prophetic Declaration */}
                      <div className="p-3 bg-[#1A1F3C] text-white rounded-2xl space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                          Daily Prophetic Declaration:
                        </span>
                        <p className="text-xs font-bold text-amber-50 italic">
                          "{day.declaration}"
                        </p>
                      </div>

                      {/* Notes / Journal Section */}
                      <div className="pt-2">
                        {expandedNotesDay === day.day ? (
                          <div className="p-4 bg-white rounded-2xl border-2 border-[#F26522] space-y-3 shadow-md">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black uppercase text-[#1A1F3C] flex items-center space-x-1">
                                <PenTool size={14} className="text-[#F26522]" />
                                <span>My Reflection Notes for Day {day.day}</span>
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedNotesDay(null);
                                }}
                                className="text-gray-400 hover:text-gray-600 p-1"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              placeholder="Write what the Holy Spirit revealed to you during today's reading..."
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full p-3 bg-gray-50 rounded-xl text-xs font-medium border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522]"
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveNote(day.day);
                                }}
                                className="px-4 py-2 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer"
                              >
                                Save Note
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-xs pt-1">
                            {hasNote ? (
                              <div className="flex items-center space-x-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                <MessageSquare size={14} />
                                <span className="font-bold text-[11px] truncate max-w-xs">
                                  Note: "{progress.notes[day.day]}"
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[11px] font-medium">No reflection written yet.</span>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNoteText(progress.notes[day.day] || '');
                                setExpandedNotesDay(day.day);
                              }}
                              className="text-[11px] font-black text-[#F26522] hover:underline flex items-center space-x-1 cursor-pointer"
                            >
                              <PenTool size={12} />
                              <span>{hasNote ? 'Edit Note' : 'Add Reflection'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Sticky Quick-Focus & Resources Sidebar (Right Column) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Active Day Focus Highlight Card */}
            <div className="bg-[#1A1F3C] text-white rounded-3xl p-6 shadow-2xl border border-white/10 space-y-5 lg:sticky lg:top-24">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider block">Currently Focused</span>
                  <h3 className="text-xl font-black text-white">Day {activeDay.day} Devotional</h3>
                </div>
                <button
                  onClick={(e) => handleToggleComplete(activeDay.day, e)}
                  className={cn(
                    "px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer",
                    progress.completedDays.includes(activeDay.day)
                      ? "bg-emerald-500 text-white"
                      : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  )}
                >
                  <Check size={14} />
                  <span>{progress.completedDays.includes(activeDay.day) ? 'Completed' : 'Mark Done'}</span>
                </button>
              </div>

              <div className="space-y-3">
                <span className="px-2.5 py-0.5 rounded-full bg-[#F26522]/20 text-[#F26522] text-[10px] font-black uppercase tracking-widest border border-[#F26522]/30">
                  {activeDay.weekTitle}
                </span>
                <h4 className="text-lg font-black text-white leading-snug">
                  {activeDay.theme}
                </h4>
                <p className="text-xs font-bold text-amber-400">
                  📖 {activeDay.scriptureReference}
                </p>
              </div>

              {/* Memory Verse Box */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block">
                  {activeDay.keyVerse}
                </span>
                <p className="text-xs font-medium text-gray-200 italic leading-relaxed">
                  "{activeDay.keyVerseText}"
                </p>
              </div>

              {/* Audio Listen Button */}
              <button
                onClick={() => handleToggleSpeak(activeDay)}
                className={cn(
                  "w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg",
                  isSpeaking && activeSpeakingDay === activeDay.day
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-[#F26522] hover:bg-[#d9561a] text-white shadow-[#F26522]/30"
                )}
              >
                {isSpeaking && activeSpeakingDay === activeDay.day ? (
                  <>
                    <VolumeX size={16} />
                    <span>Stop Audio Narration</span>
                  </>
                ) : (
                  <>
                    <Volume2 size={16} />
                    <span>Listen & Pray Aloud</span>
                  </>
                )}
              </button>

              {/* Ministry Prayer Times Connection Card */}
              <div className="p-4 bg-gradient-to-br from-amber-500/20 to-[#F26522]/20 rounded-2xl border border-amber-500/30 space-y-2">
                <div className="flex items-center space-x-2 text-amber-300 text-xs font-black uppercase tracking-wider">
                  <Flame size={14} className="fill-current text-[#F26522]" />
                  <span>Bring Scripture to Zoom Altar</span>
                </div>
                <p className="text-[11px] text-gray-300 font-medium leading-relaxed">
                  Join Pastor Osaro Aghedo and the Light Up Prayer House global prayer army daily on Zoom (6:00 AM & 10:00 PM WAT).
                </p>
                <a
                  href="/schedule"
                  className="text-xs font-black text-white hover:text-amber-300 flex items-center space-x-1 pt-1"
                >
                  <span>View Daily Prayer Schedule</span>
                  <ChevronRight size={14} />
                </a>
              </div>

              {/* 30-Day Certificate Sneak Peak */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2 text-center">
                <Award size={28} className="mx-auto text-amber-400" />
                <h5 className="text-xs font-black uppercase text-white tracking-wider">
                  30-Day Certificate of Completion
                </h5>
                <p className="text-[10px] text-gray-400 font-medium">
                  Complete all 30 days to unlock your personalized Certificate of Spiritual Dedication.
                </p>
                <span className="text-[11px] font-black text-amber-300 block">
                  {completedCount} / 30 Days Finished
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 30-DAY COMPLETION CELEBRATION MODAL */}
      <AnimatePresence>
        {showCelebrationModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={() => setShowCelebrationModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 sm:p-10 max-w-lg w-full text-center space-y-6 shadow-2xl border-4 border-amber-400 relative overflow-hidden"
            >
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-[#F26522] shadow-inner">
                <Award size={44} />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest">
                  Victory & Covenant Fulfillment
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-[#1A1F3C]">
                  Congratulations, Overcomer!
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 font-medium leading-relaxed">
                  You have successfully completed the <span className="font-bold text-[#F26522]">30-Day Scripture Reading Plan</span>. The fire on your altar will never go out, and the words of God planted in your heart will yield a hundredfold harvest!
                </p>
              </div>

              {/* Certificate Box */}
              <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 text-left">
                <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                  <span className="text-[10px] font-black uppercase text-amber-800">Certificate of Completion</span>
                  <Flame size={14} className="text-[#F26522]" />
                </div>
                <p className="text-xs font-bold text-[#1A1F3C]">
                  Presented to: <span className="text-[#F26522] font-black">{user?.displayName || 'Beloved in Christ'}</span>
                </p>
                <p className="text-[11px] text-gray-600">
                  For steadfast dedication in reading all 30 days of Scripture, Meditation, and Prophetic Prayer Declarations.
                </p>
                <span className="text-[9px] text-gray-400 font-bold block pt-1">
                  Issued: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • Light Up Prayer House Family Outreach
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2"
                >
                  <Printer size={16} />
                  <span>Print Certificate</span>
                </button>
                <button
                  onClick={() => setShowCelebrationModal(false)}
                  className="flex-1 py-3.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-[#F26522]/30"
                >
                  Amen & Continue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
