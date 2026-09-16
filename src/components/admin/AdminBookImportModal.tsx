/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Upload, Download, FileText, CheckCircle2, AlertTriangle, 
  X, RefreshCw, Sparkles, BookOpen, Layers, Check, Copy, HelpCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BookItem, BOOK_CATEGORIES, BOOK_FORMATS, importBooksBatch } from '../../lib/books';
import { cn } from '../../lib/utils';

interface AdminBookImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingBooks: BookItem[];
  onImportSuccess?: (count: number) => void;
}

type ImportTab = 'csv_file' | 'paste' | 'json' | 'export';

export default function AdminBookImportModal({
  isOpen,
  onClose,
  existingBooks,
  onImportSuccess
}: AdminBookImportModalProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('csv_file');
  const [parsedBooks, setParsedBooks] = useState<Partial<BookItem>[]>([]);
  const [rawText, setRawText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; errors: string[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Generate and download a sample CSV template
  const handleDownloadTemplate = () => {
    const headers = [
      'Title',
      'Subtitle',
      'Author',
      'Category',
      'Format',
      'Pages',
      'PublishedYear',
      'Description',
      'DownloadUrl',
      'CoverImageUrl',
      'PurchaseUrl',
      'IsFree',
      'Price',
      'ISBN',
      'IsFeatured',
      'IsPublished'
    ];

    const sampleRow1 = [
      '"The Mantle of Midnight Intercession"',
      '"Unlocking Prophetic Altars and Breaking Territorial Strongholds"',
      '"Pastor Osaro Aghedo"',
      '"Prayer & Intercession"',
      '"PDF E-Book (Free Download)"',
      '195',
      '2026',
      '"A revelation-rich manual guiding believers through the mystery of the midnight watch and prophetic spiritual warfare."',
      '"https://lightupprayerhouse.org/books/midnight-intercession.pdf"',
      '"https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80"',
      '""',
      'TRUE',
      '"Free Download"',
      '"978-978-000-101-1"',
      'TRUE',
      'TRUE'
    ];

    const sampleRow2 = [
      '"Walking in Kingdom Authority"',
      '"Principles of Spiritual Dominance and Victorious Faith"',
      '"Pastor Osaro Aghedo"',
      '"Spiritual Growth & Destiny"',
      '"PDF E-Book (Free Download)"',
      '160',
      '2025',
      '"Discover how to walk in the unbroken authority of Christ and manifest kingdom glory daily."',
      '"https://lightupprayerhouse.org/books/kingdom-authority.pdf"',
      '"https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80"',
      '""',
      'TRUE',
      '"Free Download"',
      '"978-978-000-102-2"',
      'FALSE',
      'TRUE'
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      headers.join(','),
      sampleRow1.join(','),
      sampleRow2.join(',')
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'lightup_books_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export existing books to CSV
  const handleExportCSV = () => {
    const headers = [
      'Title',
      'Subtitle',
      'Author',
      'Category',
      'Format',
      'Pages',
      'PublishedYear',
      'Description',
      'DownloadUrl',
      'CoverImageUrl',
      'PurchaseUrl',
      'IsFree',
      'Price',
      'ISBN',
      'IsFeatured',
      'IsPublished'
    ];

    const rows = existingBooks.map(b => [
      `"${(b.title || '').replace(/"/g, '""')}"`,
      `"${(b.subtitle || '').replace(/"/g, '""')}"`,
      `"${(b.author || '').replace(/"/g, '""')}"`,
      `"${(b.category || '').replace(/"/g, '""')}"`,
      `"${(b.format || '').replace(/"/g, '""')}"`,
      `"${b.pages || ''}"`,
      `"${b.publishedYear || ''}"`,
      `"${(b.description || '').replace(/"/g, '""')}"`,
      `"${b.downloadUrl || ''}"`,
      `"${b.coverImageUrl || ''}"`,
      `"${b.purchaseUrl || ''}"`,
      b.isFree !== false ? 'TRUE' : 'FALSE',
      `"${b.price || 'Free'}"`,
      `"${b.isbn || ''}"`,
      b.isFeatured ? 'TRUE' : 'FALSE',
      b.isPublished !== false ? 'TRUE' : 'FALSE'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lightup_books_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export existing books to JSON
  const handleExportJSON = () => {
    const cleanData = existingBooks.map(({ id, createdAt, updatedAt, ...rest }) => rest);
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cleanData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `lightup_books_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to parse robust CSV (handles quotes and multiline)
  const parseCSV = (csvText: string): Partial<BookItem>[] => {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        currentLine += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = '';
        if (char === '\r' && csvText[i + 1] === '\n') {
          i++; // skip \n
        }
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine);
    }

    if (lines.length === 0) return [];

    // Parse header row
    const parseRow = (rowText: string): string[] => {
      const result: string[] = [];
      let cell = '';
      let inside = false;
      for (let i = 0; i < rowText.length; i++) {
        const c = rowText[i];
        if (c === '"') {
          if (inside && rowText[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            inside = !inside;
          }
        } else if (c === ',' && !inside) {
          result.push(cell.trim());
          cell = '';
        } else {
          cell += c;
        }
      }
      result.push(cell.trim());
      return result;
    };

    const headerRow = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    // Check if header row is actually headers or data
    const hasHeader = headerRow.some(h => ['title', 'author', 'book', 'category', 'pages'].includes(h));
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const books: Partial<BookItem>[] = [];

    dataLines.forEach((line, index) => {
      const cols = parseRow(line);
      if (cols.length === 0 || cols.every(c => !c)) return;

      const item: Partial<BookItem> = {
        title: '',
        subtitle: '',
        author: 'Pastor Osaro Aghedo',
        category: 'Prayer & Intercession',
        format: 'PDF E-Book (Free Download)',
        description: '',
        pages: '160',
        publishedYear: new Date().getFullYear().toString(),
        downloadUrl: '',
        coverImageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80',
        purchaseUrl: '',
        isFree: true,
        price: 'Free Download',
        isbn: '',
        isFeatured: false,
        isPublished: true,
        order: index + 1
      };

      if (hasHeader) {
        headerRow.forEach((h, colIdx) => {
          const val = cols[colIdx] || '';
          if (h === 'title' || h === 'booktitle' || h === 'name') item.title = val;
          else if (h === 'subtitle' || h === 'tagline') item.subtitle = val;
          else if (h === 'author' || h === 'writer' || h === 'by') item.author = val || 'Pastor Osaro Aghedo';
          else if (h === 'category' || h === 'genre') item.category = val || 'Prayer & Intercession';
          else if (h === 'format' || h === 'type') item.format = val || 'PDF E-Book (Free Download)';
          else if (h === 'pages' || h === 'pagecount') item.pages = val;
          else if (h === 'publishedyear' || h === 'year') item.publishedYear = val;
          else if (h === 'description' || h === 'summary' || h === 'about') item.description = val;
          else if (h === 'downloadurl' || h === 'pdfurl' || h === 'pdf' || h === 'fileurl') item.downloadUrl = val;
          else if (h === 'coverimageurl' || h === 'coverurl' || h === 'image' || h === 'cover') item.coverImageUrl = val;
          else if (h === 'purchaseurl' || h === 'buyurl' || h === 'storeurl') item.purchaseUrl = val;
          else if (h === 'isfree' || h === 'free') item.isFree = val.toLowerCase() !== 'false' && val.toLowerCase() !== 'no';
          else if (h === 'price') item.price = val;
          else if (h === 'isbn') item.isbn = val;
          else if (h === 'isfeatured' || h === 'featured') item.isFeatured = val.toLowerCase() === 'true' || val.toLowerCase() === 'yes';
          else if (h === 'ispublished' || h === 'published' || h === 'status') item.isPublished = val.toLowerCase() !== 'false' && val.toLowerCase() !== 'draft';
        });
      } else {
        // Fallback positional mapping: Title, Subtitle, Author, Category, Format, Pages, Year, Description, DownloadUrl, CoverUrl
        if (cols[0]) item.title = cols[0];
        if (cols[1]) item.subtitle = cols[1];
        if (cols[2]) item.author = cols[2];
        if (cols[3]) item.category = cols[3];
        if (cols[4]) item.format = cols[4];
        if (cols[5]) item.pages = cols[5];
        if (cols[6]) item.publishedYear = cols[6];
        if (cols[7]) item.description = cols[7];
        if (cols[8]) item.downloadUrl = cols[8];
        if (cols[9]) item.coverImageUrl = cols[9];
      }

      if (item.title && item.title.trim()) {
        books.push(item);
      }
    });

    return books;
  };

  // Parse JSON text or array
  const parseJSON = (jsonText: string): Partial<BookItem>[] => {
    const raw = JSON.parse(jsonText);
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map((item: any, idx: number) => ({
      title: String(item.title || item.name || '').trim(),
      subtitle: String(item.subtitle || '').trim(),
      author: String(item.author || 'Pastor Osaro Aghedo').trim(),
      category: String(item.category || 'Prayer & Intercession').trim(),
      format: String(item.format || 'PDF E-Book (Free Download)').trim(),
      pages: item.pages ? String(item.pages) : '160',
      publishedYear: item.publishedYear ? String(item.publishedYear) : new Date().getFullYear().toString(),
      description: String(item.description || '').trim(),
      downloadUrl: String(item.downloadUrl || item.pdfUrl || item.url || '').trim(),
      coverImageUrl: String(item.coverImageUrl || item.imageUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80').trim(),
      purchaseUrl: String(item.purchaseUrl || '').trim(),
      isFree: item.isFree !== undefined ? Boolean(item.isFree) : true,
      price: String(item.price || 'Free Download').trim(),
      isbn: String(item.isbn || '').trim(),
      isFeatured: Boolean(item.isFeatured),
      isPublished: item.isPublished !== undefined ? Boolean(item.isPublished) : true,
      order: Number(item.order) || idx + 1
    })).filter(b => Boolean(b.title));
  };

  // Parse plain text line list (e.g. "Title | Category | DownloadUrl" or "Title by Author")
  const parseLineList = (text: string): Partial<BookItem>[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const books: Partial<BookItem>[] = [];

    lines.forEach((line, idx) => {
      let title = line;
      let author = 'Pastor Osaro Aghedo';
      let category = 'Prayer & Intercession';
      let downloadUrl = '';

      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim());
        title = parts[0] || '';
        if (parts[1]) category = parts[1];
        if (parts[2]) downloadUrl = parts[2];
        if (parts[3]) author = parts[3];
      } else if (line.toLowerCase().includes(' by ')) {
        const parts = line.split(/ by /i);
        title = parts[0] || '';
        author = parts[1] || 'Pastor Osaro Aghedo';
      }

      if (title) {
        books.push({
          title,
          subtitle: '',
          author,
          category,
          format: 'PDF E-Book (Free Download)',
          pages: '160',
          publishedYear: new Date().getFullYear().toString(),
          description: `Spiritual resource and teaching by ${author}.`,
          downloadUrl,
          coverImageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80',
          purchaseUrl: '',
          isFree: true,
          price: 'Free Download',
          isbn: '',
          isFeatured: false,
          isPublished: true,
          order: idx + 1
        });
      }
    });

    return books;
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setParseError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const items = parseJSON(content);
          if (items.length === 0) {
            setParseError('No valid books with titles found in this JSON file.');
          } else {
            setParsedBooks(items);
          }
        } else {
          // Assume CSV
          const items = parseCSV(content);
          if (items.length === 0) {
            setParseError('No valid book rows found in this CSV file. Please check column headers or format.');
          } else {
            setParsedBooks(items);
          }
        }
      } catch (err: any) {
        setParseError(`Failed to parse file: ${err?.message || 'Invalid format'}`);
      }
    };
    reader.readAsText(file);
  };

  // Handle parsing from raw text/JSON area
  const handleParseRawText = () => {
    setParseError(null);
    setImportResult(null);
    if (!rawText.trim()) {
      setParseError('Please paste CSV, JSON, or book entries into the box.');
      return;
    }

    try {
      if (rawText.trim().startsWith('[') || rawText.trim().startsWith('{')) {
        const items = parseJSON(rawText);
        if (items.length === 0) throw new Error('No valid books found.');
        setParsedBooks(items);
      } else if (rawText.includes(',') || rawText.includes('\t')) {
        const items = parseCSV(rawText);
        if (items.length === 0) throw new Error('No valid CSV rows parsed.');
        setParsedBooks(items);
      } else {
        const items = parseLineList(rawText);
        if (items.length === 0) throw new Error('No book titles recognized.');
        setParsedBooks(items);
      }
    } catch (err: any) {
      setParseError(`Parsing error: ${err?.message || 'Could not parse format. Try CSV or JSON.'}`);
    }
  };

  // Execute Batch Import
  const handleExecuteImport = async () => {
    if (parsedBooks.length === 0) return;
    setIsImporting(true);
    setImportResult(null);

    try {
      const res = await importBooksBatch(parsedBooks);
      setIsImporting(false);
      setImportResult({ count: res.successCount, errors: res.errors });

      if (res.successCount > 0 && onImportSuccess) {
        onImportSuccess(res.successCount);
      }
    } catch (err: any) {
      setIsImporting(false);
      setImportResult({ count: 0, errors: [err?.message || 'Failed to import books.'] });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-[#1A1F3C] text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F26522] flex items-center justify-center text-white shadow-md shadow-[#F26522]/30">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Import Books & Publications</h2>
              <p className="text-xs text-gray-300 font-medium">
                Bulk upload books via CSV spreadsheet, JSON, or paste lists directly into Firestore
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex space-x-2">
            {[
              { id: 'csv_file', label: 'Upload CSV / Excel', icon: Upload },
              { id: 'paste', label: 'Paste Text / List', icon: FileText },
              { id: 'json', label: 'JSON Array', icon: Layers },
              { id: 'export', label: 'Export Library', icon: Download }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as ImportTab);
                    setParseError(null);
                  }}
                  className={cn(
                    "px-4 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all border-b-2",
                    activeTab === tab.id
                      ? "bg-white text-[#F26522] border-[#F26522] shadow-sm"
                      : "text-gray-500 hover:text-gray-900 border-transparent"
                  )}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab !== 'export' && (
            <button
              onClick={handleDownloadTemplate}
              className="mb-2 px-3 py-1.5 bg-white border border-gray-200 hover:border-[#F26522] text-[#1A1F3C] hover:text-[#F26522] rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download size={13} />
              <span>Download CSV Template</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: CSV FILE UPLOAD */}
          {activeTab === 'csv_file' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) processFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-200",
                  isDragging 
                    ? "border-[#F26522] bg-[#F26522]/5 scale-[0.99]" 
                    : "border-gray-300 hover:border-[#F26522] bg-gray-50/50 hover:bg-[#F26522]/5"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-gray-200 text-[#F26522] flex items-center justify-center mx-auto mb-3">
                  <Upload size={26} />
                </div>
                <h3 className="text-sm font-black text-[#1A1F3C]">Click to Upload or Drag & Drop File</h3>
                <p className="text-xs text-gray-500 font-medium mt-1">Supports standard CSV (.csv) and JSON (.json) files</p>
                <div className="flex items-center justify-center space-x-2 mt-4">
                  <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600">CSV spreadsheet</span>
                  <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600">Google Sheets Export</span>
                  <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600">JSON Format</span>
                </div>
              </div>

              {/* Instructions Callout */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start space-x-3 text-xs text-blue-900">
                <HelpCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Supported CSV Column Headers:</p>
                  <p className="text-blue-800 font-medium leading-relaxed">
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">Title</code> (required),{' '}
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">Subtitle</code>,{' '}
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">Author</code>,{' '}
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">Category</code>,{' '}
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">Format</code>,{' '}
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">Pages</code>,{' '}
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">PublishedYear</code>,{' '}
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">Description</code>,{' '}
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">DownloadUrl</code>,{' '}
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">CoverImageUrl</code>,{' '}
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">PurchaseUrl</code>,{' '}
                    <code className="bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">ISBN</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2 & 3: PASTE TEXT / JSON */}
          {(activeTab === 'paste' || activeTab === 'json') && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5">
                  {activeTab === 'json' ? 'Paste JSON Array of Books' : 'Paste CSV or List (One per line: Title | Category | PDF Link)'}
                </label>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={
                    activeTab === 'json'
                      ? '[\n  {\n    "title": "The Power of Midnight Prayers",\n    "author": "Pastor Osaro Aghedo",\n    "category": "Prayer & Intercession",\n    "pages": "180",\n    "downloadUrl": "https://example.com/book.pdf"\n  }\n]'
                      : 'The Mantle of Midnight Intercession | Prayer & Intercession | https://example.com/book1.pdf\nWalking in Kingdom Authority | Spiritual Growth & Destiny | https://example.com/book2.pdf'
                  }
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-mono text-[#1A1F3C] placeholder-gray-400 focus:bg-white focus:border-[#F26522] focus:ring-2 focus:ring-[#F26522]/20 outline-none resize-y"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParseRawText}
                  className="px-5 py-2.5 bg-[#1A1F3C] hover:bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-md cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>Parse & Preview ({parsedBooks.length} Ready)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: EXPORT LIBRARY */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-6 border border-gray-200">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#1A1F3C]">Export Current Book Catalog</h3>
                    <p className="text-xs text-gray-500 font-medium">
                      Download all {existingBooks.length} books in your library for spreadsheet backup or editing.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <button
                    onClick={handleExportCSV}
                    className="p-5 bg-white border border-gray-200 hover:border-emerald-500 rounded-2xl text-left shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-600">CSV Spreadsheet</span>
                      <Download size={18} className="text-gray-400 group-hover:text-emerald-600 transition-colors" />
                    </div>
                    <p className="text-xs text-gray-600 font-medium">
                      Best for Microsoft Excel, Google Sheets, Apple Numbers, or bulk spreadsheet management.
                    </p>
                  </button>

                  <button
                    onClick={handleExportJSON}
                    className="p-5 bg-white border border-gray-200 hover:border-blue-500 rounded-2xl text-left shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-blue-600">JSON Archive</span>
                      <Download size={18} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <p className="text-xs text-gray-600 font-medium">
                      Best for programmatic developer backups, migrations, or database archives.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PARSE ERROR ALERT */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-red-700">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Import Warning</p>
                <p className="text-red-600 font-medium mt-0.5">{parseError}</p>
              </div>
            </div>
          )}

          {/* SUCCESS MESSAGE */}
          {importResult && (
            <div className={cn(
              "rounded-2xl p-4 flex items-start space-x-3 text-xs",
              importResult.count > 0 
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800" 
                : "bg-red-50 border border-red-200 text-red-800"
            )}>
              {importResult.count > 0 ? (
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-black text-sm">
                  {importResult.count > 0 
                    ? `Successfully imported ${importResult.count} book(s) into the library!` 
                    : 'Import completed with warnings.'}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5 text-xs opacity-90">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* PARSED PREVIEW TABLE */}
          {parsedBooks.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#1A1F3C]">
                    Previewing Books to Import ({parsedBooks.length})
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                    Ready to save
                  </span>
                </div>
                <button
                  onClick={() => setParsedBooks([])}
                  className="text-xs text-gray-400 hover:text-red-600 font-bold"
                >
                  Clear preview
                </button>
              </div>

              <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Title & Subtitle</th>
                      <th className="p-3">Author</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Pages / Year</th>
                      <th className="p-3 text-right">PDF Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                    {parsedBooks.map((book, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/80">
                        <td className="p-3 text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="p-3">
                          <p className="font-bold text-[#1A1F3C]">{book.title}</p>
                          {book.subtitle && <p className="text-[11px] text-gray-400 line-clamp-1">{book.subtitle}</p>}
                        </td>
                        <td className="p-3 text-gray-600 whitespace-nowrap">{book.author}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[10px] font-bold whitespace-nowrap">
                            {book.category}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500 whitespace-nowrap">
                          {book.pages ? `${book.pages} pp.` : '—'} • {book.publishedYear || '—'}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {book.downloadUrl ? (
                            <span className="text-emerald-600 font-bold text-[11px] flex items-center justify-end space-x-1">
                              <Check size={12} />
                              <span>Provided</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px]">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs cursor-pointer"
          >
            Close
          </button>

          {parsedBooks.length > 0 && activeTab !== 'export' && (
            <button
              type="button"
              disabled={isImporting}
              onClick={handleExecuteImport}
              className="px-6 py-3 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-[#F26522]/30 disabled:opacity-50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              {isImporting ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
              <span>Import {parsedBooks.length} Books to Library</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
