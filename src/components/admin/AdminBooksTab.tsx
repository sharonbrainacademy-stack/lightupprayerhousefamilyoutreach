/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Plus, Search, Filter, Edit3, Trash2, 
  ExternalLink, Download, Sparkles, Check, X, 
  AlertTriangle, Upload, Eye, EyeOff, Star, 
  Share2, FileText, Bookmark, Layers, CheckCircle2,
  RefreshCw, Copy, BookMarked, ArrowUpDown, ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookItem, 
  BOOK_CATEGORIES, 
  BOOK_FORMATS, 
  DEFAULT_BOOKS, 
  subscribeBooks, 
  addBook, 
  updateBook, 
  deleteBook, 
  toggleBookPublished, 
  toggleBookFeatured 
} from '../../lib/books';
import { compressImageFile } from '../../lib/image-utils';
import { formatDownloadUrl, triggerFileDownload } from '../../lib/download-utils';
import { BookReaderModal } from '../BookReaderModal';
import { cn } from '../../lib/utils';
import AdminBookImportModal from './AdminBookImportModal';

const SUGGESTED_COVERS = [
  { label: 'Prayer & Fire', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80' },
  { label: 'Divine Assignment', url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80' },
  { label: 'Kingdom Study', url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80' },
  { label: 'Holy Scripture', url: 'https://images.unsplash.com/photo-1507842229451-79b1be886a20?auto=format&fit=crop&q=80' },
  { label: 'Open Heaven', url: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80' }
];

export default function AdminBooksTab() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft' | 'featured'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<BookItem | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    author: 'Pastor Osaro Aghedo',
    category: 'Prayer & Intercession',
    format: 'PDF E-Book (Free Download)',
    description: '',
    coverImageUrl: '',
    pages: '180',
    publishedYear: new Date().getFullYear().toString(),
    isbn: '',
    downloadUrl: '',
    previewUrl: '',
    purchaseUrl: '',
    isFree: true,
    price: 'Free Download',
    isFeatured: false,
    isPublished: true,
    order: 0
  });

  // Image & Document Uploading State
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [uploadedDocInfo, setUploadedDocInfo] = useState<{ name: string; size: string } | null>(null);
  const [testDownloadStatus, setTestDownloadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);

  // Delete Confirmation State
  const [deletingBook, setDeletingBook] = useState<BookItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detail / Preview Modal State
  const [previewingBook, setPreviewingBook] = useState<BookItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Subscribe to real-time books
  useEffect(() => {
    const unsubscribe = subscribeBooks((items) => {
      setBooks(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filtered and searched books
  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        book.title.toLowerCase().includes(q) ||
        (book.subtitle && book.subtitle.toLowerCase().includes(q)) ||
        book.author.toLowerCase().includes(q) ||
        book.category.toLowerCase().includes(q) ||
        (book.description && book.description.toLowerCase().includes(q)) ||
        (book.isbn && book.isbn.toLowerCase().includes(q))
      );

      const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;

      let matchesStatus = true;
      if (filterStatus === 'published') matchesStatus = book.isPublished !== false;
      if (filterStatus === 'draft') matchesStatus = book.isPublished === false;
      if (filterStatus === 'featured') matchesStatus = Boolean(book.isFeatured);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [books, searchQuery, selectedCategory, filterStatus]);

  // Summary Metrics
  const metrics = useMemo(() => {
    return {
      total: books.length,
      published: books.filter(b => b.isPublished !== false).length,
      featured: books.filter(b => b.isFeatured).length,
      freeDownloads: books.filter(b => b.isFree).length
    };
  }, [books]);

  // Open modal for new book
  const handleOpenAddModal = () => {
    setEditingBook(null);
    setFormData({
      title: '',
      subtitle: '',
      author: 'Pastor Osaro Aghedo',
      category: 'Prayer & Intercession',
      format: 'PDF E-Book (Free Download)',
      description: '',
      coverImageUrl: SUGGESTED_COVERS[0].url,
      pages: '160',
      publishedYear: new Date().getFullYear().toString(),
      isbn: '',
      downloadUrl: '',
      previewUrl: '',
      purchaseUrl: '',
      isFree: true,
      price: 'Free Download',
      isFeatured: false,
      isPublished: true,
      order: books.length + 1
    });
    setUploadError(null);
    setFormSuccessMessage(null);
    setIsModalOpen(true);
  };

  // Open modal for editing existing book
  const handleOpenEditModal = (book: BookItem) => {
    setEditingBook(book);
    setFormData({
      title: book.title || '',
      subtitle: book.subtitle || '',
      author: book.author || 'Pastor Osaro Aghedo',
      category: book.category || 'Prayer & Intercession',
      format: book.format || 'PDF E-Book (Free Download)',
      description: book.description || '',
      coverImageUrl: book.coverImageUrl || '',
      pages: book.pages ? String(book.pages) : '',
      publishedYear: book.publishedYear || '',
      isbn: book.isbn || '',
      downloadUrl: book.downloadUrl || '',
      previewUrl: book.previewUrl || '',
      purchaseUrl: book.purchaseUrl || '',
      isFree: book.isFree !== undefined ? book.isFree : true,
      price: book.price || (book.isFree ? 'Free Download' : ''),
      isFeatured: Boolean(book.isFeatured),
      isPublished: book.isPublished !== undefined ? book.isPublished : true,
      order: book.order ?? 0
    });
    setUploadError(null);
    setFormSuccessMessage(null);
    setIsModalOpen(true);
  };

  // Handle Cover Image File Upload with compression
  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    try {
      setIsCompressingImage(true);
      setUploadError(null);
      const compressedDataUrl = await compressImageFile(file, 900, 1200, 0.85);
      setFormData(prev => ({ ...prev, coverImageUrl: compressedDataUrl }));
    } catch (err: any) {
      setUploadError('Could not process cover image. Try another file or use a direct URL.');
    } finally {
      setIsCompressingImage(false);
    }
  };

  // Handle Document File Upload (PDF, EPUB, DOCX)
  const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDocument(true);
    setUploadError(null);

    try {
      const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
      setUploadedDocInfo({
        name: file.name,
        size: `${sizeInMb} MB`
      });

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setFormData(prev => ({
          ...prev,
          downloadUrl: dataUrl,
          format: file.name.toLowerCase().endsWith('.epub') ? 'EPUB E-Book' : 'PDF E-Book (Free Download)'
        }));
        setIsUploadingDocument(false);
        setTestDownloadStatus(`Uploaded "${file.name}" (${sizeInMb} MB) ready for download!`);
        setTimeout(() => setTestDownloadStatus(null), 4000);
      };
      reader.onerror = () => {
        setUploadError('Failed to read selected document file.');
        setIsUploadingDocument(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError('Error uploading document file. Please try again.');
      setIsUploadingDocument(false);
    }
  };

  // Auto-format Google Drive link
  const handleAutoFormatDriveUrl = () => {
    if (!formData.downloadUrl) return;
    const { directDownloadUrl, isGoogleDrive, previewEmbedUrl } = formatDownloadUrl(formData.downloadUrl);
    if (isGoogleDrive) {
      setFormData(prev => ({
        ...prev,
        downloadUrl: directDownloadUrl,
        previewUrl: prev.previewUrl || previewEmbedUrl
      }));
      setTestDownloadStatus('Converted Google Drive link into direct download link!');
      setTimeout(() => setTestDownloadStatus(null), 3500);
    } else {
      setTestDownloadStatus('Download URL is ready.');
      setTimeout(() => setTestDownloadStatus(null), 2500);
    }
  };

  // Test download right from the admin form
  const handleTestDownloadInForm = async () => {
    if (!formData.downloadUrl) {
      setTestDownloadStatus('Please upload a file or paste a download link first.');
      setTimeout(() => setTestDownloadStatus(null), 3000);
      return;
    }
    setTestDownloadStatus('Testing file download in browser...');
    const result = await triggerFileDownload(formData.downloadUrl, `${formData.title || 'Book'}.pdf`);
    setTestDownloadStatus(result.message);
    setTimeout(() => setTestDownloadStatus(null), 4500);
  };

  // Handle Form Submit (Add or Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setUploadError('Book Title is required.');
      return;
    }

    setFormSubmitting(true);
    setUploadError(null);

    try {
      if (editingBook) {
        await updateBook(editingBook.id, {
          title: formData.title,
          subtitle: formData.subtitle,
          author: formData.author,
          category: formData.category,
          format: formData.format,
          description: formData.description,
          coverImageUrl: formData.coverImageUrl,
          pages: formData.pages,
          publishedYear: formData.publishedYear,
          isbn: formData.isbn,
          downloadUrl: formData.downloadUrl,
          previewUrl: formData.previewUrl,
          purchaseUrl: formData.purchaseUrl,
          isFree: formData.isFree,
          price: formData.isFree ? 'Free Download' : formData.price,
          isFeatured: formData.isFeatured,
          isPublished: formData.isPublished,
          order: Number(formData.order) || 0
        });
        setFormSuccessMessage('Book updated successfully!');
      } else {
        await addBook({
          title: formData.title,
          subtitle: formData.subtitle,
          author: formData.author,
          category: formData.category,
          format: formData.format,
          description: formData.description,
          coverImageUrl: formData.coverImageUrl,
          pages: formData.pages,
          publishedYear: formData.publishedYear,
          isbn: formData.isbn,
          downloadUrl: formData.downloadUrl,
          previewUrl: formData.previewUrl,
          purchaseUrl: formData.purchaseUrl,
          isFree: formData.isFree,
          price: formData.isFree ? 'Free Download' : formData.price,
          isFeatured: formData.isFeatured,
          isPublished: formData.isPublished,
          order: Number(formData.order) || 0
        });
        setFormSuccessMessage('New book added to library!');
      }

      setTimeout(() => {
        setIsModalOpen(false);
        setFormSubmitting(false);
        setFormSuccessMessage(null);
      }, 700);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to save book. Please try again.');
      setFormSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingBook) return;
    setIsDeleting(true);
    try {
      await deleteBook(deletingBook.id);
      setDeletingBook(null);
    } catch (err: any) {
      console.error('Failed to delete book:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Quick Toggle Published
  const handleTogglePublished = async (book: BookItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleBookPublished(book.id, book.isPublished);
    } catch (err) {
      console.error('Failed to toggle published status:', err);
    }
  };

  // Handle Quick Toggle Featured
  const handleToggleFeatured = async (book: BookItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleBookFeatured(book.id, book.isFeatured);
    } catch (err) {
      console.error('Failed to toggle featured status:', err);
    }
  };

  const copyBookShareLink = (book: BookItem) => {
    const url = `${window.location.origin}/media?book=${encodeURIComponent(book.id)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Metrics */}
      <div className="bg-gradient-to-r from-[#1A1F3C] via-[#242b54] to-[#1A1F3C] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-white/10">
        <div className="absolute -right-10 -bottom-10 opacity-10 text-white pointer-events-none">
          <BookOpen size={240} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-[#F26522] text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center space-x-1 shadow-sm">
                <Sparkles size={12} />
                <span>Publications & Library</span>
              </span>
              <span className="text-xs text-gray-300 font-bold">Admin Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Books & Publications</h1>
            <p className="text-gray-300 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
              Add, organize, publish, and manage spiritual books, prayer manuals, e-books, and study guides by Pastor Osaro Aghedo for members and global seekers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center space-x-2 border border-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
            >
              <Upload size={16} />
              <span>Import Books</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="px-5 py-3 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-[#F26522]/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={18} />
              <span>Add New Book</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Books</p>
            <p className="text-2xl font-black text-white mt-0.5">{metrics.total}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live / Published</p>
            <p className="text-2xl font-black text-emerald-300 mt-0.5">{metrics.published}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Featured Showcase</p>
            <p className="text-2xl font-black text-amber-300 mt-0.5">{metrics.featured}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Free E-Books</p>
            <p className="text-2xl font-black text-blue-300 mt-0.5">{metrics.freeDownloads}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search title, author, category, ISBN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#1A1F3C] placeholder-gray-400 focus:bg-white focus:border-[#F26522] focus:ring-2 focus:ring-[#F26522]/20 outline-none transition-all"
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#1A1F3C] outline-none focus:border-[#F26522]"
          >
            <option value="all">All Categories ({books.length})</option>
            {BOOK_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Status Filter Pills */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['all', 'published', 'draft', 'featured'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                  filterStatus === status 
                    ? "bg-white text-[#1A1F3C] shadow-sm font-black" 
                    : "text-gray-500 hover:text-gray-900"
                )}
              >
                {status}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="hidden sm:flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === 'grid' ? "bg-white text-[#F26522] shadow-sm" : "text-gray-400 hover:text-gray-700"
              )}
              title="Grid View"
            >
              <Layers size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === 'table' ? "bg-white text-[#F26522] shadow-sm" : "text-gray-400 hover:text-gray-700"
              )}
              title="Table View"
            >
              <FileText size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-gray-100">
          <div className="w-10 h-10 border-4 border-[#F26522] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">Loading Publications Library...</p>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-dashed border-gray-200">
          <div className="w-16 h-16 bg-orange-50 text-[#F26522] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <BookOpen size={32} />
          </div>
          <h3 className="text-xl font-black text-[#1A1F3C]">No books found</h3>
          <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto">
            {searchQuery || selectedCategory !== 'all' || filterStatus !== 'all'
              ? "No books match your current filters. Try resetting search or category."
              : "Your books catalog is currently empty. Click below to add your first spiritual book."}
          </p>
          <div className="flex items-center justify-center space-x-3 pt-2">
            {(searchQuery || selectedCategory !== 'all' || filterStatus !== 'all') ? (
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setFilterStatus('all'); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
              >
                Reset Filters
              </button>
            ) : null}
            <button
              onClick={handleOpenAddModal}
              className="px-5 py-2.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md"
            >
              <Plus size={16} />
              <span>Add Book Now</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBooks.map((book) => (
            <div 
              key={book.id}
              className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group relative"
            >
              {/* Top Cover Display Area */}
              <div className="relative h-64 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-6 overflow-hidden">
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#F26522_1px,transparent_1px)] [background-size:12px_12px]" />
                
                {/* 3D Book Spine Effect Container */}
                <div 
                  onClick={() => setPreviewingBook(book)}
                  className="relative w-36 h-52 rounded-r-lg rounded-l-sm shadow-2xl overflow-hidden cursor-pointer transform group-hover:scale-105 group-hover:-translate-y-1 transition-all duration-300 border-r-2 border-white/20"
                >
                  <img
                    src={book.coverImageUrl || SUGGESTED_COVERS[0].url}
                    alt={book.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {/* Subtle Book Spine Shadow Overlay */}
                  <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/60 via-black/20 to-transparent pointer-events-none" />
                </div>

                {/* Status Badges on Cover */}
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

                <div className="absolute top-3 right-3 flex items-center space-x-1.5">
                  <button
                    onClick={(e) => handleTogglePublished(book, e)}
                    className={cn(
                      "p-2 rounded-xl backdrop-blur-md transition-all",
                      book.isPublished !== false 
                        ? "bg-emerald-500/80 text-white hover:bg-emerald-600" 
                        : "bg-gray-700/80 text-gray-300 hover:bg-gray-600"
                    )}
                    title={book.isPublished !== false ? "Live (Click to unpublish)" : "Draft (Click to publish)"}
                  >
                    {book.isPublished !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>

                  <button
                    onClick={(e) => handleToggleFeatured(book, e)}
                    className={cn(
                      "p-2 rounded-xl backdrop-blur-md transition-all",
                      book.isFeatured 
                        ? "bg-amber-500 text-white hover:bg-amber-600 shadow-md" 
                        : "bg-black/40 text-gray-300 hover:bg-black/60"
                    )}
                    title={book.isFeatured ? "Featured (Click to unmark)" : "Click to mark Featured"}
                  >
                    <Star size={14} className={book.isFeatured ? "fill-current" : ""} />
                  </button>
                </div>

                {/* Format & Free Badge at bottom */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-bold text-white/90">
                  <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-md text-[10px]">
                    {book.format || 'PDF E-Book'}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-black uppercase",
                    book.isFree ? "bg-emerald-500 text-white" : "bg-[#F26522] text-white"
                  )}>
                    {book.isFree ? 'Free E-Book' : (book.price || 'Store Edition')}
                  </span>
                </div>
              </div>

              {/* Book Metadata and Synopsis */}
              <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-bold">
                    <span>Author: <strong className="text-[#1A1F3C]">{book.author}</strong></span>
                    {book.publishedYear && <span>{book.publishedYear}</span>}
                  </div>

                  <h3 
                    onClick={() => setPreviewingBook(book)}
                    className="text-lg font-black text-[#1A1F3C] leading-snug line-clamp-2 hover:text-[#F26522] transition-colors cursor-pointer"
                  >
                    {book.title}
                  </h3>

                  {book.subtitle && (
                    <p className="text-xs font-semibold text-gray-500 line-clamp-1 italic">
                      "{book.subtitle}"
                    </p>
                  )}

                  <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed font-medium">
                    {book.description || 'No description provided.'}
                  </p>
                </div>

                {/* Footer details & Action Buttons */}
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
                    <span className="flex items-center space-x-1">
                      <FileText size={13} className="text-[#F26522]" />
                      <span>{book.pages ? `${book.pages} Pages` : 'Spiritual Edition'}</span>
                    </span>
                    {book.isbn && (
                      <span className="text-[10px] text-gray-400 font-mono">
                        ISBN: {book.isbn}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => setPreviewingBook(book)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-[#1A1F3C] rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors"
                      title="View Details"
                    >
                      <Eye size={14} />
                      <span>Preview</span>
                    </button>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleOpenEditModal(book)}
                        className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                        title="Edit Book"
                      >
                        <Edit3 size={15} />
                      </button>

                      <button
                        onClick={() => setDeletingBook(book)}
                        className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                        title="Delete Book"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="py-4 px-6">Book / Cover</th>
                  <th className="py-4 px-4">Author & Category</th>
                  <th className="py-4 px-4">Format & Price</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-medium">
                {filteredBooks.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3.5">
                        <img
                          src={book.coverImageUrl || SUGGESTED_COVERS[0].url}
                          alt={book.title}
                          className="w-10 h-14 object-cover rounded shadow-sm shrink-0 border border-gray-200"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <p 
                            onClick={() => setPreviewingBook(book)}
                            className="font-black text-[#1A1F3C] truncate max-w-xs hover:text-[#F26522] cursor-pointer"
                          >
                            {book.title}
                          </p>
                          {book.subtitle && (
                            <p className="text-[11px] text-gray-400 truncate max-w-xs">{book.subtitle}</p>
                          )}
                          {book.publishedYear && (
                            <span className="text-[10px] text-gray-400 font-bold">{book.publishedYear}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <p className="font-bold text-[#1A1F3C]">{book.author}</p>
                      <span className="inline-block mt-0.5 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-md">
                        {book.category}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <p className="font-bold text-gray-700">{book.format || 'PDF E-Book'}</p>
                      <span className={cn(
                        "inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-black uppercase",
                        book.isFree ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {book.isFree ? 'Free Download' : (book.price || 'Store')}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => handleTogglePublished(book, e)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center space-x-1",
                            book.isPublished !== false 
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200" 
                              : "bg-gray-100 text-gray-500 border border-gray-200"
                          )}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full", book.isPublished !== false ? "bg-emerald-500" : "bg-gray-400")} />
                          <span>{book.isPublished !== false ? "Live" : "Draft"}</span>
                        </button>

                        {book.isFeatured && (
                          <span className="p-1 bg-amber-50 text-amber-600 rounded-md" title="Featured">
                            <Star size={12} className="fill-current" />
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setPreviewingBook(book)}
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
                          title="View"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(book)}
                          className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                          title="Edit"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingBook(book)}
                          className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD / EDIT BOOK MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-gray-100 my-8"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 bg-[#1A1F3C] text-white flex items-center justify-between border-b border-white/10 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F26522] flex items-center justify-center text-white shadow-md">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">
                      {editingBook ? 'Edit Book / Publication' : 'Add New Book to Library'}
                    </h2>
                    <p className="text-xs text-gray-300 font-medium">
                      Configure cover, book details, downloads, and distribution links
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Form Body */}
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-grow space-y-6 text-xs">
                {uploadError && (
                  <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 flex items-center space-x-2 font-bold text-xs">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {formSuccessMessage && (
                  <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200 flex items-center space-x-2 font-bold text-xs">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{formSuccessMessage}</span>
                  </div>
                )}

                {/* Basic Details: Title & Subtitle */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                      Book Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. The Fire on the Altar"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-[#1A1F3C] text-sm focus:bg-white focus:border-[#F26522] outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                      Subtitle / Tagline (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Secrets of Answered Midnight Prayers & Breaking Generational Altars"
                      value={formData.subtitle}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-[#1A1F3C] focus:bg-white focus:border-[#F26522] outline-none"
                    />
                  </div>
                </div>

                {/* Author & Category & Format */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-black text-gray-700 uppercase tracking-wider text-[10px] flex items-center justify-between">
                      <span>Author</span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, author: 'Pastor Osaro Aghedo' })}
                        className="text-[9px] text-[#F26522] hover:underline normal-case font-bold"
                      >
                        Set Pastor Osaro
                      </button>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-[#1A1F3C] focus:bg-white focus:border-[#F26522] outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-[#1A1F3C] focus:bg-white focus:border-[#F26522] outline-none"
                    >
                      {BOOK_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                      Format
                    </label>
                    <select
                      value={formData.format}
                      onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-[#1A1F3C] focus:bg-white focus:border-[#F26522] outline-none"
                    >
                      {BOOK_FORMATS.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Cover Image Upload & URL */}
                <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <label className="font-black text-gray-700 uppercase tracking-wider text-[10px] block">
                    Book Cover Image
                  </label>

                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Image Preview */}
                    <div className="w-24 h-36 rounded-xl overflow-hidden bg-gray-200 shadow-md shrink-0 border border-gray-300 relative group">
                      <img
                        src={formData.coverImageUrl || SUGGESTED_COVERS[0].url}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {isCompressingImage && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                          <RefreshCw size={20} className="animate-spin text-[#F26522]" />
                        </div>
                      )}
                    </div>

                    {/* Upload Controls & URL */}
                    <div className="flex-grow space-y-3 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="px-4 py-2 bg-[#1A1F3C] text-white hover:bg-black rounded-xl font-bold text-xs cursor-pointer flex items-center space-x-1.5 shadow-sm transition-all">
                          <Upload size={14} />
                          <span>Upload Cover Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCoverFileUpload}
                            className="hidden"
                          />
                        </label>
                        <span className="text-[11px] text-gray-400 font-medium">or paste image link below</span>
                      </div>

                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/photo-..."
                        value={formData.coverImageUrl}
                        onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-mono text-[11px] text-gray-700 focus:border-[#F26522] outline-none"
                      />

                      {/* Quick Cover Presets */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-gray-400">Sample covers:</span>
                        {SUGGESTED_COVERS.map((sc, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setFormData({ ...formData, coverImageUrl: sc.url })}
                            className="px-2 py-0.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-md text-[10px] font-bold text-gray-600 transition-colors"
                          >
                            {sc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Synopsis / Description */}
                <div className="space-y-1.5">
                  <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                    Description / Synopsis & Chapter Overview
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Provide a comprehensive synopsis of the book, key revelations, who should read it, and its spiritual impact..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-[#1A1F3C] text-xs leading-relaxed focus:bg-white focus:border-[#F26522] outline-none"
                  />
                </div>

                {/* Specifications: Pages, Year, ISBN, Order */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="font-black text-gray-600 uppercase tracking-wider text-[9px]">Page Count</label>
                    <input
                      type="text"
                      placeholder="184"
                      value={formData.pages}
                      onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-black text-gray-600 uppercase tracking-wider text-[9px]">Publish Year</label>
                    <input
                      type="text"
                      placeholder="2026"
                      value={formData.publishedYear}
                      onChange={(e) => setFormData({ ...formData, publishedYear: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-black text-gray-600 uppercase tracking-wider text-[9px]">ISBN / Catalog</label>
                    <input
                      type="text"
                      placeholder="978-978-..."
                      value={formData.isbn}
                      onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-black text-gray-600 uppercase tracking-wider text-[9px]">Display Order</label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xs"
                    />
                  </div>
                </div>

                {/* Digital Download Link & Store Links */}
                <div className="space-y-3 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Download size={16} className="text-[#F26522]" />
                      <span className="font-black text-[#1A1F3C] text-xs">Digital Download & Online Purchase Links</span>
                    </div>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isFree}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          isFree: e.target.checked,
                          price: e.target.checked ? 'Free Download' : formData.price
                        })}
                        className="rounded text-[#F26522] focus:ring-[#F26522] w-4 h-4"
                      />
                      <span className="font-black text-xs text-[#1A1F3C]">Free Spiritual Download</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <label className="font-black text-gray-600 uppercase tracking-wider text-[9px]">
                        PDF / E-Book Direct Download URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/... or https://..."
                        value={formData.downloadUrl}
                        onChange={(e) => setFormData({ ...formData, downloadUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-mono text-[11px] text-[#1A1F3C]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-black text-gray-600 uppercase tracking-wider text-[9px]">
                        Sample Chapter / Preview URL (Optional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={formData.previewUrl}
                        onChange={(e) => setFormData({ ...formData, previewUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-mono text-[11px] text-[#1A1F3C]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-black text-gray-600 uppercase tracking-wider text-[9px]">
                        Physical Copy / Store Link (Amazon, Bookstore, WhatsApp)
                      </label>
                      <input
                        type="url"
                        placeholder="https://amazon.com/... or WhatsApp order link"
                        value={formData.purchaseUrl}
                        onChange={(e) => setFormData({ ...formData, purchaseUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-mono text-[11px] text-[#1A1F3C]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-black text-gray-600 uppercase tracking-wider text-[9px]">
                        Price / Pricing Label
                      </label>
                      <input
                        type="text"
                        placeholder="Free Download or ₦5,000 / $15"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        disabled={formData.isFree}
                        className={cn(
                          "w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold text-xs",
                          formData.isFree && "bg-gray-100 text-gray-500 cursor-not-allowed"
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Status Toggles: Featured & Published */}
                <div className="flex flex-wrap items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200 gap-4">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                    />
                    <div>
                      <p className="font-black text-xs text-[#1A1F3C]">Featured Book</p>
                      <p className="text-[10px] text-gray-500">Showcase this publication at the top of media & resource sections</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPublished}
                      onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-600 w-4 h-4"
                    />
                    <div>
                      <p className="font-black text-xs text-[#1A1F3C]">Publish Live</p>
                      <p className="text-[10px] text-gray-500">Make visible to members and website visitors</p>
                    </div>
                  </label>
                </div>

                {/* Submit Action Bar */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-6 py-2.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-[#F26522]/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {formSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Saving Book...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>{editingBook ? 'Save Changes' : 'Publish Book'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL / PREVIEW MODAL */}
      <AnimatePresence>
        {previewingBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col border border-gray-100 relative my-8"
            >
              <button
                onClick={() => setPreviewingBook(null)}
                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black flex items-center justify-center backdrop-blur-md transition-colors"
              >
                <X size={16} />
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-5 bg-slate-900 text-white p-6 sm:p-8 gap-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#F26522_1px,transparent_1px)] [background-size:12px_12px]" />
                
                {/* 3D Cover */}
                <div className="sm:col-span-2 flex justify-center items-center">
                  <div className="w-40 h-56 rounded-r-xl rounded-l-sm overflow-hidden shadow-2xl border-r-2 border-white/20 relative">
                    <img
                      src={previewingBook.coverImageUrl || SUGGESTED_COVERS[0].url}
                      alt={previewingBook.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/60 via-black/20 to-transparent pointer-events-none" />
                  </div>
                </div>

                {/* Quick Info */}
                <div className="sm:col-span-3 space-y-3 flex flex-col justify-center relative z-10">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 bg-[#F26522] text-white text-[10px] font-black uppercase tracking-wider rounded-md">
                      {previewingBook.category}
                    </span>
                    {previewingBook.isFeatured && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider rounded-md flex items-center space-x-1">
                        <Star size={10} className="fill-current" />
                        <span>Featured</span>
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black leading-tight text-white">{previewingBook.title}</h2>
                  {previewingBook.subtitle && (
                    <p className="text-xs font-serif italic text-gray-300">"{previewingBook.subtitle}"</p>
                  )}

                  <p className="text-xs text-gray-300 font-bold">
                    Author: <span className="text-[#F26522]">{previewingBook.author}</span>
                  </p>

                  <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-bold text-gray-300">
                    <span className="px-2.5 py-1 bg-white/10 rounded-lg">{previewingBook.format || 'PDF E-Book'}</span>
                    {previewingBook.pages && <span className="px-2.5 py-1 bg-white/10 rounded-lg">{previewingBook.pages} Pages</span>}
                    {previewingBook.publishedYear && <span className="px-2.5 py-1 bg-white/10 rounded-lg">{previewingBook.publishedYear}</span>}
                  </div>
                </div>
              </div>

              {/* Description & Action Links */}
              <div className="p-6 sm:p-8 space-y-6 text-xs overflow-y-auto max-h-[50vh]">
                <div className="space-y-2">
                  <h4 className="font-black uppercase tracking-wider text-[10px] text-gray-400">About This Book</h4>
                  <p className="text-gray-700 leading-relaxed text-sm font-medium">
                    {previewingBook.description || 'No description provided.'}
                  </p>
                </div>

                {previewingBook.isbn && (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-gray-600">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-gray-400">ISBN Catalog Reference</span>
                    <span className="font-mono font-bold text-xs">{previewingBook.isbn}</span>
                  </div>
                )}

                {/* Download & Purchase Buttons */}
                <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {previewingBook.downloadUrl ? (
                      <a
                        href={previewingBook.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-md shadow-[#F26522]/20 transition-all"
                      >
                        <Download size={15} />
                        <span>Download Free E-Book</span>
                      </a>
                    ) : (
                      <span className="px-4 py-2 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs flex items-center space-x-1.5">
                        <Download size={14} />
                        <span>Available in Ministry Library</span>
                      </span>
                    )}

                    {previewingBook.purchaseUrl && (
                      <a
                        href={previewingBook.purchaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 bg-[#1A1F3C] hover:bg-black text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all"
                      >
                        <ShoppingBag size={14} />
                        <span>Order Paperback</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyBookShareLink(previewingBook)}
                      className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                      title="Copy Share Link"
                    >
                      {copiedLink ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>

                    <button
                      onClick={() => {
                        const b = previewingBook;
                        setPreviewingBook(null);
                        handleOpenEditModal(b);
                      }}
                      className="px-4 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-xs flex items-center space-x-1"
                    >
                      <Edit3 size={14} />
                      <span>Edit Book</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100 text-center"
            >
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={28} />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-black text-[#1A1F3C]">Delete this Book?</h3>
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  Are you sure you want to permanently delete <strong className="text-[#1A1F3C]">"{deletingBook.title}"</strong> from the library? This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingBook(null)}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteConfirm}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-red-500/20 disabled:opacity-50"
                >
                  {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>Confirm Delete</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IMPORT / EXPORT BOOKS MODAL */}
      <AdminBookImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingBooks={books}
        onImportSuccess={(count) => {
          setFormSuccessMessage(`Successfully imported ${count} books into your library!`);
          setTimeout(() => setFormSuccessMessage(null), 5000);
        }}
      />
    </div>
  );
}
