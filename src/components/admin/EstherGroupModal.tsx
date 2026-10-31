import React, { useState, useMemo } from 'react';
import { 
  X, Search, Phone, MessageCircle, CheckCircle2, 
  Download, Copy, Users, RefreshCw, Sparkles, Check, ClipboardCheck
} from 'lucide-react';
import { ESTHER_GROUP_MEMBERS, EstherGroupMemberRecord } from '../../data/estherGroupMembers';
import { UserProfile } from '../../types';
import { doc, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface EstherGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: UserProfile[];
  onFilterByEsther: () => void;
  onOpenAttendanceReport?: () => void;
}

export default function EstherGroupModal({
  isOpen,
  onClose,
  members,
  onFilterByEsther,
  onOpenAttendanceReport
}: EstherGroupModalProps) {
  const [search, setSearch] = useState('');
  const [copiedNumbers, setCopiedNumbers] = useState(false);
  const [copiedPhoneSn, setCopiedPhoneSn] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const cleanDigits = (val: string) => (val || '').replace(/\D/g, '');

  const handleCopySinglePhone = (sn: number, phone: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(phone);
      } else {
        const el = document.createElement('textarea');
        el.value = phone;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedPhoneSn(sn);
      setTimeout(() => {
        setCopiedPhoneSn(prev => (prev === sn ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy single phone:', err);
    }
  };

  const formatForWhatsApp = (phoneStr: string) => {
    let digits = (phoneStr || '').replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 11) {
      digits = '234' + digits.substring(1);
    }
    return digits;
  };

  // Map existing members for fast lookup
  const registeredPhoneSet = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => {
      if (m.phone) set.add(cleanDigits(m.phone));
      if (m.whatsappGroup && cleanDigits(m.whatsappGroup).length >= 7) set.add(cleanDigits(m.whatsappGroup));
    });
    return set;
  }, [members]);

  const registeredNameSet = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => {
      if (m.displayName) set.add(m.displayName.toLowerCase().trim());
    });
    return set;
  }, [members]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ESTHER_GROUP_MEMBERS;
    const q = search.toLowerCase().trim();
    return ESTHER_GROUP_MEMBERS.filter(m => 
      m.displayName.toLowerCase().includes(q) || 
      m.phone.includes(q) || 
      (m.email && m.email.toLowerCase().includes(q))
    );
  }, [search]);

  if (!isOpen) return null;

  const handleCopyAllPhones = () => {
    const allPhones = ESTHER_GROUP_MEMBERS.map(m => m.phone).filter(Boolean).join(', ');
    navigator.clipboard.writeText(allPhones);
    setCopiedNumbers(true);
    setTimeout(() => setCopiedNumbers(false), 3000);
  };

  const handleExportCSV = () => {
    const headers = ['S/N', 'Member Full Name', 'Phone Number', 'WhatsApp Community', 'Email'];
    const rows = ESTHER_GROUP_MEMBERS.map(m => [
      `"${m.sn}"`,
      `"${m.displayName}"`,
      `"${m.phone}"`,
      `"${m.whatsappCommunity}"`,
      `"${m.email || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Esther_Group_Members_Roster_122.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncToFirestore = async () => {
    setIsSyncing(true);
    setSyncStatus('Synchronizing all 122 members to Firestore...');
    try {
      const batch = writeBatch(db);
      let count = 0;

      for (const m of ESTHER_GROUP_MEMBERS) {
        const phoneDigits = cleanDigits(m.phone);
        const nameClean = m.displayName.toLowerCase().trim();

        const existing = members.find(u => {
          if (m.email && u.email && u.email.toLowerCase().trim() === m.email.toLowerCase().trim()) return true;
          if (phoneDigits && u.phone && cleanDigits(u.phone) === phoneDigits) return true;
          if (u.displayName && u.displayName.toLowerCase().trim() === nameClean) return true;
          return false;
        });

        if (existing) {
          const userRef = doc(db, 'users', existing.uid);
          batch.update(userRef, {
            whatsappCommunity: "Esther’s Group (Benin)",
            whatsappGroupName: "Esther’s Group (Benin)",
            phone: existing.phone || m.phone,
            lastActiveAt: new Date().toISOString()
          });
        } else {
          const newDocRef = doc(collection(db, 'users'));
          batch.set(newDocRef, {
            uid: newDocRef.id,
            displayName: m.displayName,
            phone: m.phone,
            email: m.email || '',
            role: 'member',
            whatsappCommunity: "Esther’s Group (Benin)",
            whatsappGroupName: "Esther’s Group (Benin)",
            whatsappGroup: m.phone,
            attendanceCount: 0,
            attendanceDaysList: [],
            todayMinutes: 0,
            thisYearMinutes: 0,
            totalMinutes: 0,
            lastAttendedDate: null,
            joinedAt: new Date().toISOString(),
            joinedWhatsappGroup: true,
            registeredVia: 'esther_group_roster',
            status: 'active',
            lastActiveAt: new Date().toISOString()
          });
        }
        count++;
      }

      await batch.commit();
      setSyncStatus(`Successfully synchronized all ${count} Esther Group members!`);
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      console.error('Error syncing Esther Group members:', err);
      setSyncStatus(`Sync error: ${err?.message || 'Check connection'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="bg-[#1A1F3C] text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F26522] flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-[#F26522]/30">
              <Users size={24} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-black text-white">Esther Group Members Roster</h3>
                <span className="px-2.5 py-0.5 bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider rounded-full">
                  122 Members
                </span>
              </div>
              <p className="text-gray-300 text-xs mt-0.5">
                Official Roster: Esther’s Group (Benin) • 122 Verified Members
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-center">
            <button
              onClick={() => {
                onFilterByEsther();
                onClose();
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              Filter in Table
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-gray-300 hover:text-white transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search member name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-medium rounded-xl border border-gray-200 focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] outline-none bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyAllPhones}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-gray-100 text-[#1A1F3C] rounded-xl text-xs font-bold border border-gray-200 transition-all cursor-pointer"
              title="Copy all phone numbers for WhatsApp group broadcast"
            >
              {copiedNumbers ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedNumbers ? 'Copied 122 Phones!' : 'Copy All Phones'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-gray-100 text-[#1A1F3C] rounded-xl text-xs font-bold border border-gray-200 transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleSyncToFirestore}
              disabled={isSyncing}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
              <span>{isSyncing ? 'Syncing...' : 'Sync to Firestore'}</span>
            </button>

            {onOpenAttendanceReport && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAttendanceReport();
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-800 to-indigo-900 hover:from-purple-900 hover:to-indigo-950 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                title="View Esther Group Daily Attendance Report (Present & Absent)"
              >
                <ClipboardCheck size={14} className="text-amber-300" />
                <span>Attendance Report</span>
              </button>
            )}
          </div>
        </div>

        {/* Sync notification message */}
        {syncStatus && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{syncStatus}</span>
          </div>
        )}

        {/* Members List Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 z-10">
              <tr>
                <th className="p-3 text-center w-12">S/N</th>
                <th className="p-3">Member Full Name</th>
                <th className="p-3">Phone Number</th>
                <th className="p-3">Community Group</th>
                <th className="p-3">Database State</th>
                <th className="p-3 text-right">Quick Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filtered.map((m) => {
                const phoneDigits = cleanDigits(m.phone);
                const waDigits = formatForWhatsApp(m.phone);
                
                return (
                  <tr key={m.sn} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-center font-bold text-gray-400">
                      {m.sn}
                    </td>
                    <td className="p-3 font-black text-[#1A1F3C]">
                      <div>
                        <span>{m.displayName}</span>
                        {m.email && (
                          <span className="block text-[10px] font-mono text-gray-400 font-normal">
                            {m.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-mono font-bold text-gray-700">
                      <div className="inline-flex items-center space-x-1.5 bg-gray-50 hover:bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200/80 transition-colors">
                        <Phone size={12} className="text-emerald-600 shrink-0" />
                        <span className="text-xs">{m.phone}</span>
                        <button
                          type="button"
                          onClick={() => handleCopySinglePhone(m.sn, m.phone)}
                          className={`p-1 rounded-md transition-all cursor-pointer ${
                            copiedPhoneSn === m.sn 
                              ? 'bg-emerald-500 text-white' 
                              : 'text-gray-400 hover:text-gray-700 hover:bg-white'
                          }`}
                          title="Copy phone number"
                        >
                          {copiedPhoneSn === m.sn ? <Check size={11} className="stroke-[3]" /> : <Copy size={11} />}
                        </button>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 rounded-full font-bold text-[10px] border border-amber-200">
                        {m.whatsappCommunity}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold text-[11px]">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span>Registered</span>
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {waDigits.length >= 7 && (
                        <a
                          href={`https://wa.me/${waDigits}?text=${encodeURIComponent(`Praise God ${m.displayName}, welcome to Esther’s Group (Benin) in Light Up Prayer House!`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#25D366]/15 hover:bg-[#25D366] text-[#128C7E] hover:text-white rounded-lg text-[10px] font-black transition-all"
                          title="Message on WhatsApp"
                        >
                          <MessageCircle size={11} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <p className="font-medium">
            Showing <strong className="text-[#1A1F3C]">{filtered.length}</strong> of {ESTHER_GROUP_MEMBERS.length} members
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
