/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Download, ZoomIn, ZoomOut, RotateCcw, Maximize2, 
  ExternalLink, BookOpen, ArrowLeft, Star, FileText, 
  Share2, Check, RefreshCw, Layers
} from 'lucide-react';
import { BookItem } from '../lib/books';
import { formatDownloadUrl, triggerFileDownload } from '../lib/download-utils';

interface BookReaderModalProps {
  book: BookItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BookReaderModal({ book, isOpen, onClose }: BookReaderModalProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [iframeError, setIframeError] = useState<boolean>(false);

  // Reset state when opening a new book
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(100);
      setIframeError(false);
      setDownloadToast(null);
    }
  }, [isOpen, book?.id]);

  // Keyboard shortcut listener: Escape to close, +/- to zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || (e.ctrlKey && e.key === '=')) {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || (e.ctrlKey && e.key === '-')) {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0' && e.ctrlKey) {
        e.preventDefault();
        handleZoomReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !book) return null;

  const urlInfo = formatDownloadUrl(book.downloadUrl || book.previewUrl || '');
  const hasEmbeddableDoc = Boolean(urlInfo.previewEmbedUrl || urlInfo.directDownloadUrl);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 25, 250));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 25, 50));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
  };

  const handleDownload = async () => {
    if (!book.downloadUrl) {
      setDownloadToast('No digital file attached to this book yet.');
      setTimeout(() => setDownloadToast(null), 3000);
      return;
    }

    setIsDownloading(true);
    setDownloadToast('Preparing book download...');

    try {
      const fileName = `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const res = await triggerFileDownload(book.downloadUrl, fileName);
      setDownloadToast(res.message || 'Download initiated!');
    } catch (err: any) {
      setDownloadToast('Could not download. Opening link in new tab...');
      window.open(book.downloadUrl, '_blank');
    } finally {
      setIsDownloading(false);
      setTimeout(() => setDownloadToast(null), 4000);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/media?book=${encodeURIComponent(book.id)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <AnimatePresence>
      <div 
        id="book-reader-modal-overlay"
        className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex flex-col overflow-hidden"
      >
        {/* ========================================================================= */}
        {/* STICKY TOP HEADER CONTROLS (ALWAYS VISIBLE REGARDLESS OF ZOOM) */}
        {/* ========================================================================= */}
        <header className="sticky top-0 z-30 bg-[#1A1F3C] text-white border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-xl shrink-0">
          {/* Left: Prominent Return Button & Book Info */}
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            <button
              id="return-to-library-btn"
              onClick={onClose}
              className="px-3.5 py-2 bg-white/10 hover:bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md cursor-pointer shrink-0 border border-white/10"
              title="Return to Book Library (Esc)"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Return to Library</span>
              <span className="sm:hidden">Exit</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-[#F26522] text-white text-[9px] font-black uppercase tracking-wider rounded">
                  {book.category}
                </span>
                {book.pages && (
                  <span className="text-[10px] text-gray-400 font-bold hidden md:inline">
                    {book.pages} Pages
                  </span>
                )}
              </div>
              <h2 className="text-xs sm:text-sm font-black text-white truncate max-w-xs sm:max-w-md lg:max-w-xl">
                {book.title}
              </h2>
            </div>
          </div>

          {/* Center / Right Controls: Zoom Controls & Action Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-white/10 rounded-xl p-1 border border-white/10 space-x-1">
              <button
                id="book-reader-zoom-out-btn"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 50}
                className="p-1.5 hover:bg-white/15 disabled:opacity-30 rounded-lg text-white transition-colors cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut size={15} />
              </button>

              <button
                id="book-reader-zoom-reset-btn"
                onClick={handleZoomReset}
                className="px-2 py-1 text-[11px] font-mono font-bold hover:bg-white/15 rounded-lg text-gray-200 transition-colors cursor-pointer"
                title="Reset Zoom (100%)"
              >
                {zoomLevel}%
              </button>

              <button
                id="book-reader-zoom-in-btn"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 250}
                className="p-1.5 hover:bg-white/15 disabled:opacity-30 rounded-lg text-white transition-colors cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn size={15} />
              </button>

              <button
                onClick={handleZoomReset}
                className="p-1.5 hover:bg-white/15 rounded-lg text-gray-300 transition-colors cursor-pointer"
                title="Fit to Screen"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="p-2 sm:px-3 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors border border-white/10 cursor-pointer"
              title="Share Book Link"
            >
              {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
              <span className="hidden md:inline">{copiedLink ? 'Copied' : 'Share'}</span>
            </button>

            {/* Download Button */}
            {book.downloadUrl && (
              <button
                id="book-reader-download-btn"
                onClick={handleDownload}
                disabled={isDownloading}
                className="px-3.5 sm:px-4 py-2 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-lg shadow-[#F26522]/30 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-60"
                title="Download Book File"
              >
                {isDownloading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span>Download</span>
              </button>
            )}

            {/* Close Cross Button */}
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-rose-600 text-white rounded-xl transition-all cursor-pointer"
              title="Close Reader (Esc)"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* TOAST FEEDBACK NOTIFICATION */}
        {/* ========================================================================= */}
        {downloadToast && (
          <div className="fixed top-16 right-6 z-40 bg-[#1A1F3C] text-white border border-[#F26522] px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center space-x-2 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-[#F26522] animate-ping" />
            <span>{downloadToast}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* READER MAIN VIEWPORT */}
        {/* ========================================================================= */}
        <main className="flex-grow overflow-auto p-3 sm:p-6 flex flex-col items-center justify-start bg-slate-950">
          <div 
            style={{ 
              transform: `scale(${zoomLevel / 100})`, 
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
            className="w-full max-w-5xl flex flex-col items-center my-auto py-4"
          >
            {hasEmbeddableDoc && !iframeError ? (
              /* Embed Viewer for PDF / Google Drive preview / Data URL */
              <div className="w-full bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col">
                <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-xs text-gray-300 border-b border-white/10">
                  <div className="flex items-center space-x-2">
                    <BookOpen size={14} className="text-[#F26522]" />
                    <span className="font-bold">Spiritual Publication Reader</span>
                  </div>

                  <a
                    href={urlInfo.directDownloadUrl || book.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white flex items-center space-x-1 text-[11px] font-bold underline"
                  >
                    <span>Open in New Tab</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <div className="relative w-full h-[75vh] sm:h-[80vh] bg-black">
                  <iframe
                    src={urlInfo.previewEmbedUrl || urlInfo.directDownloadUrl}
                    title={book.title}
                    className="w-full h-full border-0 bg-white"
                    allow="autoplay; fullscreen"
                    onError={() => setIframeError(true)}
                  />
                </div>
              </div>
            ) : (
              /* High-Quality Spiritual Book Presentation View */
              <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col md:flex-row max-w-4xl text-[#1A1F3C]">
                {/* Book 3D Cover Spine Area */}
                <div className="md:w-5/12 bg-gradient-to-br from-slate-950 via-[#1A1F3C] to-slate-900 p-8 flex flex-col items-center justify-center text-white relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#F26522_1px,transparent_1px)] [background-size:12px_12px]" />
                  
                  <div className="relative w-44 h-64 sm:w-48 sm:h-72 rounded-r-2xl rounded-l-sm overflow-hidden shadow-2xl border-r-4 border-white/20">
                    <img
                      src={book.coverImageUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80'}
                      alt={book.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/70 via-black/20 to-transparent pointer-events-none" />
                  </div>

                  <div className="pt-6 text-center space-y-1.5 relative z-10">
                    <span className="px-3 py-1 bg-[#F26522] rounded-full text-[10px] font-black uppercase tracking-wider inline-block">
                      {book.format || 'E-Book Edition'}
                    </span>
                    <p className="text-xs text-gray-300 font-bold">Author: {book.author}</p>
                    {book.publishedYear && <p className="text-[11px] text-gray-400">Published: {book.publishedYear}</p>}
                  </div>
                </div>

                {/* Book Details & Download Access */}
                <div className="md:w-7/12 p-6 sm:p-10 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div>
                      <span className="px-2.5 py-0.5 bg-orange-100 text-[#F26522] text-[10px] font-black uppercase tracking-wider rounded-md">
                        {book.category}
                      </span>
                      <h1 className="text-2xl sm:text-3xl font-black text-[#1A1F3C] mt-2 leading-tight">
                        {book.title}
                      </h1>
                      {book.subtitle && (
                        <p className="text-sm font-serif italic text-gray-500 mt-1">
                          "{book.subtitle}"
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        Publication Synopsis & Spiritual Revelation
                      </h4>
                      <p className="text-gray-700 leading-relaxed text-sm font-medium">
                        {book.description || 'This anointed publication provides deep apostolic insights, prayer blueprints, and scriptures to empower your spiritual walk.'}
                      </p>
                    </div>

                    {book.isbn && (
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-500 uppercase text-[10px]">ISBN / Catalog</span>
                        <span className="font-mono font-bold text-[#1A1F3C]">{book.isbn}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions: Download / Purchase / Return */}
                  <div className="pt-6 border-t border-gray-100 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {book.downloadUrl ? (
                        <button
                          onClick={handleDownload}
                          disabled={isDownloading}
                          className="flex-1 py-3 px-5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-[#F26522]/30 transition-all cursor-pointer disabled:opacity-60"
                        >
                          <Download size={16} />
                          <span>{isDownloading ? 'Downloading...' : 'Download E-Book (Free PDF)'}</span>
                        </button>
                      ) : (
                        <div className="flex-1 py-3 px-4 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs text-center">
                          Free Electronic Copy in Ministry Library
                        </div>
                      )}

                      {book.purchaseUrl && (
                        <a
                          href={book.purchaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-3 px-5 bg-[#1A1F3C] hover:bg-black text-white rounded-xl font-bold text-xs flex items-center space-x-2 transition-colors"
                        >
                          <span>Order Physical Copy</span>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>

                    <button
                      onClick={onClose}
                      className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <ArrowLeft size={14} />
                      <span>Return to Publications Library</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ========================================================================= */}
        {/* BOTTOM FIXED RETURN BAR (GUARANTEES NEVER GETTING STUCK ON MOBILE) */}
        {/* ========================================================================= */}
        <footer className="bg-[#1A1F3C]/95 backdrop-blur-md border-t border-white/10 px-4 py-2.5 flex sm:hidden items-center justify-between text-xs text-white shrink-0 z-30">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-[#F26522] rounded-xl font-black text-xs uppercase flex items-center space-x-1.5"
          >
            <ArrowLeft size={14} />
            <span>Return</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="p-2 bg-white/10 rounded-lg text-white"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="font-mono font-bold text-xs text-gray-300">{zoomLevel}%</span>
            <button
              onClick={handleZoomIn}
              className="p-2 bg-white/10 rounded-lg text-white"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          {book.downloadUrl && (
            <button
              onClick={handleDownload}
              className="p-2 bg-[#F26522] text-white rounded-xl font-bold"
              title="Download"
            >
              <Download size={16} />
            </button>
          )}
        </footer>
      </div>
    </AnimatePresence>
  );
}
