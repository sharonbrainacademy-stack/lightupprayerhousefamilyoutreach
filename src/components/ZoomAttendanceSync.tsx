/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Upload, FileText, CheckCircle2, AlertTriangle, 
  Users, Clock, Download, RefreshCw, Trash2, 
  Search, Plus, Check, X, Filter, Calendar, 
  ExternalLink, ArrowRight, Video, Sparkles, FileSpreadsheet, Eye, MessageCircle,
  FileCode2, ClipboardPaste
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, setDoc, addDoc, deleteDoc, serverTimestamp, getDocs, writeBatch, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, ZoomSessionItem, ZoomParticipantLog } from '../types';
import { getTodayDateString } from '../lib/attendance';
import { cn } from '../lib/utils';
import { getMemberWhatsAppCommunity, WHATSAPP_COMMUNITY_OPTIONS } from '../lib/whatsapp';

interface ParsedParticipantRow {
  id: string;
  name: string;
  email: string;
  durationMinutes: number;
  joinTime?: string;
  leaveTime?: string;
  matchedMember?: UserProfile | null;
  whatsappCommunity?: string;
  status: 'matched' | 'guest';
}

interface ZoomAttendanceSyncProps {
  members: UserProfile[];
  onRefreshMembers?: () => void;
}

export default function ZoomAttendanceSync({ members, onRefreshMembers }: ZoomAttendanceSyncProps) {
  const [activeSubTab, setActiveSubTab] = useState<'import' | 'manual' | 'history'>('import');
  
  // Import state
  const [meetingTitle, setMeetingTitle] = useState('Daily Morning Prayer & Intercession');
  const [meetingDate, setMeetingDate] = useState(getTodayDateString());
  const [meetingNotes, setMeetingNotes] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedParticipantRow[]>([]);
  const [rawFileName, setRawFileName] = useState<string | null>(null);
  const [rawExtractedText, setRawExtractedText] = useState<string>('');
  const [showRawTextPreview, setShowRawTextPreview] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');
  const [syncErrorMsg, setSyncErrorMsg] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [isPasteMode, setIsPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual fast logger state
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualMinutes, setManualMinutes] = useState(60);
  const [manualCommunity, setManualCommunity] = useState('');
  const [manualDate, setManualDate] = useState(getTodayDateString());
  const [manualMeetingTitle, setManualMeetingTitle] = useState('Daily Morning Prayer & Intercession');
  const [manualSaving, setManualSaving] = useState(false);

  // History state
  const [sessions, setSessions] = useState<ZoomSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ZoomSessionItem | null>(null);
  const [sessionLogs, setSessionLogs] = useState<ZoomParticipantLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Dynamically compute all community options from defaults + any new custom groups in database
  const dynamicCommunityOptions = useMemo(() => {
    const set = new Set<string>(WHATSAPP_COMMUNITY_OPTIONS);
    members.forEach(m => {
      const comm = getMemberWhatsAppCommunity(m);
      if (comm && comm !== 'Unassigned' && comm.length > 2) {
        set.add(comm);
      }
    });
    return Array.from(set);
  }, [members]);

  // Fetch past synced sessions
  useEffect(() => {
    const q = query(collection(db, 'zoom_sessions'), orderBy('meetingDate', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ZoomSessionItem[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ZoomSessionItem);
      });
      setSessions(list);
      setLoadingSessions(false);
    }, (err) => {
      console.error('Error fetching zoom sessions:', err);
      setLoadingSessions(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch participant logs when a session is selected
  useEffect(() => {
    if (!selectedSession) {
      setSessionLogs([]);
      return;
    }
    setLoadingLogs(true);
    const unsubscribe = onSnapshot(collection(db, 'zoom_participant_logs'), (snapshot) => {
      const logs: ZoomParticipantLog[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as ZoomParticipantLog;
        if (data.sessionId === selectedSession.id) {
          logs.push({ id: docSnap.id, ...data });
        }
      });
      setSessionLogs(logs);
      setLoadingLogs(false);
    }, (err) => {
      console.error('Error fetching session logs:', err);
      setLoadingLogs(false);
    });

    return () => unsubscribe();
  }, [selectedSession]);

  // Helper to normalize dates into YYYY-MM-DD format
  const extractDateFromString = (val: string): string | null => {
    if (!val) return null;
    // Format YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = val.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Format MM/DD/YYYY or M/D/YYYY
    const usMatch = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (usMatch) {
      const part1 = parseInt(usMatch[1], 10);
      const part2 = parseInt(usMatch[2], 10);
      const year = usMatch[3];
      // If part1 > 12, it must be DD/MM/YYYY
      if (part1 > 12) {
        const day = part1.toString().padStart(2, '0');
        const month = part2.toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      } else {
        const month = part1.toString().padStart(2, '0');
        const day = part2.toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    // Try standard Date parse
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
        return d.toISOString().split('T')[0];
      }
    } catch {
      // ignore
    }
    return null;
  };

  // Helper to decompress Flate/zlib streams using native browser DecompressionStream
  const decompressFlateStream = async (data: Uint8Array): Promise<Uint8Array | null> => {
    if (typeof DecompressionStream === 'undefined') return null;
    try {
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(data);
      writer.close();
      const res = new Response(ds.readable);
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(data);
        writer.close();
        const res = new Response(ds.readable);
        const buf = await res.arrayBuffer();
        return new Uint8Array(buf);
      } catch {
        return null;
      }
    }
  };

  // Extract clean text from PDF content stream preserving table rows and columns
  const extractTextFromOperators = (content: string): string => {
    let result = '';

    // Normalize PDF stream operators into tokens
    // BT (begin text), ET (end text), T* (new line), Td/TD/Tm (position/new line), Tj/'/"/TJ (text)
    const tokenRegex = /(\/?[a-zA-Z0-9_.-]+|\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>|\[[^\]]*\]|[-+]?[0-9]*\.?[0-9]+|BT|ET|Td|TD|Tm|T\*|Tj|TJ|'|")/g;
    
    let tokenMatch;
    const stack: string[] = [];

    while ((tokenMatch = tokenRegex.exec(content)) !== null) {
      const token = tokenMatch[0];

      if (token === 'BT') {
        result += '\n';
        stack.length = 0;
      } else if (token === 'ET') {
        result += '\n';
        stack.length = 0;
      } else if (token === 'T*') {
        result += '\n';
        stack.length = 0;
      } else if (token === 'Td' || token === 'TD') {
        // [tx, ty] Td
        const ty = parseFloat(stack[stack.length - 1] || '0');
        const tx = parseFloat(stack[stack.length - 2] || '0');
        if (ty !== 0) {
          result += '\n';
        } else if (tx > 2) {
          result += '\t';
        }
        stack.length = 0;
      } else if (token === 'Tm') {
        // [a, b, c, d, e, f] Tm
        result += '\n';
        stack.length = 0;
      } else if (token === 'Tj' || token === "'" || token === '"') {
        if (token === "'" || token === '"') {
          result += '\n';
        }
        const strToken = stack[stack.length - 1] || '';
        let unescaped = '';
        if (strToken.startsWith('(') && strToken.endsWith(')')) {
          unescaped = strToken.slice(1, -1)
            .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\(.)/g, '$1');
        } else if (strToken.startsWith('<') && strToken.endsWith('>')) {
          const hex = strToken.slice(1, -1).replace(/\s+/g, '');
          for (let i = 0; i < hex.length; i += 2) {
            const code = parseInt(hex.substring(i, i + 2), 16);
            if (!isNaN(code) && code >= 32 && code <= 126) {
              unescaped += String.fromCharCode(code);
            }
          }
        }
        if (unescaped) {
          result += unescaped + ' ';
        }
        stack.length = 0;
      } else if (token === 'TJ') {
        // [ (string) number (string) ] TJ
        const arrToken = stack[stack.length - 1] || '';
        const innerStrings = arrToken.matchAll(/\(((?:\\.|[^\\)])*)\)|<[0-9A-Fa-f\s]+>/g);
        let combined = '';
        for (const str of innerStrings) {
          const raw = str[0];
          if (raw.startsWith('(') && raw.endsWith(')')) {
            combined += raw.slice(1, -1)
              .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t')
              .replace(/\\(.)/g, '$1');
          } else if (raw.startsWith('<') && raw.endsWith('>')) {
            const hex = raw.slice(1, -1).replace(/\s+/g, '');
            for (let i = 0; i < hex.length; i += 2) {
              const code = parseInt(hex.substring(i, i + 2), 16);
              if (!isNaN(code) && code >= 32 && code <= 126) {
                combined += String.fromCharCode(code);
              }
            }
          }
        }
        if (combined) {
          result += combined + '\t';
        }
        stack.length = 0;
      } else {
        stack.push(token);
        if (stack.length > 10) stack.shift();
      }
    }

    // Fallback literal scanner if tokenization produced very short output
    if (result.trim().length < 30) {
      const literalRegex = /\(([^\)\\]*(?:\\.[^\)\\]*)*)\)\s*(?:Tj|'|")/g;
      let match;
      while ((match = literalRegex.exec(content)) !== null) {
        if (match[1]) {
          const unescaped = match[1]
            .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\(.)/g, '$1');
          if (unescaped.trim().length > 0) {
            result += '\n' + unescaped;
          }
        }
      }
    }

    return result;
  };

  // Pure Client-Side PDF Text Extractor (Zero Web Workers, 100% immune to cloning errors)
  const extractTextFromPDF = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const uint8Array = new Uint8Array(arrayBuffer);
    const latin1Decoder = new TextDecoder('latin1');
    const fullRawString = latin1Decoder.decode(uint8Array);

    let extractedText = '';

    // Find all stream blocks in the PDF
    const streamStartRegex = /stream\r?\n/g;
    let streamMatch;

    while ((streamMatch = streamStartRegex.exec(fullRawString)) !== null) {
      const startIndex = streamMatch.index + streamMatch[0].length;
      const endKeywordIndex = fullRawString.indexOf('endstream', startIndex);
      if (endKeywordIndex === -1) continue;

      let endIndex = endKeywordIndex;
      // Trim trailing \r or \n before endstream
      if (endIndex > startIndex && fullRawString[endIndex - 1] === '\n') endIndex--;
      if (endIndex > startIndex && fullRawString[endIndex - 1] === '\r') endIndex--;

      const streamBytes = uint8Array.subarray(startIndex, endIndex);

      // Check header before stream for /FlateDecode
      const headerSnippet = fullRawString.substring(Math.max(0, streamMatch.index - 300), streamMatch.index);
      const isFlate = headerSnippet.includes('/FlateDecode') || headerSnippet.includes('/Fl');

      let decompressedBytes: Uint8Array | null = null;
      if (isFlate) {
        decompressedBytes = await decompressFlateStream(streamBytes);
      }

      const streamText = decompressedBytes ? latin1Decoder.decode(decompressedBytes) : latin1Decoder.decode(streamBytes);
      const parsedOperators = extractTextFromOperators(streamText);
      if (parsedOperators.trim().length > 0) {
        extractedText += '\n' + parsedOperators;
      }
    }

    // Also scan literal strings outside streams or in uncompressed sections
    const outsideText = extractTextFromOperators(fullRawString);
    if (outsideText.trim().length > 0) {
      extractedText += '\n' + outsideText;
    }

    // If still sparse, extract readable email and name chunks
    if (extractedText.trim().length < 30) {
      const readableRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9\s:/-]{4,}/g;
      const chunks: string[] = (fullRawString.match(readableRegex) || []) as string[];
      const cleanChunks = chunks.filter((c: string) => !c.includes('/Font') && !c.includes('/Type') && !c.includes('/Length') && !c.includes('/Filter'));
      extractedText += '\n' + cleanChunks.join('\n');
    }

    if (extractedText.trim().length > 10) {
      return extractedText;
    }

    throw new Error('Could not read text from this PDF. Please open the PDF, copy the text or participant list, switch to "Paste Text" above, and click "Process Pasted Report".');
  };

  // Robust Unified Parser for CSV, PDF Text, and Pasted Zoom Attendance Reports
  const parseReportContent = (text: string, sourceName: string = 'report') => {
    setIsParsing(true);
    setSyncErrorMsg('');
    try {
      // Clean UTF-8 BOM and normalize newlines
      const cleanText = text.replace(/^\uFEFF/, '').trim();
      setRawExtractedText(cleanText);
      if (!cleanText) {
        throw new Error('The selected file or pasted report text is empty.');
      }

      const rawLines = cleanText
        .split(/\r\n|\n|\r/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (rawLines.length === 0) {
        throw new Error('No readable lines found in the attendance report.');
      }

      // Check if delimiter-based CSV
      const detectDelimiter = (line: string): string => {
        const commas = (line.match(/,/g) || []).length;
        const semicolons = (line.match(/;/g) || []).length;
        const tabs = (line.match(/\t/g) || []).length;
        if (tabs > commas && tabs > semicolons) return '\t';
        if (semicolons > commas) return ';';
        if (commas > 0) return ',';
        return 'spaces';
      };

      const primaryDelimiter = detectDelimiter(rawLines[0]);

      // Split CSV line with quote awareness
      const parseCSVLine = (line: string, delimiter: string = primaryDelimiter): string[] => {
        if (delimiter === 'spaces') {
          // Space/Tab delimited: split by 2+ spaces or tabs
          return line.split(/\t+|\s{2,}/).map(s => s.trim()).filter(s => s.length > 0);
        }
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(current.trim().replace(/^["']|["']$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        return result;
      };

      // 1. Scan for Zoom Metadata Header (Meeting Topic, Start Time, Date)
      let detectedTopic = '';
      let detectedDate = '';

      for (let i = 0; i < Math.min(rawLines.length, 12); i++) {
        const line = rawLines[i];
        const lowerLine = line.toLowerCase();

        // Check for Topic
        if (lowerLine.includes('topic:') || lowerLine.includes('meeting title:') || lowerLine.includes('subject:')) {
          const parts = line.split(/topic:|meeting title:|subject:/i);
          if (parts[1] && parts[1].trim().length > 2) {
            detectedTopic = parts[1].trim();
          }
        }

        // Check for Date
        const dateMatch = extractDateFromString(line);
        if (dateMatch && !detectedDate) {
          detectedDate = dateMatch;
        }

        // Check CSV table metadata
        if (primaryDelimiter !== 'spaces') {
          const cols = parseCSVLine(line);
          const lowerCols = cols.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
          const topicIdx = lowerCols.findIndex(c => c.includes('topic') || c.includes('subject') || c.includes('meetingtitle'));
          const startTimeIdx = lowerCols.findIndex(c => c.includes('starttime') || c.includes('start') || c.includes('meetingtime'));
          if (topicIdx !== -1 && i + 1 < rawLines.length) {
            const nextCols = parseCSVLine(rawLines[i + 1]);
            if (nextCols[topicIdx] && !nextCols[topicIdx].toLowerCase().includes('name')) {
              detectedTopic = nextCols[topicIdx];
            }
          }
          if (startTimeIdx !== -1 && i + 1 < rawLines.length) {
            const nextCols = parseCSVLine(rawLines[i + 1]);
            if (nextCols[startTimeIdx]) {
              const dFound = extractDateFromString(nextCols[startTimeIdx]);
              if (dFound) detectedDate = dFound;
            }
          }
        }
      }

      // 2. Identify Participant Table Header Row or parse lines directly
      let participantHeaderIndex = -1;
      let nameIdx = -1;
      let emailIdx = -1;
      let durationIdx = -1;
      let joinTimeIdx = -1;
      let leaveTimeIdx = -1;

      for (let i = 0; i < rawLines.length; i++) {
        const lineCols = parseCSVLine(rawLines[i]);
        const lowerHeaders = lineCols.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

        const hasName = lowerHeaders.some(h => 
          h.includes('name') || h.includes('participant') || h.includes('attendee') || h.includes('user')
        );
        const hasEmailOrDuration = lowerHeaders.some(h => 
          h.includes('email') || h.includes('duration') || h.includes('minutes') || h.includes('join')
        );

        if (hasName && (hasEmailOrDuration || lowerHeaders.length >= 2)) {
          participantHeaderIndex = i;
          nameIdx = lowerHeaders.findIndex(h => h.includes('name') || h.includes('participant') || h.includes('attendee') || h.includes('user'));
          emailIdx = lowerHeaders.findIndex(h => h.includes('email') || h.includes('mail'));
          durationIdx = lowerHeaders.findIndex(h => h.includes('duration') || h.includes('minutes') || h.includes('time') || h.includes('mins'));
          joinTimeIdx = lowerHeaders.findIndex(h => h.includes('join') || h.includes('start'));
          leaveTimeIdx = lowerHeaders.findIndex(h => h.includes('leave') || h.includes('end'));
          break;
        }
      }

      const rawRows: { name: string; email: string; duration: number; joinTime?: string; leaveTime?: string }[] = [];

      // Helper function to extract duration minutes from text
      const parseDurationValue = (raw: string): number => {
        if (!raw) return 60;
        if (raw.includes(':')) {
          const parts = raw.split(':').map(Number);
          if (parts.length === 3) return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
          if (parts.length === 2) return Math.round(parts[0] + parts[1] / 60);
        }
        const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
        return isNaN(num) || num <= 0 ? 60 : Math.round(num);
      };

      // Helper to check if a line is a system/footer noise line
      const isNoiseLine = (line: string): boolean => {
        const lower = line.toLowerCase();
        return (
          lower.includes('page ') ||
          lower.includes('zoom video communications') ||
          lower.includes('meeting report') ||
          lower.includes('user center') ||
          lower.includes('reports > usage') ||
          lower.includes('total participants:') ||
          lower.includes('host id:') ||
          lower.startsWith('report generated') ||
          (lower.includes('name (original') && lower.includes('email'))
        );
      };

      // Helper to clean extracted participant name
      const cleanParticipantName = (raw: string): string => {
        return raw
          .replace(/^[0-9]+[\.\)\-\:\s]+/, '') // remove leading row index "1.", "2)", "01:"
          .replace(/\b(yes|no|guest|host|registered|user|attendee|in-meeting|waiting room)\b/gi, ' ')
          .replace(/[()|,:;[\]]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      // PASS 1: If a structured table header was found in CSV/TSV
      if (participantHeaderIndex !== -1 && nameIdx !== -1) {
        for (let i = participantHeaderIndex + 1; i < rawLines.length; i++) {
          const line = rawLines[i];
          if (isNoiseLine(line)) continue;

          const cols = parseCSVLine(line);
          if (!cols || cols.length === 0) continue;

          const rawName = cleanParticipantName(cols[nameIdx] || '');
          const rawEmail = emailIdx !== -1 ? (cols[emailIdx] || '').trim().toLowerCase() : '';
          const durRaw = durationIdx !== -1 ? (cols[durationIdx] || '') : '';
          const joinTime = joinTimeIdx !== -1 ? (cols[joinTimeIdx] || '') : '';
          const leaveTime = leaveTimeIdx !== -1 ? (cols[leaveTimeIdx] || '') : '';

          if (!rawName && !rawEmail) continue;
          if (rawName.toLowerCase().includes('name (original') || rawName.toLowerCase() === 'user email') continue;

          // Date extraction fallback
          if (!detectedDate && (joinTime || leaveTime)) {
            const dFound = extractDateFromString(joinTime) || extractDateFromString(leaveTime);
            if (dFound) detectedDate = dFound;
          }

          rawRows.push({
            name: rawName || (rawEmail ? rawEmail.split('@')[0] : 'Participant'),
            email: rawEmail.includes('@') ? rawEmail : '',
            duration: parseDurationValue(durRaw),
            joinTime,
            leaveTime
          });
        }
      }

      // PASS 2: Multi-line & Multi-Email Freeform Segmentation (Crucial for PDF and unstructured reports)
      if (rawRows.length <= 1) {
        const emailGlobalRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
        const allEmails = Array.from(cleanText.matchAll(emailGlobalRegex));

        if (allEmails.length > 1) {
          // Document has multiple distinct email addresses! Segment between email markers.
          for (let eIdx = 0; eIdx < allEmails.length; eIdx++) {
            const currentMatch = allEmails[eIdx];
            const email = currentMatch[0].toLowerCase();
            const emailPos = currentMatch.index || 0;

            // Region before this email (contains the Name)
            const prevEmailEnd = eIdx > 0 ? (allEmails[eIdx - 1].index || 0) + allEmails[eIdx - 1][0].length : 0;
            const textBefore = cleanText.substring(prevEmailEnd, emailPos);

            // Region after this email (contains Duration, Timestamps)
            const nextEmailStart = eIdx < allEmails.length - 1 ? (allEmails[eIdx + 1].index || cleanText.length) : cleanText.length;
            const textAfter = cleanText.substring(emailPos + email.length, nextEmailStart);

            // Extract Name from textBefore: take last non-empty line or meaningful word tokens
            const beforeLines = textBefore.split(/\r\n|\n|\r/).map(l => l.trim()).filter(l => l.length > 0 && !isNoiseLine(l));
            let rawName = beforeLines.length > 0 ? beforeLines[beforeLines.length - 1] : '';

            // Clean noise tokens from Name (like timestamps or leftover durations from previous row)
            rawName = rawName
              .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/g, '')
              .replace(/\b\d{1,3}\s*(?:mins?|minutes?|min)?\b/gi, '')
              .replace(/^[0-9]+[\.\)\-\:\s]+/, '')
              .trim();

            if (!rawName || rawName.length < 2) {
              rawName = email.split('@')[0].replace(/[._-]/g, ' ');
            }

            // Extract Duration from textAfter
            let durMins = 60;
            const durMatch = textAfter.match(/\b(\d{1,3})\s*(?:mins?|minutes?|min)?\b/i);
            if (durMatch) {
              const parsed = parseInt(durMatch[1], 10);
              if (!isNaN(parsed) && parsed > 0 && parsed <= 600) {
                durMins = parsed;
              }
            }

            // Extract Join/Leave Times
            const timeMatches = Array.from(textAfter.matchAll(/\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\b/g)).map(m => m[1]);
            const joinTime = timeMatches[0] || '';
            const leaveTime = timeMatches[1] || '';

            if (!detectedDate && (joinTime || textAfter)) {
              const dFound = extractDateFromString(textAfter);
              if (dFound) detectedDate = dFound;
            }

            rawRows.push({
              name: cleanParticipantName(rawName),
              email,
              duration: durMins,
              joinTime,
              leaveTime
            });
          }
        }
      }

      // PASS 3: Line-by-line regex scanning (handles numbered lists, line-per-participant files)
      if (rawRows.length === 0) {
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
        const timeRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\b/g;
        const durationRegex = /\b(\d{1,3})\s*(?:mins?|minutes?|min)?\b/i;

        for (let i = 0; i < rawLines.length; i++) {
          const line = rawLines[i];
          if (isNoiseLine(line)) continue;
          if (line.toLowerCase().includes('name') && line.toLowerCase().includes('email')) continue;

          const emailMatch = line.match(emailRegex);
          const email = emailMatch ? emailMatch[1].toLowerCase() : '';

          const timeMatches = Array.from(line.matchAll(timeRegex)).map(m => m[1]);
          const joinTime = timeMatches[0] || '';
          const leaveTime = timeMatches[1] || '';

          if (!detectedDate && joinTime) {
            const dFound = extractDateFromString(line);
            if (dFound) detectedDate = dFound;
          }

          let durMins = 60;
          const durMatch = line.match(durationRegex);
          if (durMatch && !line.includes(durMatch[0] + ':')) {
            durMins = parseInt(durMatch[1], 10) || 60;
          }

          let cleanLine = line;
          if (email) cleanLine = cleanLine.replace(email, ' ');
          timeMatches.forEach(t => { cleanLine = cleanLine.replace(t, ' '); });
          cleanLine = cleanLine
            .replace(/\b\d{1,3}\s*(?:mins?|minutes?|min)\b/gi, ' ')
            .replace(/\b(yes|no|guest|host|registered|user|attendee)\b/gi, ' ')
            .replace(/[()|,:;[\]]/g, ' ')
            .replace(/^[0-9]+[\.\)\-\:\s]+/, '')
            .trim();

          if (cleanLine.length >= 2 || email) {
            const name = cleanLine.length >= 2 ? cleanLine : email.split('@')[0];
            rawRows.push({
              name: cleanParticipantName(name),
              email,
              duration: durMins,
              joinTime,
              leaveTime
            });
          }
        }
      }

      if (rawRows.length === 0) {
        throw new Error('No participant rows could be extracted. Please ensure the PDF or CSV contains participant names.');
      }

      // Auto-set meeting title and date if detected
      if (detectedTopic && detectedTopic.length > 2) {
        setMeetingTitle(detectedTopic);
      }
      if (detectedDate) {
        setMeetingDate(detectedDate);
      } else {
        setMeetingDate(getTodayDateString());
      }

      // Merge duplicate participant reconnections
      const mergedMap = new Map<string, { name: string; email: string; duration: number; joinTime?: string; leaveTime?: string }>();

      rawRows.forEach(r => {
        const key = r.email ? r.email : r.name.toLowerCase().trim();
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key)!;
          existing.duration += r.duration;
          if (!existing.joinTime && r.joinTime) existing.joinTime = r.joinTime;
          if (r.leaveTime) existing.leaveTime = r.leaveTime;
        } else {
          mergedMap.set(key, { ...r });
        }
      });

      // Helper to clean prefixes/titles (Pastor, Sister, Brother, Deacon, etc.) for robust matching
      const cleanTitlePrefix = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/^(pastor|pst|sister|sis|brother|bro|deacon|deaconess|dr|elder|minister|apostle|rev|evang|prophet)\.?\s+/i, '')
          .trim();
      };

      // Match with registered members
      const processed: ParsedParticipantRow[] = [];
      let index = 0;
      mergedMap.forEach(item => {
        index++;
        let matched: UserProfile | null = null;
        const cleanName = item.name.toLowerCase().trim();
        const strippedName = cleanTitlePrefix(item.name);

        // 1. Match by Email
        if (item.email) {
          matched = members.find(m => m.email?.toLowerCase().trim() === item.email) || null;
        }

        // 2. Match by Exact or Stripped Display Name
        if (!matched && item.name) {
          matched = members.find(m => {
            const mName = (m.displayName || (m as any).name || '').toLowerCase().trim();
            if (!mName) return false;
            if (mName === cleanName) return true;
            if (strippedName.length > 2 && cleanTitlePrefix(mName) === strippedName) return true;
            return false;
          }) || null;
        }

        // 3. Match by Substring or Email handle
        if (!matched && item.name) {
          matched = members.find(m => {
            const mName = (m.displayName || (m as any).name || '').toLowerCase().trim();
            const mEmail = (m.email || '').toLowerCase().trim();
            if (mName && mName.length > 3 && (mName.includes(strippedName) || strippedName.includes(mName))) return true;
            if (mEmail && strippedName.length > 3 && mEmail.includes(strippedName)) return true;
            return false;
          }) || null;
        }

        processed.push({
          id: `row-${index}-${Date.now()}`,
          name: item.name,
          email: item.email || (matched ? matched.email : ''),
          durationMinutes: item.duration,
          joinTime: item.joinTime,
          leaveTime: item.leaveTime,
          matchedMember: matched,
          whatsappCommunity: matched ? getMemberWhatsAppCommunity(matched) : '',
          status: matched ? 'matched' : 'guest'
        });
      });

      setParsedRows(processed);
      setSyncSuccessMsg(`✅ Successfully processed ${processed.length} participants from ${sourceName} (Date: ${detectedDate || getTodayDateString()}). Click "Sync Attendance to Database" below to credit attendance.`);
    } catch (err: any) {
      console.error('Error parsing report content:', err);
      setSyncErrorMsg(`Report Error: ${err?.message || 'Could not parse attendance file. Please check format.'}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawFileName(file.name);
    setIsParsing(true);
    setSyncErrorMsg('');

    try {
      const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

      if (isPDF) {
        // Read ArrayBuffer for PDF.js
        const arrayBuffer = await file.arrayBuffer();
        const extractedText = await extractTextFromPDF(arrayBuffer);
        parseReportContent(extractedText, `PDF file "${file.name}"`);
      } else {
        // Standard text/CSV read
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (text) {
            parseReportContent(text, `CSV file "${file.name}"`);
          }
        };
        reader.readAsText(file);
      }
    } catch (fileErr: any) {
      console.error('File load error:', fileErr);
      setSyncErrorMsg(`Could not read file: ${fileErr?.message || 'Unknown error'}`);
      setIsParsing(false);
    }
  };

  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      setSyncErrorMsg('Please paste the attendance text into the box first.');
      return;
    }
    setRawFileName('Pasted Report Text');
    parseReportContent(pastedText, 'pasted text');
  };

  const handleDownloadSampleCSV = () => {
    const sampleContent = `Name (Original Name),User Email,Total Duration (Minutes),Join Time,Leave Time
"Pastor Osaro Aghedo","pastor@lightupprayer.org",90,"06:00 AM","07:30 AM"
"Sister Grace Oladipo","grace.oladipo@example.com",60,"06:15 AM","07:15 AM"
"Brother Emmanuel K.","emmanuel@example.com",75,"06:00 AM","07:15 AM"
"Deaconess Mary Johnson","maryj@example.com",60,"06:30 AM","07:30 AM"
"Guest Visitor London","",45,"06:10 AM","06:55 AM"`;

    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LightUp_Zoom_Attendance_Sample_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRowDurationChange = (rowId: string, minutes: number) => {
    setParsedRows(prev => prev.map(r => r.id === rowId ? { ...r, durationMinutes: Math.max(1, minutes) } : r));
  };

  const handleRowNameChange = (rowId: string, newName: string) => {
    setParsedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const cleanName = newName.toLowerCase().trim();
      const matched = members.find(m => (m.displayName || (m as any).name || '').toLowerCase().trim() === cleanName) || null;
      return {
        ...r,
        name: newName,
        matchedMember: matched,
        status: matched ? 'matched' : 'guest'
      };
    }));
  };

  const handleRowEmailChange = (rowId: string, newEmail: string) => {
    setParsedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const cleanEmail = newEmail.toLowerCase().trim();
      const matched = members.find(m => (m.email || '').toLowerCase().trim() === cleanEmail) || r.matchedMember;
      return {
        ...r,
        email: newEmail,
        matchedMember: matched,
        status: matched ? 'matched' : 'guest'
      };
    }));
  };

  const handleAddParticipantRow = () => {
    const newId = `manual-row-${Date.now()}`;
    const newRow: ParsedParticipantRow = {
      id: newId,
      name: 'New Participant',
      email: '',
      durationMinutes: 60,
      matchedMember: null,
      status: 'guest'
    };
    setParsedRows(prev => [newRow, ...prev]);
  };

  const handleRemoveRow = (rowId: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== rowId));
  };

  // Sync to Database
  const handleCommitSync = async () => {
    if (parsedRows.length === 0) {
      setSyncErrorMsg('No parsed rows to sync.');
      return;
    }
    setIsSyncing(true);
    setSyncSuccessMsg('');
    setSyncErrorMsg('');

    try {
      const totalSessionMinutes = parsedRows.reduce((acc, r) => acc + r.durationMinutes, 0);
      const isToday = meetingDate === getTodayDateString();
      const currentYearStr = new Date().getFullYear().toString();
      const isThisYear = meetingDate.startsWith(currentYearStr);

      // 1. Create Zoom Session Document
      const sessionDocRef = await addDoc(collection(db, 'zoom_sessions'), {
        title: meetingTitle.trim(),
        meetingDate: meetingDate,
        totalParticipants: parsedRows.length,
        totalMinutes: totalSessionMinutes,
        source: 'csv_import',
        notes: meetingNotes.trim(),
        createdAt: serverTimestamp()
      });

      const sessionId = sessionDocRef.id;

      // 2. Commit Individual Participant Logs and Member/Guest Record Updates
      const batch = writeBatch(db);
      let batchCount = 0;

      for (const row of parsedRows) {
        // Participant log
        const logDocRef = doc(collection(db, 'zoom_participant_logs'));
        batch.set(logDocRef, {
          sessionId: sessionId,
          sessionTitle: meetingTitle.trim(),
          name: row.name,
          email: row.email || '',
          durationMinutes: row.durationMinutes,
          joinTime: row.joinTime || '',
          leaveTime: row.leaveTime || '',
          date: meetingDate,
          isMember: !!row.matchedMember,
          memberUid: row.matchedMember?.uid || '',
          whatsappCommunity: row.whatsappCommunity || (row.matchedMember ? getMemberWhatsAppCommunity(row.matchedMember) : ''),
          status: row.matchedMember ? 'synced' : 'guest',
          createdAt: serverTimestamp()
        });
        batchCount++;

        // If matched registered member, update member's overall attendance stats
        if (row.matchedMember) {
          const mem = row.matchedMember;
          const targetUid = mem.uid || (mem as any).id;
          
          if (targetUid) {
            const userRef = doc(db, 'users', targetUid);
            
            const currentTotal = mem.totalMinutes || 0;
            const currentToday = mem.todayMinutes || 0;
            const currentYear = mem.thisYearMinutes || mem.thisWeekMinutes || 0;
            const currentDaysList = Array.isArray(mem.attendanceDaysList) ? [...mem.attendanceDaysList] : [];
            
            const hasAttendedDate = currentDaysList.includes(meetingDate);
            if (!hasAttendedDate) {
              currentDaysList.push(meetingDate);
            }

            const existingDailyMap: Record<string, number> = mem.dailyMinutes || {};
            const updatedDailyMap = {
              ...existingDailyMap,
              [meetingDate]: (existingDailyMap[meetingDate] || 0) + row.durationMinutes
            };

            const updatedFields: any = {
              totalMinutes: currentTotal + row.durationMinutes,
              lastAttendedDate: meetingDate,
              dailyMinutes: updatedDailyMap,
              attendanceDaysList: currentDaysList,
              attendanceCount: currentDaysList.length,
              lastActiveAt: serverTimestamp()
            };

            if (isToday) {
              updatedFields.todayMinutes = currentToday + row.durationMinutes;
            }
            if (isThisYear) {
              updatedFields.thisYearMinutes = currentYear + row.durationMinutes;
            }

            batch.update(userRef, updatedFields);
            batchCount++;
          }
        } else {
          // Record as Guest in guest_attendance collection
          const guestRef = doc(collection(db, 'guest_attendance'));
          batch.set(guestRef, {
            guestId: `zoom-guest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            guestName: row.name,
            guestEmail: row.email || '',
            dateStr: meetingDate,
            lastDateStr: meetingDate,
            totalMinutes: row.durationMinutes,
            totalSeconds: row.durationMinutes * 60,
            todayMinutes: isToday ? row.durationMinutes : 0,
            todaySeconds: isToday ? row.durationMinutes * 60 : 0,
            yearlyMinutes: isThisYear ? row.durationMinutes : 0,
            yearlySeconds: isThisYear ? row.durationMinutes * 60 : 0,
            deviceInfo: 'Zoom Attendance CSV Import',
            meetingType: meetingTitle.trim(),
            status: 'completed',
            createdAt: serverTimestamp(),
            lastActiveAt: serverTimestamp()
          });
          batchCount++;
        }

        // Firestore batch max is 500 operations
        if (batchCount >= 450) {
          await batch.commit();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      const todayBadge = isToday ? "Today's Attendance" : `Session Date: ${meetingDate}`;
      setSyncSuccessMsg(`🎉 Success! Recorded attendance for ${parsedRows.length} participants (${totalSessionMinutes} total prayer minutes credited for ${todayBadge}) into the database!`);
      setParsedRows([]);
      setRawFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onRefreshMembers) onRefreshMembers();
      setTimeout(() => setSyncSuccessMsg(''), 8000);
    } catch (err: any) {
      console.error('Error committing sync to Firestore:', err);
      setSyncErrorMsg(`Sync failed: ${err?.message || 'Could not write to database. Please check your internet connection.'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual single participant log
  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      setSyncErrorMsg('Please enter a participant name.');
      return;
    }
    setManualSaving(true);
    setSyncSuccessMsg('');
    setSyncErrorMsg('');

    try {
      const isToday = manualDate === getTodayDateString();
      const currentYearStr = new Date().getFullYear().toString();
      const isThisYear = manualDate.startsWith(currentYearStr);

      // Match member
      let matchedMember: UserProfile | null = null;
      if (manualEmail) {
        matchedMember = members.find(m => m.email?.toLowerCase() === manualEmail.trim().toLowerCase()) || null;
      }
      if (!matchedMember) {
        matchedMember = members.find(m => m.displayName?.toLowerCase().trim() === manualName.trim().toLowerCase()) || null;
      }

      // Save log
      await addDoc(collection(db, 'zoom_participant_logs'), {
        sessionTitle: manualMeetingTitle.trim(),
        name: manualName.trim(),
        email: manualEmail.trim(),
        durationMinutes: Number(manualMinutes),
        date: manualDate,
        isMember: !!matchedMember,
        memberUid: matchedMember?.uid || '',
        whatsappCommunity: manualCommunity || (matchedMember ? getMemberWhatsAppCommunity(matchedMember) : ''),
        status: matchedMember ? 'synced' : 'guest',
        source: 'manual_sync',
        createdAt: serverTimestamp()
      });

      // Update member if matched
      if (matchedMember) {
        const mem = matchedMember;
        const targetUid = mem.uid || (mem as any).id;
        const currentDaysList = Array.isArray(mem.attendanceDaysList) ? [...mem.attendanceDaysList] : [];
        if (!currentDaysList.includes(manualDate)) {
          currentDaysList.push(manualDate);
        }

        const existingDailyMap: Record<string, number> = mem.dailyMinutes || {};
        const updatedDailyMap = {
          ...existingDailyMap,
          [manualDate]: (existingDailyMap[manualDate] || 0) + Number(manualMinutes)
        };

        const updatedFields: any = {
          totalMinutes: (mem.totalMinutes || 0) + Number(manualMinutes),
          lastAttendedDate: manualDate,
          dailyMinutes: updatedDailyMap,
          attendanceDaysList: currentDaysList,
          attendanceCount: currentDaysList.length,
          lastActiveAt: serverTimestamp()
        };

        if (isToday) {
          updatedFields.todayMinutes = (mem.todayMinutes || 0) + Number(manualMinutes);
        }
        if (isThisYear) {
          updatedFields.thisYearMinutes = (mem.thisYearMinutes || mem.thisWeekMinutes || 0) + Number(manualMinutes);
        }

        if (targetUid) {
          await updateDoc(doc(db, 'users', targetUid), updatedFields);
        }
      } else {
        // Save to guest_attendance
        await addDoc(collection(db, 'guest_attendance'), {
          guestId: `manual-entry-${Date.now()}`,
          guestName: manualName.trim(),
          guestEmail: manualEmail.trim(),
          dateStr: manualDate,
          lastDateStr: manualDate,
          totalMinutes: Number(manualMinutes),
          totalSeconds: Number(manualMinutes) * 60,
          todayMinutes: isToday ? Number(manualMinutes) : 0,
          todaySeconds: isToday ? Number(manualMinutes) * 60 : 0,
          yearlyMinutes: isThisYear ? Number(manualMinutes) : 0,
          yearlySeconds: isThisYear ? Number(manualMinutes) * 60 : 0,
          deviceInfo: 'Manual Attendance Entry',
          meetingType: manualMeetingTitle.trim(),
          status: 'completed',
          createdAt: serverTimestamp(),
          lastActiveAt: serverTimestamp()
        });
      }

      setSyncSuccessMsg(`Recorded ${manualMinutes} minutes for "${manualName.trim()}" successfully!`);
      setManualName('');
      setManualEmail('');
      setManualMinutes(60);
      if (onRefreshMembers) onRefreshMembers();
      setTimeout(() => setSyncSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Error saving manual log:', err);
      setSyncErrorMsg(`Error: ${err?.message || 'Failed to save log'}`);
    } finally {
      setManualSaving(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this recorded Zoom session?')) return;
    try {
      await deleteDoc(doc(db, 'zoom_sessions', sessionId));
      if (selectedSession?.id === sessionId) setSelectedSession(null);
      setSyncSuccessMsg('Session record removed.');
      setTimeout(() => setSyncSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const handleExportSessionLogsCSV = (session: ZoomSessionItem, logs: ZoomParticipantLog[]) => {
    if (logs.length === 0) return;
    const headers = ['Participant Name', 'Email', 'WhatsApp Community', 'Duration (Mins)', 'Meeting Date', 'Meeting Title', 'Type', 'Join Time', 'Leave Time'];
    const rows = logs.map(l => [
      `"${l.name}"`,
      `"${l.email || ''}"`,
      `"${l.whatsappCommunity || (l.isMember ? 'Unassigned' : 'Guest / Visitor')}"`,
      `"${l.durationMinutes}"`,
      `"${l.date}"`,
      `"${l.sessionTitle || session.title}"`,
      `"${l.isMember ? 'Registered Member' : 'Guest / Visitor'}"`,
      `"${l.joinTime || ''}"`,
      `"${l.leaveTime || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LightUp_Zoom_Session_${session.meetingDate}_${session.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalParsedMinutes = parsedRows.reduce((acc, r) => acc + r.durationMinutes, 0);
  const matchedCount = parsedRows.filter(r => r.status === 'matched').length;
  const guestCount = parsedRows.filter(r => r.status === 'guest').length;

  const filteredParsedRows = parsedRows.filter(r => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">
      {/* Sub tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        <button
          onClick={() => setActiveSubTab('import')}
          className={cn(
            "flex items-center space-x-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            activeSubTab === 'import'
              ? "bg-[#F26522] text-white shadow-lg shadow-[#F26522]/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-100"
          )}
        >
          <Upload size={16} />
          <span>Zoom PDF / CSV Import & Auto-Sync</span>
        </button>

        <button
          onClick={() => setActiveSubTab('manual')}
          className={cn(
            "flex items-center space-x-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            activeSubTab === 'manual'
              ? "bg-[#F26522] text-white shadow-lg shadow-[#F26522]/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-100"
          )}
        >
          <Plus size={16} />
          <span>Quick Manual Logger</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={cn(
            "flex items-center space-x-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            activeSubTab === 'history'
              ? "bg-[#F26522] text-white shadow-lg shadow-[#F26522]/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-100"
          )}
        >
          <Clock size={16} />
          <span>Synced Sessions & History ({sessions.length})</span>
        </button>
      </div>

      {/* Notifications */}
      {syncSuccessMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-3 text-emerald-700 text-sm font-bold animate-in fade-in">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
          <span>{syncSuccessMsg}</span>
        </div>
      )}

      {syncErrorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center space-x-3 text-red-700 text-sm font-bold animate-in fade-in">
          <AlertTriangle size={20} className="shrink-0 text-red-600" />
          <span>{syncErrorMsg}</span>
        </div>
      )}

      {/* TAB 1: CSV / PDF IMPORT */}
      {activeSubTab === 'import' && (
        <div className="space-y-8">
          {/* Header instructions banner */}
          <div className="bg-gradient-to-r from-[#1A1F3C] to-[#282E5C] text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-[10px] font-black uppercase tracking-widest">
                  <Sparkles size={12} />
                  <span>Automated Zoom Attendance Recording (PDF & CSV Supported)</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black">Import & Synchronize Zoom Attendance Logs</h3>
                <p className="text-gray-300 text-xs sm:text-sm max-w-2xl">
                  Upload your attendance report in <strong>PDF format</strong>, official Zoom <strong>CSV export</strong>, or paste copied text from Zoom chat. The system will automatically extract participant names, emails, and prayer minutes, match registered members, and update the church database.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="px-2.5 py-1 bg-red-500/20 text-red-200 border border-red-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1">
                    <FileText size={11} />
                    <span>PDF Reports Supported</span>
                  </span>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1">
                    <FileSpreadsheet size={11} />
                    <span>CSV / Excel Supported</span>
                  </span>
                  <span className="px-2.5 py-1 bg-blue-500/20 text-blue-200 border border-blue-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1">
                    <ClipboardPaste size={11} />
                    <span>Direct Paste Supported</span>
                  </span>
                </div>
              </div>

              <button
                onClick={handleDownloadSampleCSV}
                className="flex items-center space-x-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 shrink-0 cursor-pointer self-start md:self-center"
              >
                <Download size={14} className="text-amber-400" />
                <span>Download Sample Template CSV</span>
              </button>
            </div>
          </div>

          {/* Configuration Form & Upload Zone */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Meeting Details */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h4 className="font-black text-[#1A1F3C] text-sm uppercase tracking-wider flex items-center space-x-2">
                <Calendar size={16} className="text-[#F26522]" />
                <span>1. Meeting Session Details</span>
              </h4>

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Prayer / Meeting Program</label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="e.g. Daily Morning Glory Prayer, Midnight Cry"
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-xs font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black uppercase text-gray-400">Session Date</label>
                  <button
                    type="button"
                    onClick={() => setMeetingDate(getTodayDateString())}
                    className="text-[10px] font-bold text-[#F26522] hover:underline cursor-pointer"
                  >
                    Set to Today
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-xs font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                  />
                  {meetingDate === getTodayDateString() && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md pointer-events-none">
                      Today
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {meetingDate === getTodayDateString() ? "Will be credited as Today's Attendance for all matched members & guests." : `Will be logged under date ${meetingDate}.`}
                </p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Optional Notes / Tag</label>
                <input
                  type="text"
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  placeholder="e.g. Week 4 Theme: Assignment of God"
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-xs font-medium border outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>
            </div>

            {/* Right: Drag & Drop Dropzone / Paste Area */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-center space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-[#1A1F3C] text-sm uppercase tracking-wider flex items-center space-x-2">
                  <FileSpreadsheet size={16} className="text-[#F26522]" />
                  <span>2. Upload PDF / CSV or Paste Text</span>
                </h4>

                <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setIsPasteMode(false)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                      !isPasteMode ? "bg-white text-[#1A1F3C] shadow-sm" : "text-gray-500 hover:text-gray-900"
                    )}
                  >
                    Upload File (PDF/CSV)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPasteMode(true)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center space-x-1",
                      isPasteMode ? "bg-white text-[#1A1F3C] shadow-sm" : "text-gray-500 hover:text-gray-900"
                    )}
                  >
                    <ClipboardPaste size={12} />
                    <span>Paste Text</span>
                  </button>
                </div>
              </div>

              {!isPasteMode ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-[#F26522] bg-gray-50/70 hover:bg-orange-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 group min-h-[220px]"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.csv,.txt,.tsv,.xlsx,text/csv,text/plain,application/pdf,application/vnd.ms-excel"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center text-[#F26522] group-hover:scale-110 transition-transform">
                    {isParsing ? (
                      <RefreshCw size={28} className="animate-spin text-[#F26522]" />
                    ) : (
                      <Upload size={28} />
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-black text-[#1A1F3C]">
                      {isParsing ? (
                        <span className="text-[#F26522] animate-pulse">Reading & extracting attendance data...</span>
                      ) : rawFileName ? (
                        <span className="text-[#F26522]">{rawFileName} (Click to change)</span>
                      ) : (
                        'Click to select or drag & drop Zoom PDF or CSV Report'
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      Supports Zoom PDF Reports, CSV Exports, Google Sheets, & Text files
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      rows={6}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder={`Paste attendance text copied from your PDF, Zoom chat, or WhatsApp here...\nExample:\nPastor Osaro Aghedo pastor@lightupprayer.org 90 mins\nSister Grace Oladipo grace@example.com 60 mins\nBrother Emmanuel 75 mins`}
                      className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-mono border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522]"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-400">
                      Copy the text from your Zoom PDF or chat and paste it directly.
                    </p>
                    <button
                      type="button"
                      onClick={handleProcessPastedText}
                      disabled={isParsing || !pastedText.trim()}
                      className="px-5 py-2.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
                    >
                      {isParsing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      <span>Process Pasted Report</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-6 p-6">
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Participants</p>
                  <p className="text-2xl font-black text-[#1A1F3C] mt-1">{parsedRows.length}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Matched Members</p>
                  <p className="text-2xl font-black text-emerald-700 mt-1">{matchedCount}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-purple-700">Guest Visitors</p>
                  <p className="text-2xl font-black text-purple-700 mt-1">{guestCount}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Total Prayer Time</p>
                  <p className="text-2xl font-black text-amber-700 mt-1">{totalParsedMinutes} mins</p>
                </div>
              </div>

              {/* Action bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="relative flex-1 max-w-sm">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search in parsed rows..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-xs font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddParticipantRow}
                    className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Participant</span>
                  </button>

                  {rawExtractedText && (
                    <button
                      type="button"
                      onClick={() => setShowRawTextPreview(!showRawTextPreview)}
                      className={cn(
                        "flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                        showRawTextPreview
                          ? "bg-[#1A1F3C] text-white border-[#1A1F3C]"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200"
                      )}
                    >
                      <Eye size={14} />
                      <span>{showRawTextPreview ? 'Hide Report Text' : 'View Extracted Text'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([]);
                      setRawFileName(null);
                      setRawExtractedText('');
                      setShowRawTextPreview(false);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Clear
                  </button>

                  <button
                    onClick={handleCommitSync}
                    disabled={isSyncing}
                    className="flex items-center space-x-2 px-6 py-3 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-[#F26522]/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Synchronizing Database...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Sync Attendance to Database ({parsedRows.length} Records)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Raw Extracted Text Viewer */}
              {showRawTextPreview && rawExtractedText && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-amber-400">
                      Raw Extracted Text from {rawFileName || 'Report'}
                    </span>
                    <button
                      type="button"
                      onClick={() => parseReportContent(rawExtractedText, 'edited extracted text')}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                    >
                      Re-parse Text
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={rawExtractedText}
                    onChange={(e) => setRawExtractedText(e.target.value)}
                    className="w-full p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl border border-slate-800 outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Tip: You can edit or paste extra attendees into this text box directly and click <strong>Re-parse Text</strong>.
                  </p>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      <th className="p-4">Participant Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">WhatsApp Community</th>
                      <th className="p-4">Classification</th>
                      <th className="p-4">Duration (Mins)</th>
                      <th className="p-4">Join / Leave Time</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredParsedRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/50">
                        <td className="p-4 font-bold text-[#1A1F3C]">
                          <div className="flex items-center space-x-2">
                            <span className="w-8 h-8 rounded-full bg-[#1A1F3C] text-white text-xs font-black flex items-center justify-center shrink-0">
                              {row.name.charAt(0).toUpperCase() || 'P'}
                            </span>
                            <div className="flex-1 min-w-[180px]">
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => handleRowNameChange(row.id, e.target.value)}
                                className="w-full font-black text-xs px-2 py-1 bg-transparent hover:bg-gray-100 focus:bg-white focus:ring-1 focus:ring-[#F26522] rounded-lg outline-none transition-colors border border-transparent hover:border-gray-200"
                                placeholder="Attendee Name"
                              />
                              {row.matchedMember && (
                                <p className="text-[10px] text-emerald-600 font-bold px-2 mt-0.5">
                                  Matched: {row.matchedMember.displayName || row.matchedMember.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs text-gray-500 min-w-[180px]">
                          <input
                            type="email"
                            value={row.email}
                            onChange={(e) => handleRowEmailChange(row.id, e.target.value)}
                            placeholder="user@example.com (optional)"
                            className="w-full px-2 py-1 bg-transparent hover:bg-gray-100 focus:bg-white focus:ring-1 focus:ring-[#F26522] rounded-lg outline-none transition-colors border border-transparent hover:border-gray-200 text-xs font-mono"
                          />
                        </td>
                        <td className="p-4">
                          {row.matchedMember ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-200">
                              <MessageCircle size={11} className="text-emerald-600 shrink-0" />
                              <span>{getMemberWhatsAppCommunity(row.matchedMember)}</span>
                            </span>
                          ) : (
                            <select
                              value={row.whatsappCommunity || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, whatsappCommunity: val } : r));
                              }}
                              className="text-[10px] font-bold px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 outline-none cursor-pointer"
                            >
                              <option value="">(Assign WhatsApp Community)</option>
                              {dynamicCommunityOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="p-4">
                          {row.status === 'matched' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-full">
                              <CheckCircle2 size={12} />
                              <span>Registered Member</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-100 text-purple-800 text-[10px] font-black uppercase rounded-full">
                              <Users size={12} />
                              <span>Guest / Visitor</span>
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            min="1"
                            max="720"
                            value={row.durationMinutes}
                            onChange={(e) => handleRowDurationChange(row.id, parseInt(e.target.value) || 1)}
                            className="w-20 px-2 py-1 bg-gray-50 border rounded-lg text-xs font-mono font-bold text-[#1A1F3C] text-center"
                          />
                        </td>
                        <td className="p-4 text-xs font-mono text-gray-400">
                          {row.joinTime || row.leaveTime ? (
                            <span>{row.joinTime || '—'} to {row.leaveTime || '—'}</span>
                          ) : (
                            <span>Session Duration</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove from batch"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL QUICK LOGGER */}
      {activeSubTab === 'manual' && (
        <div className="max-w-2xl bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="space-y-2 border-b border-gray-100 pb-4">
            <h3 className="text-xl font-black text-[#1A1F3C] uppercase tracking-wide flex items-center space-x-2">
              <Plus size={20} className="text-[#F26522]" />
              <span>Direct Participant Logger</span>
            </h3>
            <p className="text-gray-500 text-xs font-medium">
              Quickly record individual attendee prayer time during or after a live Zoom prayer session.
            </p>
          </div>

          <form onSubmit={handleSaveManualEntry} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase text-gray-400 mb-1">Meeting / Prayer Session Title *</label>
              <input
                type="text"
                required
                value={manualMeetingTitle}
                onChange={(e) => setManualMeetingTitle(e.target.value)}
                placeholder="e.g. Daily Morning Glory Prayer, Midnight Cry"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Participant Name *</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Sister Grace Oladipo"
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="e.g. grace@example.com"
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">WhatsApp Community</label>
                <select
                  value={manualCommunity}
                  onChange={(e) => setManualCommunity(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522] cursor-pointer"
                >
                  <option value="">Auto-detect / Unassigned</option>
                  {dynamicCommunityOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Prayer Time (Minutes) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="720"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={manualSaving}
                className="px-6 py-3.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-[#F26522]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {manualSaving ? 'Recording Log...' : 'Record Participant Attendance'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: SYNC HISTORY & SESSIONS */}
      {activeSubTab === 'history' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-[#1A1F3C] uppercase">Synchronized Zoom Sessions</h3>
              <p className="text-gray-400 text-xs font-medium">History of all imported and synchronized Zoom prayer meetings</p>
            </div>
          </div>

          {loadingSessions ? (
            <div className="p-16 bg-white rounded-3xl border border-gray-100 text-center space-y-3 text-gray-400">
              <RefreshCw size={32} className="animate-spin mx-auto text-[#F26522]" />
              <p className="font-bold text-sm">Loading session history...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-16 bg-white rounded-3xl border border-gray-100 text-center space-y-3">
              <Video size={48} className="mx-auto text-gray-300" />
              <h4 className="font-black text-[#1A1F3C] text-lg">No Zoom Sessions Recorded Yet</h4>
              <p className="text-gray-400 text-xs max-w-sm mx-auto">
                Use the CSV Import tab to import your first Zoom meeting attendance report.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map(session => (
                <div 
                  key={session.id}
                  className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                        {session.meetingDate}
                      </span>
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="text-gray-300 hover:text-red-500 p-1 transition-colors cursor-pointer"
                        title="Delete session"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <h4 className="font-black text-base text-[#1A1F3C]">{session.title}</h4>
                    {session.notes && (
                      <p className="text-xs text-gray-400 italic">{session.notes}</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex justify-between text-xs font-bold text-gray-500">
                      <span>Participants: <strong className="text-[#1A1F3C]">{session.totalParticipants}</strong></span>
                      <span>Total Time: <strong className="text-[#F26522]">{session.totalMinutes} mins</strong></span>
                    </div>

                    <button
                      onClick={() => setSelectedSession(session)}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 bg-[#1A1F3C] hover:bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <Eye size={14} />
                      <span>View Attendees & Export</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Session Attendees Detail Modal */}
          {selectedSession && (
            <div 
              onClick={() => setSelectedSession(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full space-y-6 shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col"
              >
                <div className="flex justify-between items-center border-b border-gray-100 pb-4 shrink-0">
                  <div>
                    <span className="text-[10px] font-black text-[#F26522] uppercase tracking-widest">{selectedSession.meetingDate}</span>
                    <h3 className="text-xl font-black text-[#1A1F3C]">{selectedSession.title}</h3>
                  </div>
                  <button 
                    onClick={() => setSelectedSession(null)}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-[#1A1F3C] cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex items-center justify-between shrink-0">
                  <p className="text-xs font-bold text-gray-500">
                    Showing {sessionLogs.length} participant logs ({selectedSession.totalMinutes} total minutes)
                  </p>
                  <button
                    onClick={() => handleExportSessionLogsCSV(selectedSession, sessionLogs)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1A1F3C] hover:bg-[#F26522] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Download size={12} />
                    <span>Export CSV</span>
                  </button>
                </div>

                <div className="overflow-y-auto flex-grow">
                  {loadingLogs ? (
                    <div className="p-12 text-center text-gray-400">
                      <RefreshCw size={24} className="animate-spin mx-auto text-[#F26522] mb-2" />
                      <p className="text-xs font-bold">Loading participant logs...</p>
                    </div>
                  ) : sessionLogs.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                      <p className="text-xs">No detailed logs found for this session.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                          <th className="p-3">Attendee</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">WhatsApp Community</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {sessionLogs.map(log => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="p-3 font-bold text-[#1A1F3C]">{log.name}</td>
                            <td className="p-3 font-mono text-gray-500">{log.email || '—'}</td>
                            <td className="p-3">
                              {log.whatsappCommunity ? (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <MessageCircle size={10} className="shrink-0" />
                                  <span>{log.whatsappCommunity}</span>
                                </span>
                              ) : (
                                <span className="text-gray-400 text-[10px] italic">Unassigned</span>
                              )}
                            </td>
                            <td className="p-3">
                              {log.isMember ? (
                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Member</span>
                              ) : (
                                <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">Guest</span>
                              )}
                            </td>
                            <td className="p-3 font-mono font-bold text-[#F26522]">{log.durationMinutes} mins</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
