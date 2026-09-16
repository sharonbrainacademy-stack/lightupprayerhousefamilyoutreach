/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, Download, Headphones, Share2, Video, Camera, MessageSquare, 
  Search, Filter, ExternalLink, Sparkles, BookOpen, Clock, X, 
  Star, FileText, Check, ShoppingBag, Eye, Bookmark, Layers, ArrowRight, Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeSermons, SermonItem } from '../lib/media';
import { subscribeBooks, BookItem, BOOK_CATEGORIES } from '../lib/books';
import { parseVideoUrl } from '../lib/video-utils';
import { cn } from '../lib/utils';
import { BookReaderModal } from '../components/BookReaderModal';

export default function Media() {
  const [sermons, setSermons] = useState<SermonItem[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loadingSermons, setLoadingSermons] = useState(true);
  const [loadingBooks, setLoadingBooks] = useState(true);

  // Active Main Tab: 'all' | 'sermons' | 'books'
  const [activeMediaTab, setActiveMediaTab] = useState<'all' | 'sermons' | 'books'>('all');

  // Sermon Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'video' | 'audio'>('all');
  const [selectedSermon, setSelectedSermon] = useState<SermonItem | null>(null);

  // Book Filters & Preview Modal
  const [bookCategory, setBookCategory] = useState<string>('all');
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [copiedBookLink, setCopiedBookLink] = useState(false);

  // Subscribe to Sermons
  useEffect(() => {
    const unsubscribe = subscribeSermons((items) => {
      setSermons(items);
      setLoadingSermons(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Books
  useEffect(() => {
    const unsubscribe = subscribeBooks((items) => {
      // Only show published books to members and public
      const published = items.filter(b => b.isPublished !== false);
      setBooks(published);
      setLoadingBooks(false);
    });
    return () => unsubscribe();
  }, []);

  // Handle URL Query Params on mount (e.g. ?book=id or ?tab=books)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'books') {
      setActiveMediaTab('books');
    } else if (tabParam === 'sermons') {
      setActiveMediaTab('sermons');
    }

    const bookId = params.get('book');
    if (bookId && books.length > 0) {
      const match = books.find(b => b.id === bookId);
      if (match) setSelectedBook(match);
    }
  }, [books]);

  // Listen for Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedSermon) setSelectedSermon(null);
        if (selectedBook) setSelectedBook(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSermon, selectedBook]);

  // Filtered Sermons
  const filteredSermons = useMemo(() => {
    return sermons.filter(sermon => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        sermon.title.toLowerCase().includes(q) ||
        sermon.minister.toLowerCase().includes(q) ||
        (sermon.scripture && sermon.scripture.toLowerCase().includes(q)) ||
        (sermon.description && sermon.description.toLowerCase().includes(q))
      );

      const matchesType = filterType === 'all' || sermon.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [sermons, searchQuery, filterType]);

  // Filtered Books
  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        book.title.toLowerCase().includes(q) ||
        (book.subtitle && book.subtitle.toLowerCase().includes(q)) ||
        book.author.toLowerCase().includes(q) ||
        book.category.toLowerCase().includes(q) ||
        (book.description && book.description.toLowerCase().includes(q))
      );

      const matchesCat = bookCategory === 'all' || book.category === bookCategory;
      return matchesSearch && matchesCat;
    });
  }, [books, searchQuery, bookCategory]);

  // Featured Books
  const featuredBooks = useMemo(() => {
    return books.filter(b => b.isFeatured);
  }, [books]);

  const copyBookShareLink = (book: BookItem) => {
    const url = `${window.location.origin}/media?book=${encodeURIComponent(book.id)}`;
    navigator.clipboard.writeText(url);
    setCopiedBookLink(true);
    setTimeout(() => setCopiedBookLink(false), 2000);
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <section className="bg-[#1A1F3C] py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#F26522_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <span className="px-3.5 py-1 bg-[#F26522]/20 text-[#F26522] border border-[#F26522]/30 rounded-full text-xs font-black uppercase tracking-widest inline-block shadow-sm">
            Apostolic & Spiritual Library
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
            Media & <span className="text-[#F26522]">Publications</span>
          </h1>
          <p className="text-gray-300 max-w-2xl mx-auto font-medium text-sm sm:text-base leading-relaxed">
            Access our archive of spirit-filled teachings, prayer instructions, and books authored by Pastor Osaro Aghedo and anointed ministers.
          </p>

          {/* Top Category Tabs (Sermons vs Books) */}
          <div className="flex items-center justify-center pt-4">
            <div className="flex bg-white/10 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 max-w-md w-full">
              <button
                onClick={() => setActiveMediaTab('all')}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                  activeMediaTab === 'all'
                    ? "bg-[#F26522] text-white shadow-lg shadow-[#F26522]/30"
                    : "text-gray-300 hover:text-white"
                )}
              >
                All Resources
              </button>
              <button
                onClick={() => setActiveMediaTab('sermons')}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5",
                  activeMediaTab === 'sermons'
                    ? "bg-[#F26522] text-white shadow-lg shadow-[#F26522]/30"
                    : "text-gray-300 hover:text-white"
                )}
              >
                <Video size={14} />
                <span>Sermons ({sermons.length})</span>
              </button>
              <button
                onClick={() => setActiveMediaTab('books')}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5",
                  activeMediaTab === 'books'
                    ? "bg-[#F26522] text-white shadow-lg shadow-[#F26522]/30"
                    : "text-gray-300 hover:text-white"
                )}
              >
                <BookOpen size={14} />
                <span>Books ({books.length})</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        
        {/* ========================================================================= */}
        {/* BOOKS & PUBLICATIONS SECTION */}
        {/* ========================================================================= */}
        {(activeMediaTab === 'all' || activeMediaTab === 'books') && (
          <div className="space-y-8">
            {/* Books Section Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-100 pb-6">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 bg-orange-100 text-[#F26522] text-[10px] font-black uppercase tracking-wider rounded-md">
                    Spiritual Publications
                  </span>
                  <span className="text-xs text-gray-400 font-bold">Free Downloads & Study Materials</span>
                </div>
                <h2 className="text-3xl font-black text-[#1A1F3C]">Books & E-Books</h2>
                <p className="text-gray-500 font-medium text-sm">
                  Deep spiritual revelations, prayer manuals, and prophetic blueprints by Pastor Osaro Aghedo ({filteredBooks.length} titles available).
                </p>
              </div>

              {/* Book Categories Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bookCategory}
                  onChange={(e) => setBookCategory(e.target.value)}
                  className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#1A1F3C] outline-none focus:border-[#F26522]"
                >
                  <option value="all">All Book Categories ({books.length})</option>
                  {BOOK_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Books Grid */}
            {loadingBooks ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-[#F26522] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-400 font-bold text-sm">Loading spiritual library...</p>
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="bg-gray-50 rounded-3xl p-12 text-center space-y-4 border border-dashed border-gray-200">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto" />
                <h3 className="text-lg font-black text-[#1A1F3C]">No books in this category</h3>
                <p className="text-gray-500 text-xs sm:text-sm">Try choosing another category or clearing search.</p>
                <button
                  onClick={() => { setBookCategory('all'); setSearchQuery(''); }}
                  className="px-4 py-2 bg-[#1A1F3C] text-white rounded-xl text-xs font-bold"
                >
                  Show All Books
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredBooks.map((book) => (
                  <motion.div
                    key={book.id}
                    whileHover={{ y: -6 }}
                    onClick={() => setSelectedBook(book)}
                    className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col group cursor-pointer"
                  >
                    {/* Top 3D Book Cover Presentation Area */}
                    <div className="relative h-64 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-6 overflow-hidden">
                      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#F26522_1px,transparent_1px)] [background-size:12px_12px]" />
                      
                      {/* Realistic 3D Book Spine Effect */}
                      <div className="relative w-36 h-52 rounded-r-lg rounded-l-sm shadow-2xl overflow-hidden transform group-hover:scale-105 group-hover:-translate-y-1 transition-all duration-300 border-r-2 border-white/20">
                        <img
                          src={book.coverImageUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80'}
                          alt={book.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/60 via-black/20 to-transparent pointer-events-none" />
                      </div>

                      {/* Badges on Book */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                        <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider rounded-lg border border-white/10">
                          {book.category}
                        </span>
                        {book.isFeatured && (
                          <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider rounded-md flex items-center space-x-1 shadow-md">
                            <Star size={10} className="fill-current" />
                            <span>Featured</span>
                          </span>
                        )}
                      </div>

                      {/* Format / Free Badge */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-bold text-white/90">
                        <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-md">
                          {book.format || 'PDF E-Book'}
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-md font-black uppercase",
                          book.isFree ? "bg-emerald-500 text-white" : "bg-[#F26522] text-white"
                        )}>
                          {book.isFree ? 'Free Download' : (book.price || 'Store Edition')}
                        </span>
                      </div>
                    </div>

                    {/* Content / Info */}
                    <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-gray-400 font-bold">
                          <span>By <strong className="text-[#1A1F3C]">{book.author}</strong></span>
                          {book.publishedYear && <span>{book.publishedYear}</span>}
                        </div>

                        <h3 className="text-lg font-black text-[#1A1F3C] leading-snug line-clamp-2 group-hover:text-[#F26522] transition-colors">
                          {book.title}
                        </h3>

                        {book.subtitle && (
                          <p className="text-xs font-medium text-gray-500 line-clamp-1 italic">
                            "{book.subtitle}"
                          </p>
                        )}

                        <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed font-medium">
                          {book.description}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F26522] flex items-center space-x-1">
                          <span>Read Details & Download</span>
                          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                        
                        {book.downloadUrl && (
                          <span className="p-2 bg-orange-50 text-[#F26522] rounded-xl group-hover:bg-[#F26522] group-hover:text-white transition-colors" title="Download Available">
                            <Download size={14} />
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SERMON ARCHIVE SECTION */}
        {/* ========================================================================= */}
        {(activeMediaTab === 'all' || activeMediaTab === 'sermons') && (
          <div className="space-y-8 pt-6">
            {/* Sermon Archive Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-100 pb-6">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-md">
                    Video & Audio Broadcasts
                  </span>
                  <span className="text-xs text-gray-400 font-bold">Sunday & Midnight Teachings</span>
                </div>
                <h2 className="text-3xl font-black text-[#1A1F3C]">Sermon & Teaching Archive</h2>
                <p className="text-gray-500 font-medium text-sm">
                  Watch or listen to our past and recent teachings ({filteredSermons.length} available)
                </p>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto">
                {/* Search Input */}
                <div className="relative flex-grow sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Search teachings, scripture, minister..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-800 placeholder-gray-400 outline-none focus:bg-white focus:border-[#F26522] focus:ring-2 focus:ring-[#F26522]/20 transition-all" 
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Type Filters */}
                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200/80">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'bg-white text-[#1A1F3C] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterType('video')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'video' ? 'bg-white text-[#F26522] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Video
                  </button>
                  <button
                    onClick={() => setFilterType('audio')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'audio' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Audio
                  </button>
                </div>
              </div>
            </div>

            {/* Sermon Cards Grid */}
            {loadingSermons ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-[#F26522] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-400 font-bold text-sm">Loading spiritual library...</p>
              </div>
            ) : filteredSermons.length === 0 ? (
              <div className="bg-gray-50 rounded-3xl p-12 text-center space-y-4 border border-dashed border-gray-200 my-8">
                <div className="w-16 h-16 bg-gray-200/60 rounded-full flex items-center justify-center mx-auto text-gray-400">
                  <Search size={28} />
                </div>
                <h3 className="text-xl font-bold text-[#1A1F3C]">No teachings found</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  We couldn't find any sermons matching "{searchQuery}". Try searching with different keywords.
                </p>
                <button 
                  onClick={() => { setSearchQuery(''); setFilterType('all'); }}
                  className="px-4 py-2 bg-[#1A1F3C] text-white rounded-xl text-xs font-bold hover:bg-[#F26522] transition-colors"
                >
                  Clear Search Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredSermons.map((sermon) => (
                  <motion.div 
                    key={sermon.id}
                    whileHover={{ y: -6 }}
                    onClick={() => setSelectedSermon(sermon)}
                    className="bg-white rounded-2xl shadow-sm hover:shadow-xl overflow-hidden border border-gray-100 group cursor-pointer flex flex-col justify-between transition-all"
                  >
                    <div>
                      <div className="aspect-video relative overflow-hidden bg-gray-900">
                        <img 
                          src={sermon.thumbnailUrl} 
                          alt={sermon.title} 
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1490161705155-d28c4210e9c1?auto=format&fit=crop&q=80';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                          <div className="w-12 h-12 bg-[#F26522] rounded-full flex items-center justify-center text-white shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                            {sermon.type === 'video' ? <Play className="w-6 h-6 fill-current translate-x-0.5" /> : <Headphones className="w-6 h-6" />}
                          </div>
                        </div>
                        
                        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded text-[9px] font-black uppercase tracking-widest text-white flex items-center space-x-1">
                          {sermon.type === 'video' ? <Video size={10} className="text-[#F26522]" /> : <Headphones size={10} className="text-indigo-400" />}
                          <span>{sermon.type}</span>
                        </div>

                        {sermon.duration && (
                          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-gray-200">
                            {sermon.duration}
                          </div>
                        )}
                      </div>

                      <div className="p-5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-[#F26522] uppercase tracking-widest">{sermon.date}</p>
                          {sermon.scripture && (
                            <span className="text-[10px] text-gray-500 font-bold truncate max-w-[120px]">
                              {sermon.scripture}
                            </span>
                          )}
                        </div>
                        <h3 className="font-black text-[#1A1F3C] text-base leading-snug line-clamp-2 group-hover:text-[#F26522] transition-colors">
                          {sermon.title}
                        </h3>
                        <p className="text-xs text-gray-600 font-bold line-clamp-1">{sermon.minister}</p>
                        {sermon.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 font-normal leading-relaxed pt-1">
                            {sermon.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="px-5 pb-4 pt-2 border-t border-gray-50 flex items-center justify-between text-xs font-bold text-[#F26522]">
                      <span className="flex items-center space-x-1">
                        <span>{sermon.type === 'video' ? 'Watch Teaching' : 'Listen to Audio'}</span>
                      </span>
                      <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PUBLIC BOOK DETAIL, ZOOM VIEWER & DOWNLOAD MODAL */}
        {/* ========================================================================= */}
        <BookReaderModal
          book={selectedBook}
          isOpen={Boolean(selectedBook)}
          onClose={() => setSelectedBook(null)}
        />

        {/* ========================================================================= */}
        {/* SERMON PLAYBACK MODAL */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {selectedSermon && (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto cursor-pointer"
              onClick={() => setSelectedSermon(null)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col cursor-default my-auto relative"
              >
                {/* Modal Top Header */}
                <div className="px-6 py-4 bg-[#1A1F3C] text-white flex items-center justify-between border-b border-white/10 shrink-0">
                  <div className="flex items-center space-x-2.5 overflow-hidden pr-2">
                    <span className="px-2.5 py-0.5 bg-[#F26522] text-white text-[10px] font-black uppercase tracking-widest rounded-full shrink-0">
                      {selectedSermon.type === 'video' ? 'Video Teaching' : 'Audio Sermon'}
                    </span>
                    <h4 className="font-black text-sm sm:text-base text-white truncate">
                      {selectedSermon.title}
                    </h4>
                  </div>

                  <button 
                    type="button"
                    onClick={() => setSelectedSermon(null)}
                    className="p-2 bg-white/10 hover:bg-[#F26522] text-white rounded-full transition-all shrink-0 flex items-center justify-center shadow-md hover:scale-105 active:scale-95"
                    title="Close (Esc)"
                    aria-label="Close modal"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Media Playback Frame */}
                <div className="relative aspect-video bg-black flex items-center justify-center shrink-0">
                  {(() => {
                    const videoInfo = parseVideoUrl(selectedSermon.mediaUrl);
                    if (videoInfo.embedUrl) {
                      return (
                        <iframe 
                          src={videoInfo.embedUrl} 
                          title={selectedSermon.title}
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

                    if (selectedSermon.type === 'audio' && selectedSermon.mediaUrl && (selectedSermon.mediaUrl.endsWith('.mp3') || selectedSermon.mediaUrl.includes('audio'))) {
                      return (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#1A1F3C] to-slate-900 text-white space-y-6">
                          <div className="w-20 h-20 bg-[#F26522] rounded-full flex items-center justify-center text-white shadow-xl animate-pulse">
                            <Headphones size={36} />
                          </div>
                          <div className="text-center space-y-1">
                            <h4 className="font-black text-lg">{selectedSermon.title}</h4>
                            <p className="text-xs text-gray-300 font-bold">{selectedSermon.minister}</p>
                          </div>
                          <audio controls autoPlay className="w-full max-w-md mt-2">
                            <source src={selectedSermon.mediaUrl} type="audio/mpeg" />
                            Your browser does not support audio playback.
                          </audio>
                        </div>
                      );
                    }

                    return (
                      <div className="relative w-full h-full">
                        <img 
                          src={selectedSermon.thumbnailUrl} 
                          alt={selectedSermon.title} 
                          className="w-full h-full object-cover opacity-60"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-black/50 space-y-3">
                          <div className="w-16 h-16 bg-[#F26522] rounded-full flex items-center justify-center text-white shadow-xl">
                            {selectedSermon.type === 'video' ? <Play size={28} className="translate-x-0.5" /> : <Headphones size={28} />}
                          </div>
                          <p className="text-sm font-bold max-w-md">
                            {selectedSermon.mediaUrl 
                              ? "Click below to stream this teaching on our broadcast channel or media archive." 
                              : "This spiritual teaching is cataloged in our ministry archive."}
                          </p>
                          {selectedSermon.mediaUrl ? (
                            <a 
                              href={selectedSermon.mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-6 py-2.5 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#d9561a] transition-all flex items-center space-x-2 shadow-lg shadow-[#F26522]/30"
                            >
                              <span>Open Media Link</span>
                              <ExternalLink size={14} />
                            </a>
                          ) : (
                            <a 
                              href="https://www.youtube.com/@lightupprayerhouse"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-6 py-2.5 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#d9561a] transition-all flex items-center space-x-2 shadow-lg shadow-[#F26522]/30"
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

                <div className="p-6 overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-orange-50 text-[#F26522] text-[10px] font-black uppercase tracking-widest rounded-full">
                      {selectedSermon.date}
                    </span>
                    {selectedSermon.duration && (
                      <span className="text-xs font-bold text-gray-500 flex items-center space-x-1">
                        <Clock size={12} className="text-[#F26522]" />
                        <span>{selectedSermon.duration}</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-[#1A1F3C] leading-snug">{selectedSermon.title}</h3>
                    <p className="text-sm font-bold text-gray-600 mt-1">Minister: <span className="text-[#1A1F3C]">{selectedSermon.minister}</span></p>
                  </div>

                  {selectedSermon.scripture && (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start space-x-3">
                      <BookOpen size={16} className="text-[#F26522] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black uppercase text-gray-400">Scripture Reference</p>
                        <p className="text-sm font-bold text-[#1A1F3C] font-serif italic">"{selectedSermon.scripture}"</p>
                      </div>
                    </div>
                  )}

                  {selectedSermon.description && (
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase text-gray-400">Teaching Summary</p>
                      <p className="text-sm text-gray-700 leading-relaxed font-medium">
                        {selectedSermon.description}
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <a 
                        href="https://www.youtube.com/@lightupprayerhouse" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                      >
                        <Video size={14} />
                        <span>Subscribe on YouTube</span>
                      </a>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSelectedSermon(null)}
                      className="px-5 py-2.5 bg-[#1A1F3C] hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Social Hub */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-6">
          <div className="space-y-8">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-[#1A1F3C]">Social Hub</h2>
              <p className="text-gray-500 font-medium">Follow our live updates and join the community.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <a href="https://www.youtube.com/@lightupprayerhouse" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-3xl border border-red-100 group transition-all hover:bg-red-100">
                <Video className="w-10 h-10 text-red-600 mb-4 group-hover:scale-110 transition-transform" />
                <span className="font-black text-red-600 text-xs uppercase tracking-widest">YouTube</span>
                <span className="text-[10px] text-red-400 mt-1 font-bold">Watch Live</span>
              </a>
              <a href="https://www.instagram.com/lightupprayerhousefamily" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-8 bg-pink-50 rounded-3xl border border-pink-100 group transition-all hover:bg-pink-100">
                <Camera className="w-10 h-10 text-pink-600 mb-4 group-hover:scale-110 transition-transform" />
                <span className="font-black text-pink-600 text-xs uppercase tracking-widest">Instagram</span>
                <span className="text-[10px] text-pink-400 mt-1 font-bold">Follow Our Fire</span>
              </a>
              <a href="https://www.facebook.com/profile.php?id=61585056902769&mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-8 bg-blue-50 rounded-3xl border border-blue-100 group transition-all hover:bg-blue-100">
                <Share2 className="w-10 h-10 text-blue-600 mb-4 group-hover:scale-110 transition-transform" />
                <span className="font-black text-blue-600 text-xs uppercase tracking-widest">Facebook</span>
                <span className="text-[10px] text-blue-400 mt-1 font-bold">Connect With Us</span>
              </a>
              <a href="https://www.tiktok.com" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-8 bg-black rounded-3xl group transition-all hover:opacity-90">
                <div className="w-10 h-10 text-white mb-4 group-hover:scale-110 transition-transform font-black text-3xl">T</div>
                <span className="font-black text-white text-xs uppercase tracking-widest">TikTok</span>
                <span className="text-[10px] text-gray-400 mt-1 font-bold">Short Teachings</span>
              </a>
            </div>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 sm:p-12 space-y-8 border border-gray-100">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-[#1A1F3C]">Resource Downloads</h2>
              <p className="text-gray-500 font-medium">Free spiritual materials for your growth.</p>
            </div>
            <div className="space-y-4">
              <Link 
                to="/reading-plan"
                className="bg-white p-5 rounded-2xl flex items-center justify-between group hover:border-[#F26522] border border-[#F26522]/30 transition-all shadow-sm block bg-gradient-to-r from-orange-50/50 to-white"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-[#F26522]/10 p-3 rounded-lg text-[#F26522]">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-black text-[#1A1F3C] text-sm group-hover:text-[#F26522] transition-colors">30-Day Scripture Reading Plan</p>
                      <span className="px-2 py-0.5 bg-[#F26522] text-white text-[9px] font-black uppercase rounded-full">Interactive</span>
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Track progress • Audio Narration • Daily Prayers</p>
                  </div>
                </div>
                <div className="text-[#F26522] flex items-center space-x-1 text-xs font-black uppercase tracking-wider">
                  <span>Open Plan</span>
                  <ArrowRight size={16} />
                </div>
              </Link>

              {[
                { name: "Weekly Prayer Point PDF", size: "2.4 MB" },
                { name: "The Assignment Theme Flyer", size: "5.8 MB" },
                { name: "NGO Transparency Report 2025", size: "3.2 MB" },
              ].map((res, idx) => (
                <div key={idx} className="bg-white p-5 rounded-2xl flex items-center justify-between group hover:border-[#F26522] border border-transparent transition-all shadow-sm">
                  <div className="flex items-center space-x-4">
                    <div className="bg-gray-50 p-3 rounded-lg text-gray-400 group-hover:text-[#F26522] transition-colors">
                      <Download size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-[#1A1F3C] text-sm">{res.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{res.size}</p>
                    </div>
                  </div>
                  <button className="text-[#F26522] opacity-0 group-hover:opacity-100 transition-opacity">
                    <Share2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
