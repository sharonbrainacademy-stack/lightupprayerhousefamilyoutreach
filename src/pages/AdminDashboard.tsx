/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Users, Calendar, Video, Heart, MessageSquare, 
  Settings, LayoutDashboard, Search, Plus, 
  Download, ShieldCheck, Check, X, AlertTriangle, 
  RefreshCw, Mail, Phone, Globe, ArrowLeft,
  Crown, Play, FileText, CheckCircle2, ShieldAlert,
  Flame, Clock, Edit3, Trash2, BookOpen, MapPin, Maximize2,
  MessageCircle, Share2, Copy, Link as LinkIcon, ExternalLink, Save,
  Smartphone, Wifi, Send, Zap, Image as ImageIcon, Upload, Palette, Sparkles,
  UserPlus, FileSpreadsheet, HandHeart, Eye, EyeOff, ImagePlus,
  Key, Lock, ClipboardCheck, UserCheck, HeartHandshake, XCircle,
  CopyX, GitMerge, Layers, AlertCircle, CheckCheck
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, setDoc, addDoc, deleteDoc, serverTimestamp, getDocs, writeBatch, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { useAuth, SUPER_ADMIN_EMAILS } from '../lib/auth';
import { useSiteBranding, updateSiteBranding } from '../lib/settings';
import { db } from '../lib/firebase';
import { getTodayDateString } from '../lib/attendance';
import { UserProfile, WeeklyTheme, ProgramItem } from '../types';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { isProgramExpired } from '../lib/programs';
import { 
  getWhatsAppConfig, 
  updateWhatsAppConfig, 
  getRecentWhatsAppJoins, 
  WhatsAppJoinRecord, 
  WhatsAppConfig, 
  DEFAULT_WHATSAPP_GROUPS, 
  generateWhatsAppShareUrl,
  getMemberWhatsAppCommunity,
  WHATSAPP_COMMUNITY_OPTIONS
} from '../lib/whatsapp';
import { useZoomSession } from '../lib/ZoomContext';
import { motion, AnimatePresence } from 'motion/react';
import ZoomAttendanceSync from '../components/ZoomAttendanceSync';
import DailyAttendanceReport from '../components/admin/DailyAttendanceReport';
import ManualAttendanceModal from '../components/admin/ManualAttendanceModal';
import FlyerModal, { FlyerModalData } from '../components/FlyerModal';
import AdminOutreachTab from '../components/admin/AdminOutreachTab';
import AdminStaffManagementTab from '../components/admin/AdminStaffManagementTab';
import AdminBooksTab from '../components/admin/AdminBooksTab';
import EstherGroupModal from '../components/admin/EstherGroupModal';
import { 
  SermonItem, 
  DEFAULT_SERMONS, 
  subscribeSermons, 
  addSermon, 
  updateSermon, 
  deleteSermon 
} from '../lib/media';
import {
  OutreachProject,
  DEFAULT_OUTREACH_PROJECTS,
  subscribeOutreach,
  addOutreachProject,
  updateOutreachProject,
  deleteOutreachProject,
  StoryPicture,
  DEFAULT_STORY_PICTURES,
  subscribeStoryPictures,
  addStoryPicture,
  updateStoryPicture,
  deleteStoryPicture
} from '../lib/outreach';
import { 
  compressImageFile, 
  getThemeFlyerUrl, 
  getProgramFlyerUrl, 
  sanitizeImageUrl, 
  isImageDataUrlSafeForFirestore 
} from '../lib/image-utils';

type AdminTab = 'overview' | 'members' | 'attendance-reports' | 'zoom-sync' | 'guests' | 'whatsapp' | 'themes' | 'programs' | 'books' | 'media' | 'outreach' | 'moderation' | 'admins' | 'branding';

interface GuestAttendanceRecord {
  id: string;
  guestId: string;
  guestName?: string;
  guestPhone?: string;
  lastDateStr?: string;
  dateStr?: string;
  joinedAt?: any;
  lastActiveAt?: any;
  deviceInfo?: string;
  todaySeconds?: number;
  todayMinutes?: number;
  yearlySeconds?: number;
  yearlyMinutes?: number;
  totalSeconds?: number;
  totalMinutes?: number;
  status?: 'active' | 'completed';
  meetingType?: string;
  isZoomActive?: boolean;
}

interface TestimonyItem {
  id: string;
  name: string;
  category: string;
  text: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt?: any;
}

const DEFAULT_PROGRAMS: ProgramItem[] = [];

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

export default function AdminDashboard() {
  const { profile, login, loginWithPasscode, user, logout, authError, isLoggingIn, clearAuthError } = useAuth();
  const { isGlobalMeetingLive, activeParticipantsCount, endGlobalLiveMeeting, startGlobalLiveMeeting } = useZoomSession();
  const [activeTab, setActiveTab] = useState<AdminTab>('members');
  const [attendanceReportTargetDate, setAttendanceReportTargetDate] = useState<string | undefined>(undefined);
  const [attendanceReportInitialSubTab, setAttendanceReportInitialSubTab] = useState<'reports' | 'followup'>('reports');
  const [loginMode, setLoginMode] = useState<'passcode' | 'google'>('passcode');
  const [passcodeEmail, setPasscodeEmail] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [showPasscodeText, setShowPasscodeText] = useState(false);
  const [passcodeSubmitting, setPasscodeSubmitting] = useState(false);
  const [passcodeLocalError, setPasscodeLocalError] = useState<string | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [testimonies, setTestimonies] = useState<TestimonyItem[]>([]);
  const [guestRecords, setGuestRecords] = useState<GuestAttendanceRecord[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(true);
  const [guestSearchQuery, setGuestSearchQuery] = useState('');
  const [guestStatusFilter, setGuestStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [guestDateFilter, setGuestDateFilter] = useState<'all' | 'today' | 'year'>('all');
  const [themes, setThemes] = useState<WeeklyTheme[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [communityFilter, setCommunityFilter] = useState<string>('all');
  const [activatingAdmin, setActivatingAdmin] = useState(false);
  const [showLiveRosterModal, setShowLiveRosterModal] = useState(false);
  const [showEstherGroupModal, setShowEstherGroupModal] = useState(false);
  const [showManualAttendanceModal, setShowManualAttendanceModal] = useState(false);
  const [manualAttendanceSelectedMember, setManualAttendanceSelectedMember] = useState<UserProfile | null>(null);
  const [liveTick, setLiveTick] = useState(Date.now());
  const [memberFeedback, setMemberFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedMemberUids, setSelectedMemberUids] = useState<string[]>([]);
  const [togglingMemberUid, setTogglingMemberUid] = useState<string | null>(null);
  const [deletingMemberUid, setDeletingMemberUid] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<UserProfile | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Automatic Duplicate Detection & Resolution States
  const [showDuplicateResolutionModal, setShowDuplicateResolutionModal] = useState(false);
  const [showDeleteAllDuplicatesModal, setShowDeleteAllDuplicatesModal] = useState(false);
  const [duplicateSelectedPrimaryMap, setDuplicateSelectedPrimaryMap] = useState<Record<string, string>>({});
  const [duplicateClusterFilter, setDuplicateClusterFilter] = useState<'all' | 'exact_email' | 'phone' | 'name'>('all');
  const [duplicateActionLoading, setDuplicateActionLoading] = useState<string | null>(null);

  // Super Admin helper check
  const isUserSuperAdmin = (u?: UserProfile | null, email?: string | null) => {
    if (!u && !email) return false;
    if (u?.role === 'super_admin') return true;
    const userEmail = (u?.email || email || '').toLowerCase().trim();
    return Boolean(userEmail && SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail));
  };

  const isSuperAdmin = isUserSuperAdmin(profile, user?.email);

  // If a non-super admin has activeTab set to 'admins', redirect to 'members'
  useEffect(() => {
    if (!isSuperAdmin && activeTab === 'admins') {
      setActiveTab('members');
    }
  }, [isSuperAdmin, activeTab]);

  // Real-time tick every 5 seconds so live Zoom counts and presence badges refresh automatically
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTick(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Theme Form State
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [themeTitle, setThemeTitle] = useState('');
  const [themeScripture, setThemeScripture] = useState('');
  const [themeMinister, setThemeMinister] = useState('Pastor Osaro Aghedo & other Anointed Ministers of God');
  const [themeDates, setThemeDates] = useState('');
  const [themeImageUrl, setThemeImageUrl] = useState('/theme_assignment.jpg');
  const [themePrayerPoints, setThemePrayerPoints] = useState('');
  const [themeIsCurrent, setThemeIsCurrent] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeSuccessMsg, setThemeSuccessMsg] = useState('');
  const [themeErrorMsg, setThemeErrorMsg] = useState('');

  const handleThemeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 1200, 1200, 0.82);
      setThemeImageUrl(compressed);
    } catch (err) {
      console.warn('Error compressing theme flyer:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setThemeImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Program Form State
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [programTitle, setProgramTitle] = useState('');
  const [programSeries, setProgramSeries] = useState('Back to Eden');
  const [programTheme, setProgramTheme] = useState('');
  const [programDate, setProgramDate] = useState('');
  const [programTime, setProgramTime] = useState('');
  const [programLocation, setProgramLocation] = useState('');
  const [programImageUrl, setProgramImageUrl] = useState('/flyer_lagos.jpg');
  const [programVideoUrl, setProgramVideoUrl] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [programAlwaysVisible, setProgramAlwaysVisible] = useState(true);
  const [savingProgram, setSavingProgram] = useState(false);
  const [uploadingProgramFlyer, setUploadingProgramFlyer] = useState(false);
  const [programModalError, setProgramModalError] = useState<string | null>(null);
  const [programFeedback, setProgramFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [clearingExpired, setClearingExpired] = useState(false);
  const [adminProgramFilter, setAdminProgramFilter] = useState<'all' | 'upcoming' | 'expired'>('all');
  const [programToDelete, setProgramToDelete] = useState<ProgramItem | null>(null);
  const [showClearExpiredModal, setShowClearExpiredModal] = useState(false);
  const [selectedFlyerModal, setSelectedFlyerModal] = useState<FlyerModalData | null>(null);

  const handleProgramImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProgramFlyer(true);
    setProgramModalError(null);

    try {
      const compressed = await compressImageFile(file, 1000, 1000, 0.78);
      if (!isImageDataUrlSafeForFirestore(compressed)) {
        setProgramModalError('Image is too large. Please select a photo under 5MB.');
        return;
      }
      setProgramImageUrl(compressed);
    } catch (err: any) {
      console.warn('Error compressing program flyer:', err);
      setProgramModalError(err?.message || 'Could not process selected image. Please try a different photo.');
    } finally {
      setUploadingProgramFlyer(false);
      e.target.value = '';
    }
  };

  // Sermons & Media Form State
  const [sermonsList, setSermonsList] = useState<SermonItem[]>([]);
  const [loadingSermons, setLoadingSermons] = useState(true);
  const [showSermonModal, setShowSermonModal] = useState(false);
  const [editingSermonId, setEditingSermonId] = useState<string | null>(null);
  const [sermonTitle, setSermonTitle] = useState('');
  const [sermonMinister, setSermonMinister] = useState('Pastor Osaro Aghedo');
  const [sermonDate, setSermonDate] = useState('');
  const [sermonType, setSermonType] = useState<'video' | 'audio'>('video');
  const [sermonThumbnailUrl, setSermonThumbnailUrl] = useState('https://images.unsplash.com/photo-1490161705155-d28c4210e9c1?auto=format&fit=crop&q=80');
  const [sermonMediaUrl, setSermonMediaUrl] = useState('');
  const [sermonDescription, setSermonDescription] = useState('');
  const [sermonScripture, setSermonScripture] = useState('');
  const [sermonDuration, setSermonDuration] = useState('');
  const [savingSermon, setSavingSermon] = useState(false);
  const [sermonSuccessMsg, setSermonSuccessMsg] = useState('');
  const [sermonErrorMsg, setSermonErrorMsg] = useState('');

  const handleSermonThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 900, 700, 0.78);
      if (!isImageDataUrlSafeForFirestore(compressed)) {
        setSermonErrorMsg('Image is too large. Please select a photo under 3MB.');
        return;
      }
      setSermonThumbnailUrl(compressed);
    } catch (err: any) {
      console.warn('Error compressing sermon thumbnail:', err);
      setSermonErrorMsg(err?.message || 'Could not process image.');
    } finally {
      e.target.value = '';
    }
  };

  // Outreach & NGO Form State
  const [outreachList, setOutreachList] = useState<OutreachProject[]>([]);
  const [loadingOutreach, setLoadingOutreach] = useState(true);
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [editingOutreachId, setEditingOutreachId] = useState<string | null>(null);
  const [outreachTitle, setOutreachTitle] = useState('');
  const [outreachCategory, setOutreachCategory] = useState('Hunger Relief');
  const [outreachLocation, setOutreachLocation] = useState('Lagos, Nigeria');
  const [outreachDate, setOutreachDate] = useState('');
  const [outreachImage, setOutreachImage] = useState('https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80');
  const [outreachVideoUrl, setOutreachVideoUrl] = useState('');
  const [outreachRaised, setOutreachRaised] = useState('0');
  const [outreachGoal, setOutreachGoal] = useState('5000');
  const [outreachDescription, setOutreachDescription] = useState('');
  const [outreachBeneficiaries, setOutreachBeneficiaries] = useState('');
  const [outreachStatus, setOutreachStatus] = useState<'active' | 'completed' | 'upcoming'>('active');
  const [savingOutreach, setSavingOutreach] = useState(false);
  const [outreachSuccessMsg, setOutreachSuccessMsg] = useState('');
  const [outreachErrorMsg, setOutreachErrorMsg] = useState('');

  const handleOutreachImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 900, 700, 0.78);
      if (!isImageDataUrlSafeForFirestore(compressed)) {
        setOutreachErrorMsg('Image is too large. Please select a photo under 3MB.');
        return;
      }
      setOutreachImage(compressed);
    } catch (err: any) {
      console.warn('Error compressing outreach image:', err);
      setOutreachErrorMsg(err?.message || 'Could not process image.');
    } finally {
      e.target.value = '';
    }
  };

  // Outreach Sub-tabs & Story Pictures State
  const [outreachSubTab, setOutreachSubTab] = useState<'projects' | 'home_story'>('projects');
  const [storyPicturesList, setStoryPicturesList] = useState<StoryPicture[]>([]);
  const [loadingStoryPics, setLoadingStoryPics] = useState(true);
  const [showStoryPicModal, setShowStoryPicModal] = useState(false);
  const [editingStoryPicId, setEditingStoryPicId] = useState<string | null>(null);
  const [storyPicTitle, setStoryPicTitle] = useState('');
  const [storyPicCaption, setStoryPicCaption] = useState('');
  const [storyPicLocation, setStoryPicLocation] = useState('Lagos, Nigeria');
  const [storyPicDate, setStoryPicDate] = useState('August 2026');
  const [storyPicCategory, setStoryPicCategory] = useState('Hunger Relief');
  const [storyPicImageUrl, setStoryPicImageUrl] = useState('');
  const [storyPicShowOnHome, setStoryPicShowOnHome] = useState(true);
  const [storyPicOrder, setStoryPicOrder] = useState<number>(0);
  const [savingStoryPic, setSavingStoryPic] = useState(false);
  const [storyPicSuccessMsg, setStoryPicSuccessMsg] = useState('');
  const [storyPicErrorMsg, setStoryPicErrorMsg] = useState('');

  // Admin Staff Management State (Super Admin adds & manages admins)
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminMode, setNewAdminMode] = useState<'select_member' | 'email'>('select_member');
  const [selectedMemberForAdmin, setSelectedMemberForAdmin] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin_assistant' | 'super_admin'>('admin_assistant');
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Seeding refs to prevent re-seeding after explicit user deletion
  const hasSeededThemes = useRef(false);
  const hasSeededPrograms = useRef(false);

  // WhatsApp Tracking & Settings State
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig>({
    mainGroupUrl: DEFAULT_WHATSAPP_GROUPS.global.url,
    regionalGroups: {
      esther_benin: DEFAULT_WHATSAPP_GROUPS.esther_benin.url,
      king_david_lagos: DEFAULT_WHATSAPP_GROUPS.king_david_lagos.url,
      joyful_abuja: DEFAULT_WHATSAPP_GROUPS.joyful_abuja.url,
      grace_asaba: DEFAULT_WHATSAPP_GROUPS.grace_asaba.url,
      global: DEFAULT_WHATSAPP_GROUPS.global.url
    },
    totalClicks: 0
  });
  const [whatsappJoinsList, setWhatsappJoinsList] = useState<WhatsAppJoinRecord[]>([]);
  const [whatsappEstherBeninUrl, setWhatsappEstherBeninUrl] = useState('');
  const [whatsappKingDavidLagosUrl, setWhatsappKingDavidLagosUrl] = useState('');
  const [whatsappJoyfulAbujaUrl, setWhatsappJoyfulAbujaUrl] = useState('');
  const [whatsappGraceAsabaUrl, setWhatsappGraceAsabaUrl] = useState('');
  const [whatsappGlobalUrl, setWhatsappGlobalUrl] = useState('');
  const [savingWhatsappConfig, setSavingWhatsappConfig] = useState(false);
  const [whatsappSavedMessage, setWhatsappSavedMessage] = useState('');

  // Site Branding & Logo State
  const siteBranding = useSiteBranding();
  const [logoInput, setLogoInput] = useState('');
  const [siteNameInput, setSiteNameInput] = useState('');
  const [taglineInput, setTaglineInput] = useState('');
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingSavedMsg, setBrandingSavedMsg] = useState('');

  useEffect(() => {
    if (siteBranding) {
      setLogoInput(siteBranding.logoUrl || '/logo.jpg');
      setSiteNameInput(siteBranding.siteName || 'LIGHT UP PRAYER HOUSE');
      setTaglineInput(siteBranding.tagline || 'Family Outreach');
    }
  }, [siteBranding]);

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 400, 400, 0.82);
      if (!isImageDataUrlSafeForFirestore(compressed)) {
        alert('Logo image is too large. Please choose an image under 2MB.');
        return;
      }
      setLogoInput(compressed);
    } catch (err: any) {
      console.warn('Error compressing logo image:', err);
      alert(err?.message || 'Could not process logo image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoInput.trim()) {
      alert('Logo URL cannot be empty.');
      return;
    }
    setSavingBranding(true);
    setBrandingSavedMsg('');
    try {
      await updateSiteBranding({
        logoUrl: logoInput,
        siteName: siteNameInput,
        tagline: taglineInput,
      });
      setBrandingSavedMsg('Logo and site branding updated successfully across all pages!');
      setTimeout(() => setBrandingSavedMsg(''), 5000);
    } catch (err) {
      console.error('Error saving site branding:', err);
      alert('Failed to save logo and branding. Please try again.');
    } finally {
      setSavingBranding(false);
    }
  };


  useEffect(() => {
    getWhatsAppConfig().then(cfg => {
      setWhatsappConfig(cfg);
      setWhatsappEstherBeninUrl(cfg.regionalGroups?.esther_benin || cfg.regionalGroups?.west_africa || DEFAULT_WHATSAPP_GROUPS.esther_benin.url);
      setWhatsappKingDavidLagosUrl(cfg.regionalGroups?.king_david_lagos || DEFAULT_WHATSAPP_GROUPS.king_david_lagos.url);
      setWhatsappJoyfulAbujaUrl(cfg.regionalGroups?.joyful_abuja || DEFAULT_WHATSAPP_GROUPS.joyful_abuja.url);
      setWhatsappGraceAsabaUrl(cfg.regionalGroups?.grace_asaba || cfg.regionalGroups?.europe_uk || DEFAULT_WHATSAPP_GROUPS.grace_asaba.url);
      setWhatsappGlobalUrl(cfg.regionalGroups?.global || DEFAULT_WHATSAPP_GROUPS.global.url);
    });

    getRecentWhatsAppJoins(50).then(joins => {
      setWhatsappJoinsList(joins);
    });
  }, [activeTab]);

  const handleSaveWhatsappUrls = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWhatsappConfig(true);
    setWhatsappSavedMessage('');
    try {
      await updateWhatsAppConfig({
        mainGroupUrl: whatsappGlobalUrl,
        regionalGroups: {
          esther_benin: whatsappEstherBeninUrl,
          king_david_lagos: whatsappKingDavidLagosUrl,
          joyful_abuja: whatsappJoyfulAbujaUrl,
          grace_asaba: whatsappGraceAsabaUrl,
          global: whatsappGlobalUrl
        }
      });
      setWhatsappSavedMessage('WhatsApp Group Links updated successfully!');
      setTimeout(() => setWhatsappSavedMessage(''), 4000);
    } catch (err) {
      console.error('Error saving WhatsApp configuration:', err);
      handleFirestoreError(err, OperationType.WRITE, 'settings/whatsapp_config');
    } finally {
      setSavingWhatsappConfig(false);
    }
  };

  // Fetch live members from Firestore
  useEffect(() => {
    let unsubscribe: () => void;
    if (user) {
      setLoadingMembers(true);
      unsubscribe = onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          const memberList: UserProfile[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as UserProfile;
            const email = (data.email || '').toLowerCase().trim();
            // Automatically purge deprecated removed accounts
            if (email === 'imosesstephen@gmail.com' || email === 'imosesstephen@gmail.come') {
              try {
                deleteDoc(doc(db, 'users', docSnap.id)).catch(() => {});
              } catch (e) {
                // ignore
              }
              return;
            }
            memberList.push({ uid: docSnap.id, ...data });
          });
          setMembers(memberList);
          setLoadingMembers(false);
        },
        (error) => {
          console.error('Error fetching members:', error);
          setLoadingMembers(false);
        }
      );
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Fetch live testimonies from Firestore
  useEffect(() => {
    let unsubscribe: () => void;
    if (user) {
      unsubscribe = onSnapshot(
        collection(db, 'testimonies'),
        (snapshot) => {
          const list: TestimonyItem[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as TestimonyItem);
          });
          setTestimonies(list);
        },
        (err) => {
          console.error('Error fetching testimonies:', err);
        }
      );
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Fetch live guest attendance records from Firestore with automatic deduplication
  useEffect(() => {
    let unsubscribe: () => void;
    if (user) {
      setLoadingGuests(true);
      unsubscribe = onSnapshot(
        collection(db, 'guest_attendance'),
        (snapshot) => {
          const rawList: GuestAttendanceRecord[] = [];
          snapshot.forEach((docSnap) => {
            rawList.push({ id: docSnap.id, ...docSnap.data() } as GuestAttendanceRecord);
          });

          // Deduplicate and group by unique visitor identity (Phone, Name, or Guest ID)
          const mapByVisitor = new Map<string, GuestAttendanceRecord>();
          const todayDate = getTodayDateString();
          const nowMs = Date.now();
          const threeHoursMs = 3 * 60 * 60 * 1000;

          for (const item of rawList) {
            const cleanPhone = (item.guestPhone || '').replace(/\D/g, '');
            const cleanName = (item.guestName || '').trim().toLowerCase();
            
            let visitorKey = item.id;
            if (cleanPhone.length >= 7) {
              visitorKey = `phone_${cleanPhone}`;
            } else if (cleanName && cleanName !== 'anonymous guest' && cleanName !== 'guest' && cleanName.length > 2) {
              visitorKey = `name_${cleanName.replace(/[^a-z0-9]/g, '_')}`;
            } else if (item.guestId) {
              visitorKey = item.guestId;
            } else {
              visitorKey = item.id || `guest_${Math.random().toString(36).substring(2, 8)}`;
            }

            const itemDate = item.lastDateStr || item.dateStr || '';
            const itemLastActiveMs = item.lastActiveAt?.seconds ? item.lastActiveAt.seconds * 1000 : 0;
            const isToday = itemDate === todayDate;
            const isWithin3Hours = itemLastActiveMs > 0 ? (nowMs - itemLastActiveMs <= threeHoursMs) : isToday;

            // Daily seconds: wiped to 0 if not today or >3h
            const rawTodaySecs = (isToday && isWithin3Hours) 
              ? (item.todaySeconds !== undefined ? item.todaySeconds : (item.totalSeconds || 0))
              : 0;

            // Yearly/Cumulative seconds: never wiped
            const rawYearlySecs = item.yearlySeconds || item.totalSeconds || (item.totalMinutes ? item.totalMinutes * 60 : 0);

            const existing = mapByVisitor.get(visitorKey);
            if (!existing) {
              mapByVisitor.set(visitorKey, {
                ...item,
                id: item.id || visitorKey,
                guestId: visitorKey,
                dateStr: itemDate || todayDate,
                lastDateStr: itemDate || todayDate,
                todaySeconds: rawTodaySecs,
                todayMinutes: Math.floor(rawTodaySecs / 60),
                yearlySeconds: rawYearlySecs,
                yearlyMinutes: Math.floor(rawYearlySecs / 60),
                totalSeconds: rawYearlySecs,
                totalMinutes: Math.floor(rawYearlySecs / 60),
              });
            } else {
              // Merge multiple records for this same visitor into a single profile
              const mergedTodaySecs = Math.max(existing.todaySeconds || 0, rawTodaySecs);
              const mergedYearlySecs = Math.max(existing.yearlySeconds || 0, rawYearlySecs);
              const latestTime = (item.lastActiveAt?.seconds || 0) > (existing.lastActiveAt?.seconds || 0)
                ? item.lastActiveAt
                : existing.lastActiveAt;

              const status = (existing.status === 'active' || item.status === 'active') ? 'active' : 'completed';
              const bestName = (item.guestName && item.guestName !== 'Anonymous Guest') ? item.guestName : existing.guestName;
              const bestPhone = item.guestPhone || existing.guestPhone;

              mapByVisitor.set(visitorKey, {
                ...existing,
                guestName: bestName,
                guestPhone: bestPhone,
                todaySeconds: mergedTodaySecs,
                todayMinutes: Math.floor(mergedTodaySecs / 60),
                yearlySeconds: mergedYearlySecs,
                yearlyMinutes: Math.floor(mergedYearlySecs / 60),
                totalSeconds: mergedYearlySecs,
                totalMinutes: Math.floor(mergedYearlySecs / 60),
                lastActiveAt: latestTime,
                dateStr: itemDate || existing.dateStr,
                lastDateStr: itemDate || existing.lastDateStr,
                status,
              });
            }
          }

          const list = Array.from(mapByVisitor.values());
          list.sort((a, b) => {
            const timeA = a.lastActiveAt?.seconds || (a.joinedAt?.seconds || 0);
            const timeB = b.lastActiveAt?.seconds || (b.joinedAt?.seconds || 0);
            return timeB - timeA;
          });
          setGuestRecords(list);
          setLoadingGuests(false);
        },
        (err) => {
          console.error('Error fetching guest attendance:', err);
          setLoadingGuests(false);
        }
      );
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Fetch live themes from Firestore
  useEffect(() => {
    let unsubscribe: () => void;
    if (user) {
      unsubscribe = onSnapshot(
        collection(db, 'themes'),
        (snapshot) => {
          const list: WeeklyTheme[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as WeeklyTheme);
          });
          if (list.length > 0) {
            setThemes(list);
          } else if (!hasSeededThemes.current) {
            // Seed default themes only if none exist in Firestore and hasn't been seeded yet
            seedDefaultThemes();
          } else {
            setThemes([]);
          }
        },
        (err) => {
          console.error('Error fetching themes:', err);
          setThemes(DEFAULT_THEMES);
        }
      );
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const seedDefaultThemes = async () => {
    if (hasSeededThemes.current) return;
    hasSeededThemes.current = true;
    try {
      for (const t of DEFAULT_THEMES) {
        const { id, ...dataToSeed } = t;
        await addDoc(collection(db, 'themes'), {
          ...dataToSeed,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error('Error seeding themes:', e);
    }
  };

  // Set active current theme
  const handleSetCurrentTheme = async (themeId: string) => {
    setThemeSuccessMsg('');
    setThemeErrorMsg('');
    // Optimistic UI update
    setThemes(prev => prev.map(t => ({ ...t, isCurrent: t.id === themeId })));
    try {
      const snapshot = await getDocs(collection(db, 'themes'));
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const shouldBeCurrent = docSnap.id === themeId;
        if (data.isCurrent !== shouldBeCurrent) {
          batch.update(docSnap.ref, { isCurrent: shouldBeCurrent });
        }
      });
      await batch.commit();
      setThemeSuccessMsg('Active website theme updated successfully!');
      setTimeout(() => setThemeSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error updating current theme:', err);
      // Fallback: update single doc
      try {
        await setDoc(doc(db, 'themes', themeId), { isCurrent: true }, { merge: true });
        setThemeSuccessMsg('Active website theme updated successfully!');
        setTimeout(() => setThemeSuccessMsg(''), 4000);
      } catch (fallbackErr) {
        console.error('Fallback update current theme failed:', fallbackErr);
        setThemeErrorMsg('Could not activate theme. Please verify internet connection.');
        setTimeout(() => setThemeErrorMsg(''), 5000);
      }
    }
  };

  // Save/Update Theme
  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeTitle.trim() || !themeScripture.trim() || !themeDates.trim()) {
      setThemeErrorMsg('Please fill out Theme Title, Scripture Focus, and Schedule Dates.');
      return;
    }

    const cleanThemeImage = sanitizeImageUrl(themeImageUrl.trim() || '/theme_assignment.jpg');
    if (cleanThemeImage.startsWith('data:') && cleanThemeImage.length > 480000) {
      setThemeErrorMsg('Theme flyer image is too large for database storage. Please select a photo under 2MB.');
      return;
    }

    setSavingTheme(true);
    setThemeSuccessMsg('');
    setThemeErrorMsg('');

    const pointsArray = themePrayerPoints
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const themePayload = {
      title: themeTitle.trim(),
      scripture: themeScripture.trim(),
      minister: themeMinister.trim() || 'Pastor Osaro Aghedo & other Anointed Ministers of God',
      dates: themeDates.trim(),
      imageUrl: cleanThemeImage,
      prayerPoints: pointsArray,
      isCurrent: Boolean(themeIsCurrent)
    };

    try {
      if (editingThemeId) {
        await setDoc(doc(db, 'themes', editingThemeId), {
          ...themePayload,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Optimistic state update
        setThemes(prev => prev.map(t => t.id === editingThemeId ? { ...t, ...themePayload, id: editingThemeId } : t));

        if (themeIsCurrent) {
          await handleSetCurrentTheme(editingThemeId);
        }
        setThemeSuccessMsg('Weekly theme updated successfully!');
      } else {
        const newDocRef = await addDoc(collection(db, 'themes'), {
          ...themePayload,
          createdAt: serverTimestamp()
        });

        const newThemeItem: WeeklyTheme = {
          id: newDocRef.id,
          ...themePayload
        };

        // Optimistic state update
        setThemes(prev => [newThemeItem, ...prev]);

        if (themeIsCurrent) {
          await handleSetCurrentTheme(newDocRef.id);
        }
        setThemeSuccessMsg('New weekly theme created and published successfully!');
      }

      resetThemeForm();
      setShowThemeModal(false);
      setTimeout(() => setThemeSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Error saving theme:', err);
      const errMsg = err?.message || 'Failed to save theme. Please check your internet connection.';
      setThemeErrorMsg(`Error: ${errMsg}`);
    } finally {
      setSavingTheme(false);
    }
  };

  const handleDeleteTheme = async (id: string) => {
    if (!confirm('Are you sure you want to delete this theme?')) return;
    try {
      setThemes(prev => prev.filter(t => t.id !== id));
      await deleteDoc(doc(db, 'themes', id));
      setThemeSuccessMsg('Theme deleted successfully.');
      setTimeout(() => setThemeSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error deleting theme:', err);
      handleFirestoreError(err, OperationType.DELETE, `themes/${id}`);
    }
  };

  const resetThemeForm = () => {
    setEditingThemeId(null);
    setThemeTitle('');
    setThemeScripture('');
    setThemeMinister('Pastor Osaro Aghedo & other Anointed Ministers of God');
    setThemeDates('');
    setThemeImageUrl('/theme_assignment.jpg');
    setThemePrayerPoints('');
    setThemeIsCurrent(false);
    setThemeErrorMsg('');
  };

  const openEditTheme = (theme: WeeklyTheme) => {
    setEditingThemeId(theme.id);
    setThemeTitle(theme.title);
    setThemeScripture(theme.scripture);
    setThemeMinister(theme.minister || 'Pastor Osaro Aghedo & other Anointed Ministers of God');
    setThemeDates(theme.dates || '');
    setThemeImageUrl(theme.imageUrl || '/theme_assignment.jpg');
    setThemePrayerPoints((theme.prayerPoints || []).join('\n'));
    setThemeIsCurrent(theme.isCurrent || false);
    setThemeErrorMsg('');
    setShowThemeModal(true);
  };

  // Fetch live programs from Firestore
  useEffect(() => {
    let unsubscribe: () => void;
    if (user) {
      unsubscribe = onSnapshot(
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
          setPrograms([]);
        }
      );
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setProgramModalError(null);

    const cleanTitle = programTitle.trim();
    const cleanDate = programDate.trim();

    if (!cleanTitle) {
      setProgramModalError('Please provide a Program Title / Edition (e.g. "Lagos Edition" or "September Revival Rally").');
      return;
    }
    if (!cleanDate) {
      setProgramModalError('Please specify the Program Date (e.g. "September 15, 2026" or "Sept 15 - 18, 2026").');
      return;
    }

    setSavingProgram(true);
    try {
      localStorage.setItem('lightup_programs_initialized', 'true');
      const rawImageUrl = (programImageUrl && programImageUrl.trim().length > 0) ? programImageUrl.trim() : '/flyer_lagos.jpg';
      const finalImageUrl = sanitizeImageUrl(rawImageUrl);

      if (finalImageUrl.startsWith('data:') && finalImageUrl.length > 480000) {
        setProgramModalError('Image is too large for database storage. Please select a photo under 2MB.');
        setSavingProgram(false);
        return;
      }

      const cleanSeries = programSeries.trim() || 'Back to Eden';
      const cleanTheme = programTheme.trim() || '';
      const cleanTime = programTime.trim() || '';
      const cleanLocation = programLocation.trim() || '';
      const cleanVideo = programVideoUrl.trim() || '';
      const cleanDesc = programDescription.trim() || '';

      if (editingProgramId) {
        await setDoc(doc(db, 'programs', editingProgramId), {
          title: cleanTitle,
          series: cleanSeries,
          theme: cleanTheme,
          date: cleanDate,
          time: cleanTime,
          location: cleanLocation,
          imageUrl: finalImageUrl,
          videoUrl: cleanVideo,
          description: cleanDesc,
          isAlwaysVisible: Boolean(programAlwaysVisible),
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Optimistically update local list
        setPrograms(prev => prev.map(p => p.id === editingProgramId ? {
          ...p,
          title: cleanTitle,
          series: cleanSeries,
          theme: cleanTheme,
          date: cleanDate,
          time: cleanTime,
          location: cleanLocation,
          imageUrl: finalImageUrl,
          videoUrl: cleanVideo,
          description: cleanDesc,
          isAlwaysVisible: Boolean(programAlwaysVisible),
        } : p));

        setProgramFeedback({ type: 'success', message: `Program "${cleanTitle}" updated! Flyer is now active on website.` });
      } else {
        const newDocRef = doc(collection(db, 'programs'));
        const newProgramData = {
          title: cleanTitle,
          series: cleanSeries,
          theme: cleanTheme,
          date: cleanDate,
          time: cleanTime,
          location: cleanLocation,
          imageUrl: finalImageUrl,
          videoUrl: cleanVideo,
          description: cleanDesc,
          isAlwaysVisible: Boolean(programAlwaysVisible),
          createdAt: serverTimestamp()
        };

        await setDoc(newDocRef, newProgramData);

        // Optimistically update local list
        setPrograms(prev => [{
          id: newDocRef.id,
          ...newProgramData,
          createdAt: new Date().toISOString()
        } as unknown as ProgramItem, ...prev]);

        setProgramFeedback({ type: 'success', message: `New program "${cleanTitle}" published! Flyer is live on website.` });
      }

      resetProgramForm();
      setShowProgramModal(false);
      setTimeout(() => setProgramFeedback(null), 5000);
    } catch (err: any) {
      console.error('Error saving program:', err);
      handleFirestoreError(err, OperationType.WRITE, 'programs');
      setProgramModalError(err?.message || 'Failed to save program to database. Please check your internet connection.');
      setProgramFeedback({ type: 'error', message: 'Failed to save program: ' + (err?.message || 'Database error') });
    } finally {
      setSavingProgram(false);
    }
  };

  // Trigger program deletion modal
  const promptDeleteProgram = (program: ProgramItem) => {
    setProgramToDelete(program);
  };

  // Perform actual deletion with thorough cleanup
  const executeDeleteProgram = async (programOrId: ProgramItem | string) => {
    const progId = typeof programOrId === 'string' ? programOrId : programOrId.id;
    const progTitle = typeof programOrId === 'string' 
      ? programs.find(p => p.id === programOrId)?.title || 'Program'
      : programOrId.title;

    setDeletingProgramId(progId);
    setProgramToDelete(null);

    // Optimistically update UI
    setPrograms(prev => prev.filter(p => p.id !== progId));

    try {
      // 1. Delete document by direct ID
      try {
        await deleteDoc(doc(db, 'programs', progId));
      } catch (directErr) {
        console.warn('Direct delete warning:', directErr);
      }

      // 2. Also check if ID had a prefix or raw number
      if (!progId.startsWith('prog-')) {
        try {
          await deleteDoc(doc(db, 'programs', `prog-${progId}`));
        } catch (e) {
          // ignore
        }
      }

      // 3. Query all documents in programs collection to delete any duplicate/seeded matches
      try {
        const snap = await getDocs(collection(db, 'programs'));
        const batch = writeBatch(db);
        let foundMatches = 0;

        snap.forEach((docItem) => {
          const data = docItem.data();
          if (
            docItem.id === progId || 
            docItem.id === `prog-${progId}` ||
            (data.title && data.title.toLowerCase().trim() === progTitle.toLowerCase().trim())
          ) {
            batch.delete(docItem.ref);
            foundMatches++;
          }
        });

        if (foundMatches > 0) {
          await batch.commit();
        }
      } catch (batchErr) {
        console.warn('Batch delete warning:', batchErr);
      }

      setProgramFeedback({ type: 'success', message: `Program "${progTitle}" deleted successfully from database!` });
      setTimeout(() => setProgramFeedback(null), 5000);
    } catch (err: any) {
      console.error('Error deleting program:', err);
      setProgramFeedback({ type: 'error', message: `Failed to delete "${progTitle}": ${err?.message || 'Database error'}` });
    } finally {
      setDeletingProgramId(null);
    }
  };

  const promptClearExpiredPrograms = () => {
    const expiredList = programs.filter(p => isProgramExpired(p.date));
    if (expiredList.length === 0) {
      setProgramFeedback({ type: 'error', message: 'No expired programs found.' });
      setTimeout(() => setProgramFeedback(null), 4000);
      return;
    }
    setShowClearExpiredModal(true);
  };

  const executeClearAllExpiredPrograms = async () => {
    const expiredList = programs.filter(p => isProgramExpired(p.date));
    if (expiredList.length === 0) {
      setShowClearExpiredModal(false);
      return;
    }

    setClearingExpired(true);
    setShowClearExpiredModal(false);

    // Optimistically update UI
    setPrograms(prev => prev.filter(p => !isProgramExpired(p.date)));

    try {
      const snap = await getDocs(collection(db, 'programs'));
      const batch = writeBatch(db);
      let count = 0;

      const expiredTitles = expiredList.map(e => e.title.toLowerCase().trim());
      const expiredIds = expiredList.map(e => e.id);

      snap.forEach((docItem) => {
        const data = docItem.data();
        const isTargetExpired = 
          expiredIds.includes(docItem.id) ||
          expiredIds.includes(docItem.id.replace('prog-', '')) ||
          (data.title && expiredTitles.includes(data.title.toLowerCase().trim())) ||
          isProgramExpired(data.date);

        if (isTargetExpired) {
          batch.delete(docItem.ref);
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
      }

      setPrograms(prev => prev.filter(p => !isProgramExpired(p.date)));
      setProgramFeedback({ type: 'success', message: `Successfully removed ${count || expiredList.length} past/expired program(s)!` });
      setTimeout(() => setProgramFeedback(null), 5000);
    } catch (err: any) {
      console.error('Error clearing expired programs:', err);
      setProgramFeedback({ type: 'error', message: `Failed to clear expired programs: ${err?.message || 'Database error'}` });
    } finally {
      setClearingExpired(false);
    }
  };

  const handleLoadSampleFlyers = async () => {
    try {
      setProgramFeedback({ type: 'success', message: 'Loading Back to Eden rally flyers...' });
      const sampleList: Omit<ProgramItem, 'id'>[] = [
        {
          title: "Lagos Edition",
          series: "Back to Eden",
          theme: "Restoration & Renewal",
          date: "August 8, 2026",
          time: "11:00 AM – 3:00 PM",
          location: "Abule Odo, Lagos",
          imageUrl: "/flyer_lagos.jpg",
          description: "Special revival service and prayer program in Abule Odo, Lagos."
        },
        {
          title: "Edo State Edition",
          series: "Back to Eden",
          theme: "Edo State for Christ",
          date: "August 13, 2026",
          time: "3:00 PM – 5:30 PM",
          location: "Airport Road, Benin City",
          imageUrl: "/flyer_edo.jpg",
          description: "Edo State apostolic revival rally."
        },
        {
          title: "Asaba Edition",
          series: "Back to Eden",
          theme: "Return. Restore. Reign.",
          date: "August 16, 2026",
          time: "4:00 PM Prompt",
          location: "Koka, Asaba",
          imageUrl: "/flyer_asaba.jpg",
          description: "Anointed gathering for deliverance, restoration, and kingdom reign."
        }
      ];

      for (let i = 0; i < sampleList.length; i++) {
        const item = sampleList[i];
        await setDoc(doc(db, 'programs', `prog-${i + 1}`), {
          ...item,
          createdAt: serverTimestamp()
        }, { merge: true });
      }

      setProgramFeedback({ type: 'success', message: 'Loaded Back to Eden rally flyers successfully!' });
      setTimeout(() => setProgramFeedback(null), 4000);
    } catch (e: any) {
      console.error('Error loading sample flyers:', e);
      setProgramFeedback({ type: 'error', message: 'Failed to load flyers: ' + (e?.message || 'Error') });
    }
  };

  const resetProgramForm = () => {
    setEditingProgramId(null);
    setProgramTitle('');
    setProgramSeries('Back to Eden');
    setProgramTheme('');
    setProgramDate('');
    setProgramTime('');
    setProgramLocation('');
    setProgramImageUrl('/flyer_lagos.jpg');
    setProgramVideoUrl('');
    setProgramDescription('');
    setProgramAlwaysVisible(true);
    setProgramModalError(null);
    setUploadingProgramFlyer(false);
  };

  const openEditProgram = (program: ProgramItem) => {
    setEditingProgramId(program.id);
    setProgramTitle(program.title || '');
    setProgramSeries(program.series || 'Back to Eden');
    setProgramTheme(program.theme || '');
    setProgramDate(program.date || '');
    setProgramTime(program.time || '');
    setProgramLocation(program.location || '');
    setProgramImageUrl(program.imageUrl || '/flyer_lagos.jpg');
    setProgramVideoUrl(program.videoUrl || '');
    setProgramDescription(program.description || '');
    setProgramAlwaysVisible(program.isAlwaysVisible !== false);
    setProgramModalError(null);
    setUploadingProgramFlyer(false);
    setShowProgramModal(true);
  };

  // Fetch live sermons from Firestore
  useEffect(() => {
    let unsubscribe: () => void;
    if (user) {
      setLoadingSermons(true);
      unsubscribe = subscribeSermons(
        (items) => {
          setSermonsList(items);
          setLoadingSermons(false);
        },
        (err) => {
          console.error('Error fetching sermons in admin:', err);
          setLoadingSermons(false);
        }
      );
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const resetSermonForm = () => {
    setEditingSermonId(null);
    setSermonTitle('');
    setSermonMinister('Pastor Osaro Aghedo');
    setSermonDate('');
    setSermonType('video');
    setSermonThumbnailUrl('https://images.unsplash.com/photo-1490161705155-d28c4210e9c1?auto=format&fit=crop&q=80');
    setSermonMediaUrl('');
    setSermonDescription('');
    setSermonScripture('');
    setSermonDuration('');
    setSermonErrorMsg('');
    setSermonSuccessMsg('');
  };

  const openNewSermonModal = () => {
    resetSermonForm();
    setShowSermonModal(true);
  };

  const openEditSermonModal = (sermon: SermonItem) => {
    setEditingSermonId(sermon.id);
    setSermonTitle(sermon.title);
    setSermonMinister(sermon.minister || 'Pastor Osaro Aghedo');
    setSermonDate(sermon.date || '');
    setSermonType(sermon.type || 'video');
    setSermonThumbnailUrl(sermon.thumbnailUrl || 'https://images.unsplash.com/photo-1490161705155-d28c4210e9c1?auto=format&fit=crop&q=80');
    setSermonMediaUrl(sermon.mediaUrl || '');
    setSermonDescription(sermon.description || '');
    setSermonScripture(sermon.scripture || '');
    setSermonDuration(sermon.duration || '');
    setSermonErrorMsg('');
    setSermonSuccessMsg('');
    setShowSermonModal(true);
  };

  const handleSaveSermon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sermonTitle.trim() || !sermonMinister.trim()) {
      setSermonErrorMsg('Please provide a Title and Minister name.');
      return;
    }

    setSavingSermon(true);
    setSermonErrorMsg('');
    setSermonSuccessMsg('');

    try {
      const payload = {
        title: sermonTitle.trim(),
        minister: sermonMinister.trim(),
        date: sermonDate.trim() || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        type: sermonType,
        thumbnailUrl: sanitizeImageUrl(sermonThumbnailUrl.trim() || 'https://images.unsplash.com/photo-1490161705155-d28c4210e9c1?auto=format&fit=crop&q=80'),
        mediaUrl: sermonMediaUrl.trim(),
        description: sermonDescription.trim(),
        scripture: sermonScripture.trim(),
        duration: sermonDuration.trim()
      };

      if (editingSermonId) {
        await updateSermon(editingSermonId, payload);
        setSermonSuccessMsg('Teaching updated successfully!');
      } else {
        await addSermon(payload);
        setSermonSuccessMsg('New teaching added to Media Center successfully!');
      }

      setTimeout(() => {
        setShowSermonModal(false);
        resetSermonForm();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving sermon:', err);
      setSermonErrorMsg(err?.message || 'Failed to save sermon. Please check your connection.');
    } finally {
      setSavingSermon(false);
    }
  };

  const handleDeleteSermon = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" from the public Media Center?`)) return;
    try {
      await deleteSermon(id);
    } catch (err) {
      console.error('Error deleting sermon:', err);
      alert('Failed to delete teaching.');
    }
  };

  // Fetch live outreach projects from Firestore
  useEffect(() => {
    let unsubscribe: () => void;
    if (user) {
      setLoadingOutreach(true);
      unsubscribe = subscribeOutreach(
        (items) => {
          setOutreachList(items);
          setLoadingOutreach(false);
        },
        (err) => {
          console.error('Error fetching outreach in admin:', err);
          setLoadingOutreach(false);
        }
      );
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const resetOutreachForm = () => {
    setEditingOutreachId(null);
    setOutreachTitle('');
    setOutreachCategory('Hunger Relief');
    setOutreachLocation('Lagos, Nigeria');
    setOutreachDate('');
    setOutreachImage('https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80');
    setOutreachVideoUrl('');
    setOutreachRaised('0');
    setOutreachGoal('5000');
    setOutreachDescription('');
    setOutreachBeneficiaries('');
    setOutreachStatus('active');
    setOutreachErrorMsg('');
    setOutreachSuccessMsg('');
  };

  const openNewOutreachModal = () => {
    resetOutreachForm();
    setShowOutreachModal(true);
  };

  const openEditOutreachModal = (proj: OutreachProject) => {
    setEditingOutreachId(proj.id);
    setOutreachTitle(proj.title);
    setOutreachCategory(proj.category || 'Hunger Relief');
    setOutreachLocation(proj.location || '');
    setOutreachDate(proj.date || '');
    setOutreachImage(proj.image || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80');
    setOutreachVideoUrl(proj.videoUrl || '');
    setOutreachRaised(String(proj.raised || 0));
    setOutreachGoal(String(proj.goal || 5000));
    setOutreachDescription(proj.description || '');
    setOutreachBeneficiaries(proj.beneficiariesCount || '');
    setOutreachStatus(proj.status || 'active');
    setOutreachErrorMsg('');
    setOutreachSuccessMsg('');
    setShowOutreachModal(true);
  };

  const handleSaveOutreach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outreachTitle.trim() || !outreachDescription.trim()) {
      setOutreachErrorMsg('Please provide a Project Title and Description.');
      return;
    }

    setSavingOutreach(true);
    setOutreachErrorMsg('');
    setOutreachSuccessMsg('');

    try {
      const payload = {
        title: outreachTitle.trim(),
        category: outreachCategory.trim() || 'Outreach',
        location: outreachLocation.trim(),
        date: outreachDate.trim() || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        image: sanitizeImageUrl(outreachImage.trim() || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80'),
        videoUrl: outreachVideoUrl.trim(),
        raised: Number(outreachRaised) || 0,
        goal: Number(outreachGoal) || 0,
        description: outreachDescription.trim(),
        beneficiariesCount: outreachBeneficiaries.trim(),
        status: outreachStatus
      };

      if (editingOutreachId) {
        await updateOutreachProject(editingOutreachId, payload);
        setOutreachSuccessMsg('Outreach project updated successfully!');
      } else {
        await addOutreachProject(payload);
        setOutreachSuccessMsg('New outreach project published successfully!');
      }

      setTimeout(() => {
        setShowOutreachModal(false);
        resetOutreachForm();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving outreach project:', err);
      setOutreachErrorMsg(err?.message || 'Failed to save project. Please check your connection.');
    } finally {
      setSavingOutreach(false);
    }
  };

  const handleDeleteOutreach = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" from public outreach?`)) return;
    try {
      await deleteOutreachProject(id);
    } catch (err) {
      console.error('Error deleting outreach project:', err);
      alert('Failed to delete outreach project.');
    }
  };

  // Fetch live story pictures from Firestore
  useEffect(() => {
    let unsubscribe: () => void;
    if (user) {
      setLoadingStoryPics(true);
      unsubscribe = subscribeStoryPictures(
        (items) => {
          setStoryPicturesList(items);
          setLoadingStoryPics(false);
        },
        (err) => {
          console.error('Error fetching story pictures in admin:', err);
          setLoadingStoryPics(false);
        }
      );
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const handleStoryPicFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 900, 700, 0.80);
      if (!isImageDataUrlSafeForFirestore(compressed)) {
        setStoryPicErrorMsg('Image is too large. Please choose a photo under 3MB.');
        return;
      }
      setStoryPicImageUrl(compressed);
    } catch (err: any) {
      console.warn('Error compressing story picture:', err);
      setStoryPicErrorMsg(err?.message || 'Could not process image.');
    } finally {
      e.target.value = '';
    }
  };

  const resetStoryPicForm = () => {
    setEditingStoryPicId(null);
    setStoryPicTitle('');
    setStoryPicCaption('');
    setStoryPicLocation('Lagos, Nigeria');
    setStoryPicDate(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    setStoryPicCategory('Hunger Relief');
    setStoryPicImageUrl('');
    setStoryPicShowOnHome(true);
    setStoryPicOrder(storyPicturesList.length);
    setStoryPicErrorMsg('');
    setStoryPicSuccessMsg('');
  };

  const openNewStoryPicModal = () => {
    resetStoryPicForm();
    setShowStoryPicModal(true);
  };

  const openEditStoryPicModal = (pic: StoryPicture) => {
    setEditingStoryPicId(pic.id);
    setStoryPicTitle(pic.title);
    setStoryPicCaption(pic.caption || '');
    setStoryPicLocation(pic.location || '');
    setStoryPicDate(pic.date || '');
    setStoryPicCategory(pic.category || 'Outreach');
    setStoryPicImageUrl(pic.imageUrl);
    setStoryPicShowOnHome(pic.showOnHomeStory !== false);
    setStoryPicOrder(pic.order ?? 0);
    setStoryPicErrorMsg('');
    setStoryPicSuccessMsg('');
    setShowStoryPicModal(true);
  };

  const handleSaveStoryPic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyPicTitle.trim()) {
      setStoryPicErrorMsg('Please provide a photo title/headline.');
      return;
    }
    if (!storyPicImageUrl.trim()) {
      setStoryPicErrorMsg('Please provide or upload a photo image.');
      return;
    }

    setSavingStoryPic(true);
    setStoryPicErrorMsg('');
    setStoryPicSuccessMsg('');

    try {
      const payload: Omit<StoryPicture, 'id'> = {
        title: storyPicTitle.trim(),
        caption: storyPicCaption.trim(),
        imageUrl: sanitizeImageUrl(storyPicImageUrl.trim()),
        location: storyPicLocation.trim(),
        date: storyPicDate.trim() || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        category: storyPicCategory.trim() || 'Outreach',
        showOnHomeStory: storyPicShowOnHome,
        order: Number(storyPicOrder) || 0
      };

      if (editingStoryPicId) {
        await updateStoryPicture(editingStoryPicId, payload);
        setStoryPicSuccessMsg('Home story photo updated successfully!');
      } else {
        await addStoryPicture(payload);
        setStoryPicSuccessMsg('New outreach photo published under Our Full Story on the Home page!');
      }

      setTimeout(() => {
        setShowStoryPicModal(false);
        resetStoryPicForm();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving story picture:', err);
      setStoryPicErrorMsg(err?.message || 'Failed to save photo.');
    } finally {
      setSavingStoryPic(false);
    }
  };

  const handleDeleteStoryPic = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to remove "${title}" from the Home page story gallery?`)) return;
    try {
      await deleteStoryPicture(id);
    } catch (err) {
      console.error('Error deleting story photo:', err);
      alert('Failed to delete story photo.');
    }
  };

  const handleToggleStoryPicVisibility = async (pic: StoryPicture) => {
    try {
      const current = pic.showOnHomeStory !== false;
      await updateStoryPicture(pic.id, { showOnHomeStory: !current });
    } catch (err) {
      console.error('Error toggling story picture visibility:', err);
    }
  };

  // Super admin adds new administrator (promote existing member OR pre-authorize by email)
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      alert('Only Super Admins can add or promote administrators.');
      return;
    }
    setAdminActionLoading(true);
    setAdminFeedback(null);

    try {
      if (newAdminMode === 'select_member') {
        if (!selectedMemberForAdmin) {
          setAdminFeedback({ type: 'error', message: 'Please select a registered member to elevate.' });
          setAdminActionLoading(false);
          return;
        }
        const targetMember = members.find(m => m.uid === selectedMemberForAdmin);
        await updateDoc(doc(db, 'users', selectedMemberForAdmin), { role: newAdminRole });
        setAdminFeedback({ 
          type: 'success', 
          message: `Successfully granted ${newAdminRole.replace('_', ' ').toUpperCase()} role to ${targetMember?.email || 'Member'}!` 
        });
      } else {
        const cleanEmail = newAdminEmail.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          setAdminFeedback({ type: 'error', message: 'Please enter a valid email address.' });
          setAdminActionLoading(false);
          return;
        }

        const existingMember = members.find(m => m.email?.toLowerCase() === cleanEmail);
        if (existingMember) {
          await updateDoc(doc(db, 'users', existingMember.uid), { role: newAdminRole });
          setAdminFeedback({ 
            type: 'success', 
            message: `User ${cleanEmail} has an existing profile and was promoted to ${newAdminRole.replace('_', ' ').toUpperCase()}!` 
          });
        } else {
          const newDocRef = doc(collection(db, 'users'));
          await setDoc(newDocRef, {
            email: cleanEmail,
            role: newAdminRole,
            joinedAt: new Date().toISOString(),
            attendanceCount: 0,
            isPreAssignedAdmin: true
          });
          setAdminFeedback({ 
            type: 'success', 
            message: `Pre-authorized ${cleanEmail} as ${newAdminRole.replace('_', ' ').toUpperCase()}! They will automatically receive admin permissions when they log in.` 
          });
        }
      }

      setTimeout(() => {
        setShowAddAdminModal(false);
        setSelectedMemberForAdmin('');
        setNewAdminEmail('');
        setNewAdminName('');
        setAdminFeedback(null);
      }, 1500);
    } catch (err: any) {
      console.error('Error adding administrator:', err);
      setAdminFeedback({ type: 'error', message: err?.message || 'Failed to add administrator.' });
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Super Admin: change staff role or demote
  const handleChangeStaffRole = async (targetAdmin: UserProfile, newRole: 'member' | 'admin_assistant' | 'super_admin') => {
    if (!isSuperAdmin) {
      alert('Only Super Admins can modify administrator roles.');
      return;
    }
    if (targetAdmin.email?.toLowerCase() === 'brainstormacademybsa@gmail.com' && newRole !== 'super_admin') {
      alert('The primary root Super Admin account is protected and cannot be modified or demoted.');
      return;
    }

    if (targetAdmin.uid === user?.uid && newRole === 'member') {
      if (!confirm('Warning: You are about to revoke your own admin access. Proceed?')) return;
    }

    try {
      await updateDoc(doc(db, 'users', targetAdmin.uid), { role: newRole });
    } catch (err) {
      console.error('Error changing administrator role:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetAdmin.uid}`);
    }
  };

  // Self-activate admin if user is recognized super admin
  const handleActivateAdmin = async () => {
    if (!user) return;
    if (!isSuperAdmin) {
      alert('Your email is not recognized as a Super Admin.');
      return;
    }
    setActivatingAdmin(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: 'super_admin' });
      window.location.reload();
    } catch (err) {
      console.error('Error upgrading role:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setActivatingAdmin(false);
    }
  };

  // Change user role from admin panel
  const handleUpdateUserRole = async (targetUid: string, newRole: 'member' | 'admin_assistant' | 'super_admin') => {
    if (!isSuperAdmin) {
      alert('Only Super Admins are authorized to change user roles.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', targetUid), { role: newRole });
    } catch (err) {
      console.error('Error updating user role:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  // Change user WhatsApp community from admin panel
  const handleUpdateMemberCommunity = async (targetUid: string, newCommunity: string) => {
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        whatsappCommunity: newCommunity,
        whatsappGroupName: newCommunity,
        whatsappGroup: newCommunity
      });
    } catch (err) {
      console.error('Error updating user WhatsApp community:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  // Inline direct Present / Absent attendance correction for a member
  const handleInlineToggleAttendance = async (targetMember: UserProfile, targetStatus: 'present' | 'absent') => {
    if (!targetMember.uid) return;
    const todayDateStr = getTodayDateString();
    setTogglingMemberUid(targetMember.uid);
    try {
      const userRef = doc(db, 'users', targetMember.uid);
      const currentDays = Array.isArray(targetMember.attendanceDaysList) ? [...targetMember.attendanceDaysList] : [];
      const currentDailyMap = targetMember.dailyMinutes ? { ...targetMember.dailyMinutes } : {};

      if (targetStatus === 'absent') {
        delete currentDailyMap[todayDateStr];
        await updateDoc(userRef, {
          attendanceDaysList: arrayRemove(todayDateStr),
          attendanceCount: Math.max(0, (targetMember.attendanceCount || currentDays.length) - 1),
          totalMinutes: Math.max(0, (targetMember.totalMinutes || 0) - (currentDailyMap[todayDateStr] || 60)),
          dailyMinutes: currentDailyMap,
          todayMinutes: 0,
          manualAdjustmentNote: `Marked absent on ${new Date().toLocaleDateString()}`
        });
        setMemberFeedback({
          type: 'success',
          message: `Marked ${targetMember.displayName || 'Member'} as ABSENT for today (${todayDateStr}).`
        });
      } else {
        const isNewDay = !currentDays.includes(todayDateStr);
        currentDailyMap[todayDateStr] = 60;
        await updateDoc(userRef, {
          attendanceDaysList: arrayUnion(todayDateStr),
          lastAttendedDate: todayDateStr,
          attendanceCount: increment(isNewDay ? 1 : 0),
          totalMinutes: (targetMember.totalMinutes || 0) + 60,
          dailyMinutes: currentDailyMap,
          todayMinutes: 60,
          manualAdjustmentNote: `Marked present on ${new Date().toLocaleDateString()}`
        });
        setMemberFeedback({
          type: 'success',
          message: `Marked ${targetMember.displayName || 'Member'} as PRESENT for today (${todayDateStr}).`
        });
      }
    } catch (err: any) {
      console.error('Failed to toggle attendance:', err);
      setMemberFeedback({
        type: 'error',
        message: err?.message || 'Failed to update attendance status.'
      });
    } finally {
      setTogglingMemberUid(null);
    }
  };

  // Moderation action
  const handleUpdateTestimonyStatus = async (id: string, status: 'approved' | 'declined') => {
    try {
      await updateDoc(doc(db, 'testimonies', id), { status });
    } catch (err) {
      console.error('Error updating testimony status:', err);
      handleFirestoreError(err, OperationType.UPDATE, `testimonies/${id}`);
    }
  };

  // Real-time live presence helpers (Heartbeat valid if within last 90 seconds)
  const isGuestInZoomNow = (g: GuestAttendanceRecord) => {
    if (!g.lastActiveAt) return false;
    const lastActiveMs = g.lastActiveAt?.seconds
      ? g.lastActiveAt.seconds * 1000
      : (g.lastActiveAt?.toMillis ? g.lastActiveAt.toMillis() : 0);
    if (!lastActiveMs) return false;
    const isRecent = (Date.now() - lastActiveMs) <= 90 * 1000;
    const isActiveStatus = g.status === 'active' || g.isZoomActive === true;
    return isRecent && isActiveStatus;
  };

  const isMemberInZoomNow = (m: UserProfile) => {
    if (!m.isZoomActive) return false;
    const activeObj = m.lastZoomActiveAt || m.lastActiveAt;
    if (!activeObj) return false;
    const lastActiveMs = activeObj?.seconds
      ? activeObj.seconds * 1000
      : (activeObj?.toMillis ? activeObj.toMillis() : 0);
    if (!lastActiveMs) return false;
    const isRecent = (Date.now() - lastActiveMs) <= 90 * 1000;
    return isRecent && Boolean(m.isZoomActive);
  };

  // Live real-time participant groupings (hide super admin from other admins)
  const liveGuestsList = guestRecords.filter(isGuestInZoomNow);
  const liveMembersList = members
    .filter(isMemberInZoomNow)
    .filter(m => isSuperAdmin || !isUserSuperAdmin(m));
  const totalLiveInZoomCount = liveGuestsList.length + liveMembersList.length;

  // Master Protected Account Check: Protects the primary master super admin account from deletion
  const isAccountProtected = (m: UserProfile) => {
    if (m.uid === 'admin-master-brainstormacademybsa_gmail_com') return true;
    const email = (m.email || '').toLowerCase().trim();
    if (email === 'brainstormacademybsa@gmail.com') {
      // If there are duplicate records, protect the primary master record
      return m.uid === 'admin-master-brainstormacademybsa_gmail_com';
    }
    return false;
  };

  // Automatic Duplicate Member Detection Interface & Engine
  const duplicateMemberClusters = useMemo(() => {
    // Only evaluate visible candidates (hide super admins if viewer isn't super admin)
    const candidateMembers = members.filter(m => isSuperAdmin || !isUserSuperAdmin(m));

    const emailMap = new Map<string, UserProfile[]>();
    const phoneMap = new Map<string, UserProfile[]>();
    const nameMap = new Map<string, UserProfile[]>();

    candidateMembers.forEach(m => {
      const email = (m.email || '').toLowerCase().trim();
      if (email && email.includes('@')) {
        const list = emailMap.get(email) || [];
        list.push(m);
        emailMap.set(email, list);
      }

      const digits = (m.phone || m.whatsappGroup || '').replace(/\D/g, '');
      if (digits.length >= 7) {
        const key = digits.length > 10 ? digits.slice(-10) : digits;
        const list = phoneMap.get(key) || [];
        list.push(m);
        phoneMap.set(key, list);
      }

      const name = (m.displayName || '').toLowerCase().trim().replace(/\s+/g, ' ');
      if (name.length >= 3 && name !== 'unnamed member') {
        const list = nameMap.get(name) || [];
        list.push(m);
        nameMap.set(name, list);
      }
    });

    // Disjoint set / union find to merge duplicate clusters
    const parent = new Map<string, string>();
    const find = (uid: string): string => {
      if (!parent.has(uid)) parent.set(uid, uid);
      if (parent.get(uid) !== uid) {
        parent.set(uid, find(parent.get(uid)!));
      }
      return parent.get(uid)!;
    };
    const union = (uid1: string, uid2: string) => {
      const root1 = find(uid1);
      const root2 = find(uid2);
      if (root1 !== root2) {
        parent.set(root1, root2);
      }
    };

    emailMap.forEach(list => {
      if (list.length > 1) {
        for (let i = 1; i < list.length; i++) union(list[0].uid, list[i].uid);
      }
    });
    phoneMap.forEach(list => {
      if (list.length > 1) {
        for (let i = 1; i < list.length; i++) union(list[0].uid, list[i].uid);
      }
    });
    nameMap.forEach(list => {
      if (list.length > 1) {
        for (let i = 1; i < list.length; i++) union(list[0].uid, list[i].uid);
      }
    });

    const clusterBuckets = new Map<string, UserProfile[]>();
    candidateMembers.forEach(m => {
      const root = find(m.uid);
      const b = clusterBuckets.get(root) || [];
      b.push(m);
      clusterBuckets.set(root, b);
    });

    const clusters: Array<{
      id: string;
      matchType: 'email' | 'phone' | 'name';
      matchValue: string;
      reason: string;
      members: UserProfile[];
      primaryUid: string;
      redundantUids: string[];
    }> = [];

    clusterBuckets.forEach((clusterMembers, rootId) => {
      if (clusterMembers.length <= 1) return;

      const reasons: string[] = [];
      let matchType: 'email' | 'phone' | 'name' = 'name';
      let matchVal = '';

      const emails = new Set(clusterMembers.map(m => (m.email || '').toLowerCase().trim()).filter(Boolean));
      if (emails.size < clusterMembers.length && emails.size > 0) {
        reasons.push('Exact Email Match');
        matchType = 'email';
        matchVal = Array.from(emails)[0];
      }

      const phones = new Set(clusterMembers.map(m => (m.phone || m.whatsappGroup || '').replace(/\D/g, '')).filter(d => d.length >= 7));
      if (phones.size < clusterMembers.length && phones.size > 0) {
        reasons.push('Phone Number Match');
        if (!matchVal) {
          matchType = 'phone';
          matchVal = clusterMembers.find(m => m.phone)?.phone || '';
        }
      }

      const names = new Set(clusterMembers.map(m => (m.displayName || '').toLowerCase().trim()).filter(Boolean));
      if (names.size < clusterMembers.length && names.size > 0) {
        reasons.push('Identical Full Name');
        if (!matchVal) {
          matchType = 'name';
          matchVal = clusterMembers[0].displayName || '';
        }
      }

      if (reasons.length === 0) {
        reasons.push('Duplicate Member Match');
      }

      // Rank members to choose the best Primary account to preserve:
      const sortedByBest = [...clusterMembers].sort((a, b) => {
        if (isAccountProtected(a)) return -1;
        if (isAccountProtected(b)) return 1;

        const roleRank = (role?: string) => {
          if (role === 'super_admin') return 4;
          if (role === 'admin') return 3;
          if (role === 'worker') return 2;
          return 1;
        };
        const rDiff = roleRank(b.role) - roleRank(a.role);
        if (rDiff !== 0) return rDiff;

        const aAtt = (a.attendanceDaysList?.length || a.attendanceCount || 0);
        const bAtt = (b.attendanceDaysList?.length || b.attendanceCount || 0);
        if (bAtt !== aAtt) return bAtt - aAtt;

        const aMin = a.totalMinutes || 0;
        const bMin = b.totalMinutes || 0;
        if (bMin !== aMin) return bMin - aMin;

        return 0;
      });

      const chosenPrimary = duplicateSelectedPrimaryMap[rootId] 
        ? (sortedByBest.find(m => m.uid === duplicateSelectedPrimaryMap[rootId]) || sortedByBest[0])
        : sortedByBest[0];

      const redundantUids = clusterMembers
        .filter(m => m.uid !== chosenPrimary.uid)
        .map(m => m.uid);

      clusters.push({
        id: rootId,
        matchType,
        matchValue: matchVal,
        reason: reasons.join(' & '),
        members: sortedByBest,
        primaryUid: chosenPrimary.uid,
        redundantUids
      });
    });

    return clusters;
  }, [members, isSuperAdmin, duplicateSelectedPrimaryMap]);

  // Quick duplicate lookups
  const allRedundantDuplicateUids = useMemo(() => {
    return duplicateMemberClusters.flatMap(c => c.redundantUids);
  }, [duplicateMemberClusters]);

  const allDuplicateMemberUids = useMemo(() => {
    return duplicateMemberClusters.flatMap(c => c.members.map(m => m.uid));
  }, [duplicateMemberClusters]);

  const duplicateMemberClusterMap = useMemo(() => {
    const map = new Map<string, { cluster: typeof duplicateMemberClusters[0]; isPrimary: boolean }>();
    duplicateMemberClusters.forEach(cluster => {
      cluster.members.forEach(m => {
        map.set(m.uid, {
          cluster,
          isPrimary: m.uid === cluster.primaryUid
        });
      });
    });
    return map;
  }, [duplicateMemberClusters]);

  // Filtered members: hide super admins if the viewer is not a Super Admin
  const filteredMembers = members.filter((m) => {
    if (!isSuperAdmin && isUserSuperAdmin(m)) {
      return false;
    }

    const memberCommunity = getMemberWhatsAppCommunity(m);
    const matchesSearch = 
      (m.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.country || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.whatsappCommunity || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.whatsappGroup || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      memberCommunity.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesRole = true;
    if (roleFilter === 'live') {
      matchesRole = isMemberInZoomNow(m);
    } else if (roleFilter === 'duplicates') {
      matchesRole = allDuplicateMemberUids.includes(m.uid);
    } else if (roleFilter !== 'all') {
      matchesRole = m.role === roleFilter;
    }

    let matchesCommunity = true;
    if (communityFilter !== 'all') {
      if (communityFilter === 'unassigned') {
        matchesCommunity = memberCommunity === 'Unassigned';
      } else {
        matchesCommunity = memberCommunity.toLowerCase().includes(communityFilter.toLowerCase()) ||
                           (m.whatsappCommunity || '').toLowerCase().includes(communityFilter.toLowerCase()) ||
                           (m.whatsappGroupName || '').toLowerCase().includes(communityFilter.toLowerCase()) ||
                           (m.whatsappGroup || '').toLowerCase().includes(communityFilter.toLowerCase());
      }
    }

    return matchesSearch && matchesRole && matchesCommunity;
  });

  // Calculate Community Totals
  const totalCommunityMinutes = members.reduce((acc, m) => acc + (m.totalMinutes || 0), 0);
  const totalCommunityYearMinutes = members.reduce((acc, m) => acc + (m.thisYearMinutes || m.thisWeekMinutes || 0), 0);
  const totalDaysAttendedAcrossAll = members.reduce((acc, m) => acc + (m.attendanceCount || m.attendanceDaysList?.length || 0), 0);

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

  // Export CSV function
  const handleExportCSV = () => {
    if (filteredMembers.length === 0) return;
    const headers = [
      'UID', 'Name', 'Email', 'Role', 'WhatsApp Community', 'Phone Number', 
      'Country', 'Timezone', 'Days Attended', 'Today Minutes', 'This Year Minutes', 'Total Minutes', 'Joined Date'
    ];
    const rows = filteredMembers.map(m => [
      `"${m.uid}"`,
      `"${m.displayName || ''}"`,
      `"${m.email || ''}"`,
      `"${m.role}"`,
      `"${getMemberWhatsAppCommunity(m)}"`,
      `"${m.phone || m.whatsappGroup || ''}"`,
      `"${m.country || ''}"`,
      `"${m.timezone || ''}"`,
      `"${m.attendanceCount || m.attendanceDaysList?.length || 0}"`,
      `"${m.todayMinutes || 0}"`,
      `"${m.thisYearMinutes || m.thisWeekMinutes || 0}"`,
      `"${m.totalMinutes || 0}"`,
      `"${m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LightUp_Members_Attendance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Member Selection Helpers
  const handleSelectAllFilteredMembers = () => {
    const selectable = filteredMembers.filter(m => !isAccountProtected(m) && (!user || m.uid !== user.uid));
    if (selectable.length > 0 && selectedMemberUids.length === selectable.length) {
      setSelectedMemberUids([]);
    } else {
      setSelectedMemberUids(selectable.map(m => m.uid));
    }
  };

  const handleToggleSelectMember = (uid: string) => {
    setSelectedMemberUids(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleDeleteMember = async (targetMember: UserProfile) => {
    if (isAccountProtected(targetMember)) {
      setMemberFeedback({
        type: 'error',
        message: 'Master administrator accounts are protected and cannot be deleted.'
      });
      return;
    }

    if (user && user.uid === targetMember.uid) {
      setMemberFeedback({
        type: 'error',
        message: 'You cannot delete your own active administrator account.'
      });
      return;
    }

    if (!isSuperAdmin && targetMember.role !== 'member') {
      setMemberFeedback({
        type: 'error',
        message: 'Only Super Admins have permission to delete administrative accounts.'
      });
      return;
    }

    setDeletingMemberUid(targetMember.uid);
    try {
      await deleteDoc(doc(db, 'users', targetMember.uid));
      setSelectedMemberUids(prev => prev.filter(id => id !== targetMember.uid));
      setMemberToDelete(null);
      setMemberFeedback({
        type: 'success',
        message: `Member "${targetMember.displayName || targetMember.email}" was successfully deleted from the database.`
      });
      setTimeout(() => setMemberFeedback(null), 5000);
    } catch (err: any) {
      console.error('Error deleting member:', err);
      setMemberFeedback({
        type: 'error',
        message: `Failed to delete member: ${err?.message || 'Database error'}`
      });
    } finally {
      setDeletingMemberUid(null);
    }
  };

  const handleBulkDeleteMembers = async () => {
    const targetMembers = members.filter(m => selectedMemberUids.includes(m.uid));
    const validToDelete = targetMembers.filter(m => 
      !isAccountProtected(m) && 
      (!user || m.uid !== user.uid) &&
      (isSuperAdmin || m.role === 'member')
    );

    if (validToDelete.length === 0) {
      setMemberFeedback({
        type: 'error',
        message: 'None of the selected accounts can be deleted.'
      });
      setShowBulkDeleteModal(false);
      return;
    }

    setDeletingMemberUid('bulk');
    try {
      const batch = writeBatch(db);
      validToDelete.forEach(m => {
        batch.delete(doc(db, 'users', m.uid));
      });
      await batch.commit();
      setSelectedMemberUids([]);
      setShowBulkDeleteModal(false);
      setMemberFeedback({
        type: 'success',
        message: `Successfully deleted ${validToDelete.length} member account(s).`
      });
      setTimeout(() => setMemberFeedback(null), 5000);
    } catch (err: any) {
      console.error('Error in bulk delete members:', err);
      setMemberFeedback({
        type: 'error',
        message: `Bulk delete failed: ${err?.message || 'Database error'}`
      });
    } finally {
      setDeletingMemberUid(null);
    }
  };

  // Duplicate Resolution & Deletion Handlers
  const handleDeleteDuplicate = async (targetMember: UserProfile) => {
    if (isAccountProtected(targetMember)) {
      setMemberFeedback({
        type: 'error',
        message: 'Master administrator accounts are protected and cannot be deleted.'
      });
      return;
    }
    if (user && user.uid === targetMember.uid) {
      setMemberFeedback({
        type: 'error',
        message: 'You cannot delete your own active administrator account.'
      });
      return;
    }

    setDuplicateActionLoading(targetMember.uid);
    try {
      await deleteDoc(doc(db, 'users', targetMember.uid));
      setSelectedMemberUids(prev => prev.filter(id => id !== targetMember.uid));
      setMemberFeedback({
        type: 'success',
        message: `Deleted duplicate record "${targetMember.displayName || targetMember.email}" successfully.`
      });
      setTimeout(() => setMemberFeedback(null), 4000);
    } catch (err: any) {
      console.error('Error deleting duplicate:', err);
      setMemberFeedback({
        type: 'error',
        message: `Failed to delete duplicate: ${err?.message || 'Database error'}`
      });
    } finally {
      setDuplicateActionLoading(null);
    }
  };

  const handleMergeAndDeleteDuplicate = async (duplicateMember: UserProfile, primaryMember: UserProfile) => {
    if (isAccountProtected(duplicateMember)) {
      setMemberFeedback({
        type: 'error',
        message: 'Master administrator accounts are protected and cannot be deleted.'
      });
      return;
    }
    if (duplicateMember.uid === primaryMember.uid) return;

    setDuplicateActionLoading(`merge-${duplicateMember.uid}`);
    try {
      const primaryRef = doc(db, 'users', primaryMember.uid);
      const duplicateRef = doc(db, 'users', duplicateMember.uid);

      // Merge attendance days list
      const primaryDays = Array.isArray(primaryMember.attendanceDaysList) ? [...primaryMember.attendanceDaysList] : [];
      const dupDays = Array.isArray(duplicateMember.attendanceDaysList) ? duplicateMember.attendanceDaysList : [];
      const mergedDays = Array.from(new Set([...primaryDays, ...dupDays]));

      // Merge daily minutes map
      const mergedDailyMinutes = { ...(primaryMember.dailyMinutes || {}) };
      if (duplicateMember.dailyMinutes) {
        Object.entries(duplicateMember.dailyMinutes).forEach(([date, mins]) => {
          mergedDailyMinutes[date] = Math.max(mergedDailyMinutes[date] || 0, Number(mins) || 0);
        });
      }

      const mergedTotalMinutes = (primaryMember.totalMinutes || 0) + (duplicateMember.totalMinutes || 0);
      const mergedCount = Math.max(mergedDays.length, (primaryMember.attendanceCount || 0) + (duplicateMember.attendanceCount || 0));

      const updates: any = {
        attendanceDaysList: mergedDays,
        dailyMinutes: mergedDailyMinutes,
        totalMinutes: mergedTotalMinutes,
        attendanceCount: mergedCount,
        manualAdjustmentNote: `Merged duplicate record (${duplicateMember.email || duplicateMember.uid}) on ${new Date().toLocaleDateString()}`
      };

      // Fill missing fields on primary if duplicate had them
      if (!primaryMember.phone && duplicateMember.phone) updates.phone = duplicateMember.phone;
      if (!primaryMember.country && duplicateMember.country) updates.country = duplicateMember.country;
      if ((!primaryMember.whatsappCommunity || primaryMember.whatsappCommunity === 'Unassigned') && duplicateMember.whatsappCommunity) {
        updates.whatsappCommunity = duplicateMember.whatsappCommunity;
      }
      if (!primaryMember.whatsappGroup && duplicateMember.whatsappGroup) updates.whatsappGroup = duplicateMember.whatsappGroup;

      const batch = writeBatch(db);
      batch.update(primaryRef, updates);
      batch.delete(duplicateRef);
      await batch.commit();

      setSelectedMemberUids(prev => prev.filter(id => id !== duplicateMember.uid));
      setMemberFeedback({
        type: 'success',
        message: `Successfully merged attendance history from "${duplicateMember.displayName || duplicateMember.email}" into "${primaryMember.displayName || primaryMember.email}" and removed the duplicate.`
      });
      setTimeout(() => setMemberFeedback(null), 5000);
    } catch (err: any) {
      console.error('Error merging duplicate:', err);
      setMemberFeedback({
        type: 'error',
        message: `Failed to merge duplicate: ${err?.message || 'Database error'}`
      });
    } finally {
      setDuplicateActionLoading(null);
    }
  };

  const handleDeleteAllRedundantDuplicates = async () => {
    if (allRedundantDuplicateUids.length === 0) return;

    setDuplicateActionLoading('all-redundant');
    try {
      const batch = writeBatch(db);
      let deletedCount = 0;

      for (const uid of allRedundantDuplicateUids) {
        const mem = members.find(m => m.uid === uid);
        if (mem && !isAccountProtected(mem) && (!user || mem.uid !== user.uid)) {
          batch.delete(doc(db, 'users', uid));
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        await batch.commit();
        setSelectedMemberUids(prev => prev.filter(id => !allRedundantDuplicateUids.includes(id)));
        setMemberFeedback({
          type: 'success',
          message: `Successfully deleted all ${deletedCount} redundant duplicate member accounts!`
        });
      } else {
        setMemberFeedback({
          type: 'error',
          message: 'No eligible redundant duplicate accounts could be deleted.'
        });
      }
      setShowDeleteAllDuplicatesModal(false);
      setShowDuplicateResolutionModal(false);
      setTimeout(() => setMemberFeedback(null), 5000);
    } catch (err: any) {
      console.error('Error deleting all duplicates:', err);
      setMemberFeedback({
        type: 'error',
        message: `Failed to delete duplicates: ${err?.message || 'Database error'}`
      });
    } finally {
      setDuplicateActionLoading(null);
    }
  };

  // Guest record helpers
  const handleDeleteGuestRecord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this guest attendance record?')) return;
    try {
      await deleteDoc(doc(db, 'guest_attendance', id));
    } catch (err) {
      console.error('Error deleting guest record:', err);
      handleFirestoreError(err, OperationType.DELETE, `guest_attendance/${id}`);
    }
  };

  const todayDateStr = getTodayDateString();
  const currentYearStr = new Date().getFullYear().toString();

  const filteredGuestRecords = guestRecords.filter((g) => {
    const query = guestSearchQuery.toLowerCase();
    const matchesSearch =
      (g.guestId || '').toLowerCase().includes(query) ||
      (g.guestName || '').toLowerCase().includes(query) ||
      (g.guestPhone || '').toLowerCase().includes(query) ||
      (g.deviceInfo || '').toLowerCase().includes(query) ||
      (g.dateStr || '').toLowerCase().includes(query);
    
    let matchesStatus = true;
    if (guestStatusFilter === 'active') {
      matchesStatus = isGuestInZoomNow(g);
    } else if (guestStatusFilter === 'completed') {
      matchesStatus = !isGuestInZoomNow(g);
    }

    let matchesDate = true;
    if (guestDateFilter === 'today') {
      matchesDate = g.dateStr === todayDateStr || g.lastDateStr === todayDateStr;
    } else if (guestDateFilter === 'year') {
      matchesDate = (g.dateStr || g.lastDateStr || '').startsWith(currentYearStr);
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const totalGuestMinutes = guestRecords.reduce((acc, g) => acc + (g.totalMinutes || Math.floor((g.totalSeconds || 0) / 60)), 0);
  const totalActiveGuestsNow = liveGuestsList.length;
  const totalUniqueGuestDevices = new Set(guestRecords.map(g => g.guestId)).size;

  const handleExportGuestCSV = () => {
    if (filteredGuestRecords.length === 0) return;
    const headers = [
      'Guest Name', 'Phone Number', 'Guest ID', 'Date', 'Time Spent (Secs)', 'Time Spent (Mins)', 'Status', 'Platform / Device', 'Last Active'
    ];
    const rows = filteredGuestRecords.map(g => [
      `"${g.guestName || 'Anonymous'}"`,
      `"${g.guestPhone || ''}"`,
      `"${g.guestId || ''}"`,
      `"${g.dateStr || ''}"`,
      `"${g.totalSeconds || 0}"`,
      `"${g.totalMinutes || Math.floor((g.totalSeconds || 0) / 60)}"`,
      `"${g.status || 'completed'}"`,
      `"${g.deviceInfo || ''}"`,
      `"${g.lastActiveAt?.toDate ? g.lastActiveAt.toDate().toLocaleString() : ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LightUp_Guest_Zoom_Attendance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const menuItems = [
    { id: 'members', name: 'Members & Attendance', icon: Users },
    { id: 'zoom-sync', name: 'Daily Prayer Attendance (Zoom & WhatsApp)', icon: CheckCircle2 },
    { id: 'attendance-reports', name: 'Attendance Hub & Roster', icon: ClipboardCheck },
    { id: 'guests', name: 'Guest / Unregistered Zoom Logs', icon: Video },
    { id: 'whatsapp', name: 'WhatsApp Tracking', icon: MessageCircle },
    { id: 'branding', name: 'Logo & Branding', icon: Palette },
    { id: 'themes', name: 'Weekly Themes', icon: Calendar },
    { id: 'programs', name: 'Upcoming Programs', icon: Calendar },
    { id: 'books', name: 'Books & Publications', icon: BookOpen },
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'moderation', name: 'Testimonies Moderation', icon: MessageSquare },
    { id: 'media', name: 'Media Archive', icon: Video },
    { id: 'outreach', name: 'NGO Projects', icon: Heart },
    ...(isSuperAdmin ? [{ id: 'admins', name: 'Admin Staff', icon: ShieldCheck }] : []),
  ];

  // Access check: Strictly enforce that only approved administrator emails enter the admin dashboard
  const isApprovedAdmin = Boolean(
    isSuperAdmin || 
    profile?.role === 'super_admin' || 
    profile?.role === 'admin_assistant' ||
    (user?.email && SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === (user.email || '').toLowerCase()))
  );

  // 1. If not logged in at all, display the Admin Login Screen
  if (!user) {
    const handlePasscodeSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setPasscodeLocalError(null);
      setPasscodeSubmitting(true);
      try {
        const success = await loginWithPasscode(passcodeEmail, adminPasscode);
        if (!success) {
          setPasscodeLocalError(authError || 'Access Denied: Email is not authorized.');
        }
      } catch (err: any) {
        setPasscodeLocalError(err?.message || 'Authentication error.');
      } finally {
        setPasscodeSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1F3C] p-4 text-white">
        <div className="bg-white/10 backdrop-blur-md p-6 sm:p-10 rounded-3xl shadow-2xl space-y-6 max-w-md w-full border border-white/20">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-[#F26522]/20 text-[#F26522] rounded-full flex items-center justify-center mx-auto border border-[#F26522]/30">
              <ShieldCheck size={36} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">Light Up Admin Portal</h1>
            <p className="text-gray-300 text-xs sm:text-sm font-medium">
              Restricted Area. Authorized administrator credentials required.
            </p>
          </div>

          {/* Login Mode Toggle Tabs */}
          <div className="flex bg-black/30 p-1 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setLoginMode('passcode');
                clearAuthError();
                setPasscodeLocalError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                loginMode === 'passcode' 
                  ? 'bg-[#F26522] text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Key size={14} />
              <span>Admin Password</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('google');
                clearAuthError();
                setPasscodeLocalError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                loginMode === 'google' 
                  ? 'bg-[#F26522] text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Globe size={14} />
              <span>Google Sign-In</span>
            </button>
          </div>

          {/* Passcode Login Form */}
          {loginMode === 'passcode' && (
            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-300 mb-1.5">
                  Authorized Administrator Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={passcodeEmail}
                    onChange={(e) => setPasscodeEmail(e.target.value)}
                    placeholder="e.g. admin@lightupprayerhouse.org"
                    className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Must be an approved church administrator email address.</p>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-300 mb-1.5">
                  Admin Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPasscodeText ? 'text' : 'password'}
                    required
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    placeholder="Enter your admin password"
                    className="w-full pl-10 pr-11 py-3 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscodeText(!showPasscodeText)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                  >
                    {showPasscodeText ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-amber-300/80 mt-1">First-time login? The password you enter above will be automatically saved as your personal admin password.</p>
              </div>

              {(passcodeLocalError || authError) && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold rounded-xl text-center leading-relaxed">
                  {passcodeLocalError || authError}
                </div>
              )}

              <button
                type="submit"
                disabled={passcodeSubmitting}
                className="w-full py-4 bg-[#F26522] hover:bg-[#d9561a] disabled:opacity-60 text-white rounded-xl font-bold uppercase tracking-widest transition-all shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
              >
                {passcodeSubmitting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Sign In to Admin Portal</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Google Sign In Mode */}
          {loginMode === 'google' && (
            <div className="space-y-4">
              {authError && (
                <div className="p-3.5 bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs rounded-xl space-y-2 text-left">
                  <p className="font-bold flex items-center space-x-1.5 text-amber-300">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>Google Sign-In Notice</span>
                  </p>
                  <p>{authError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode('passcode');
                    }}
                    className="w-full mt-2 py-2 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-lg text-xs font-bold uppercase tracking-wider text-center cursor-pointer transition-all shadow"
                  >
                    Switch to Admin Passcode Login
                  </button>
                </div>
              )}

              <button 
                type="button"
                onClick={login} 
                disabled={isLoggingIn}
                className="w-full py-4 bg-[#F26522] disabled:opacity-60 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-[#d9561a] transition-all shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Connecting Google...</span>
                  </>
                ) : (
                  <>
                    <Globe size={18} />
                    <span>Sign In with Approved Google Email</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-gray-400 text-center">
                Note: In mobile in-app browsers or if Google popups are restricted, use the <strong>Admin Passcode</strong> tab above.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-white/10">
            <a href="/" className="text-xs text-gray-400 hover:text-white flex items-center justify-center space-x-1.5 transition-colors">
              <ArrowLeft size={14} />
              <span>Return to Main Website</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 2. If logged in, but email is NOT approved as an Administrator
  if (user && !isApprovedAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1F3C] p-4 text-white">
        <div className="bg-white/10 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-2xl space-y-5 max-w-sm w-full border border-white/15 text-center">
          <div className="w-14 h-14 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
            <ShieldAlert size={28} />
          </div>
          
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white">Access Denied</h1>
            <p className="text-gray-300 text-xs">
              Unauthorized account.
            </p>
          </div>

          <div className="py-2 px-3 bg-black/40 border border-white/10 rounded-xl text-xs text-gray-300 truncate">
            {user.email || 'Current Account'}
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={logout}
              className="w-full py-2.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Sign Out / Switch Account</span>
            </button>

            <a
              href="/"
              className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl font-semibold text-xs transition-all flex items-center justify-center"
            >
              Return to Website
            </a>
          </div>
        </div>
      </div>
    );
  }

  const formatMinutesToHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Sidebar for Desktop */}
      <aside className="w-full lg:w-64 bg-[#1A1F3C] text-white flex flex-col shrink-0">
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white p-0.5 overflow-hidden flex items-center justify-center shrink-0">
              <img src={siteBranding.logoUrl || '/logo.jpg'} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-black text-xs uppercase tracking-widest text-amber-400">Light Up</p>
              <p className="font-extrabold text-sm text-white">Admin Control</p>
            </div>
          </div>
          <a href="/" className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 text-xs flex items-center space-x-1">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Exit</span>
          </a>
        </div>
        
        {/* Desktop Menu */}
        <nav className="hidden lg:block flex-grow p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as AdminTab)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === item.id 
                  ? "bg-[#F26522] text-white shadow-lg shadow-[#F26522]/30" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon size={18} />
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        <div className="hidden lg:block p-6 border-t border-white/10 bg-black/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#F26522] flex items-center justify-center text-xs font-black">
              {(user?.email || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-black truncate">{user?.email}</p>
              <p className="text-[10px] text-amber-400 uppercase tracking-widest font-black truncate">
                {isSuperAdmin ? 'SUPER ADMIN' : (profile?.role ? profile.role.replace('_', ' ').toUpperCase() : 'ADMIN ASSISTANT')}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-gray-100 p-4 sm:p-6 sticky top-0 z-30 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <a href="/" className="lg:hidden p-2 bg-gray-100 rounded-xl text-gray-600 hover:text-[#1A1F3C]">
                <ArrowLeft size={18} />
              </a>
              <div>
                <h2 className="text-xl font-black text-[#1A1F3C] uppercase tracking-tight">
                  {menuItems.find(i => i.id === activeTab)?.name}
                </h2>
                <p className="text-xs font-bold text-gray-400">LIGHT UP PRAYER HOUSE ADMIN CONSOLE</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <a 
                href="/" 
                className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#1A1F3C] rounded-xl font-bold text-xs transition-all"
              >
                <ArrowLeft size={14} />
                <span>Return to Main Site</span>
              </a>
              <button 
                onClick={logout} 
                className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Horizontal Tab Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none border-t border-gray-100 pt-3">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as AdminTab)}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0",
                  activeTab === item.id
                    ? "bg-[#1A1F3C] text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                <item.icon size={14} className={activeTab === item.id ? "text-[#F26522]" : "text-gray-400"} />
                <span>{item.name}</span>
                {item.id === 'members' && (
                  <span className="bg-[#F26522] text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">
                    {members.filter(m => isSuperAdmin || !isUserSuperAdmin(m)).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        <div className="p-4 sm:p-8 space-y-8">

          {/* MEMBERS & ATTENDANCE TAB */}
          {activeTab === 'members' && (
            <div className="space-y-8">
              {/* Header bar & Prominent Action Command Center */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black text-[#1A1F3C]">Members & Prayer Attendance Log</h3>
                    <p className="text-gray-500 text-sm font-medium">Tracks member sign-ups, days attended, daily minutes, and real-time Zoom presence.</p>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-black text-gray-500 bg-gray-50 px-3.5 py-1.5 rounded-xl border border-gray-200 shrink-0 self-start md:self-center">
                    <Users size={14} className="text-[#F26522]" />
                    <span>{members.length} Registered Members</span>
                  </div>
                </div>

                {/* Visible Command Action Bar - Guaranteed 100% visible and responsive */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setAttendanceReportInitialSubTab('reports');
                      setActiveTab('attendance-reports');
                    }}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-[#F26522] to-amber-600 hover:from-[#d9561a] hover:to-amber-700 text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-md shadow-[#F26522]/30 transition-all cursor-pointer border border-[#F26522]"
                    title="View Daily Attendance Reports & Unified Roster"
                  >
                    <ClipboardCheck size={16} />
                    <span>Daily Reports</span>
                  </button>

                  <button
                    onClick={() => {
                      setAttendanceReportInitialSubTab('followup');
                      setActiveTab('attendance-reports');
                    }}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-md shadow-rose-600/30 transition-all cursor-pointer border border-rose-500"
                    title="Follow up all absent members with one-click WhatsApp, call, or email"
                  >
                    <HeartHandshake size={16} />
                    <span>Absent Follow-Up</span>
                  </button>

                  <button
                    onClick={() => setShowLiveRosterModal(true)}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-md shadow-emerald-700/30 transition-all cursor-pointer border border-emerald-600"
                    title="View live roster of participants praying in Zoom right now"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Live Zoom ({totalLiveInZoomCount})</span>
                  </button>

                  <button
                    onClick={() => setShowEstherGroupModal(true)}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-800 to-indigo-900 hover:from-purple-900 hover:to-indigo-950 text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-md shadow-purple-900/30 transition-all cursor-pointer border border-purple-400/40"
                    title="View & manage 122 registered Esther Group members"
                  >
                    <Users size={16} className="text-amber-300" />
                    <span>Esther Group (122)</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('zoom-sync')}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-[#1A1F3C] hover:bg-[#282E5C] text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-md shadow-[#1A1F3C]/20 transition-all cursor-pointer border border-gray-700"
                    title="Paste Zoom & WhatsApp attendance records to auto-mark daily prayer attendance"
                  >
                    <CheckCircle2 size={16} className="text-[#F26522]" />
                    <span>Daily Attendance (Zoom & WA)</span>
                  </button>

                  <button 
                    onClick={handleExportCSV}
                    disabled={filteredMembers.length === 0}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer border border-emerald-500"
                    title="Download complete member attendance CSV spreadsheet"
                  >
                    <Download size={16} />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Attendance Community Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-gray-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">Total Members</p>
                    <Users size={18} className="text-[#F26522]" />
                  </div>
                  <p className="text-3xl font-black text-[#1A1F3C]">{members.length}</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-gray-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">Members Live in Zoom</p>
                    <Flame size={18} className="text-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-3xl font-black text-emerald-600">{liveMembersList.length} <span className="text-xs font-bold text-gray-400">Active</span></p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-gray-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">This Year Prayer</p>
                    <Clock size={18} className="text-blue-600" />
                  </div>
                  <p className="text-3xl font-black text-blue-600">{formatMinutesToHours(totalCommunityYearMinutes)}</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-gray-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">Cumulative Prayer</p>
                    <Flame size={18} className="text-[#F26522]" />
                  </div>
                  <p className="text-3xl font-black text-[#1A1F3C]">{formatMinutesToHours(totalCommunityMinutes)}</p>
                </div>
              </div>

              {/* WhatsApp Communities Quick Filter Pills */}
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1.5 text-emerald-800 text-xs font-black uppercase tracking-wider mr-2">
                  <MessageCircle size={15} className="text-emerald-600 shrink-0" />
                  <span>Communities:</span>
                </div>
                <button
                  onClick={() => setCommunityFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    communityFilter === 'all' ? "bg-emerald-700 text-white shadow-sm" : "bg-white text-emerald-900 hover:bg-emerald-100/70 border border-emerald-200"
                  )}
                >
                  All ({members.length})
                </button>
                {dynamicCommunityOptions.map(opt => {
                  const count = members.filter(m => getMemberWhatsAppCommunity(m).toLowerCase().includes(opt.toLowerCase()) || (m.whatsappCommunity || '').toLowerCase().includes(opt.toLowerCase())).length;
                  return (
                    <button
                      key={opt}
                      onClick={() => setCommunityFilter(opt)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        communityFilter === opt ? "bg-emerald-700 text-white shadow-sm" : "bg-white text-emerald-900 hover:bg-emerald-100/70 border border-emerald-200"
                      )}
                    >
                      {opt} ({count})
                    </button>
                  );
                })}
                <button
                  onClick={() => setCommunityFilter('unassigned')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    communityFilter === 'unassigned' ? "bg-emerald-700 text-white shadow-sm" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  )}
                >
                  Unassigned ({members.filter(m => getMemberWhatsAppCommunity(m) === 'Unassigned').length})
                </button>
              </div>

              {/* Member Action Feedback Banner */}
              {memberFeedback && (
                <div 
                  className={cn(
                    "p-4 rounded-2xl flex items-center justify-between text-xs font-black uppercase tracking-wider animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm border",
                    memberFeedback.type === 'success' 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                      : "bg-red-50 text-red-800 border-red-200"
                  )}
                >
                  <div className="flex items-center space-x-2.5">
                    {memberFeedback.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-red-600" />}
                    <span>{memberFeedback.message}</span>
                  </div>
                  <button 
                    onClick={() => setMemberFeedback(null)} 
                    className="p-1 hover:bg-black/5 rounded-lg text-gray-500 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Automatic Duplicate Member Entries Detection Alert Banner */}
              {duplicateMemberClusters.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start space-x-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <CopyX size={20} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-black text-[#1A1F3C]">
                          Automatic Duplicate Member Detection ({duplicateMemberClusters.length} Cluster{duplicateMemberClusters.length > 1 ? 's' : ''})
                        </h4>
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black uppercase rounded-full">
                          {allRedundantDuplicateUids.length} Redundant Account{allRedundantDuplicateUids.length > 1 ? 's' : ''} Found
                        </span>
                      </div>
                      <p className="text-xs text-amber-900/80 mt-1 font-medium leading-relaxed">
                        We detected duplicate registered members sharing exact emails, phone numbers, or full names. You can inspect side-by-side comparisons, merge prayer records, or delete redundant duplicates in one click.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
                    <button
                      onClick={() => setShowDuplicateResolutionModal(true)}
                      className="flex-1 md:flex-initial px-4 py-2.5 bg-[#1A1F3C] hover:bg-[#282E5C] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Layers size={15} className="text-amber-400" />
                      <span>Review & Resolve</span>
                    </button>

                    <button
                      onClick={() => setShowDeleteAllDuplicatesModal(true)}
                      className="flex-1 md:flex-initial px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Trash2 size={15} />
                      <span>Delete All Duplicates ({allRedundantDuplicateUids.length})</span>
                    </button>

                    <button
                      onClick={() => setRoleFilter(roleFilter === 'duplicates' ? 'all' : 'duplicates')}
                      className={cn(
                        "px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer border",
                        roleFilter === 'duplicates'
                          ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                          : "bg-white text-amber-800 border-amber-300 hover:bg-amber-100"
                      )}
                    >
                      <span>{roleFilter === 'duplicates' ? 'Show All Members' : 'Filter Duplicates in Table'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Bulk Action Toolbar */}
              {selectedMemberUids.length > 0 && (
                <div className="bg-[#1A1F3C] text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-xl bg-[#F26522] flex items-center justify-center font-black text-sm">
                      {selectedMemberUids.length}
                    </span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">
                        {selectedMemberUids.length} Member{selectedMemberUids.length > 1 ? 's' : ''} Selected
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Perform administrative actions on selected member accounts
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setSelectedMemberUids([])}
                      className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Deselect All
                    </button>
                    <button
                      onClick={() => setShowBulkDeleteModal(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-md shadow-red-900/40 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>Delete Selected ({selectedMemberUids.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Search & Filter bar */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search by name, email, WhatsApp community, phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#F26522] font-medium transition-all"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={() => setRoleFilter('all')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      roleFilter === 'all' ? "bg-[#1A1F3C] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    All ({members.length})
                  </button>
                  <button
                    onClick={() => setRoleFilter('live')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5",
                      roleFilter === 'live' ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Live in Zoom ({liveMembersList.length})</span>
                  </button>
                  {duplicateMemberClusters.length > 0 && (
                    <button
                      onClick={() => setRoleFilter(roleFilter === 'duplicates' ? 'all' : 'duplicates')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 border",
                        roleFilter === 'duplicates' 
                          ? "bg-amber-600 text-white border-amber-600 shadow-sm" 
                          : "bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-300"
                      )}
                    >
                      <CopyX size={13} className={roleFilter === 'duplicates' ? 'text-white' : 'text-amber-600'} />
                      <span>Duplicates ({allRedundantDuplicateUids.length})</span>
                    </button>
                  )}
                  <select 
                    value={communityFilter}
                    onChange={(e) => setCommunityFilter(e.target.value)}
                    className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 outline-none cursor-pointer"
                  >
                    <option value="all">Filter: All WhatsApp Communities</option>
                    {dynamicCommunityOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option value="unassigned">Unassigned Community</option>
                  </select>
                  <select 
                    value={roleFilter === 'live' ? 'live' : roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#1A1F3C] outline-none cursor-pointer"
                  >
                    <option value="all">Filter: All Roles</option>
                    <option value="member">Members Only</option>
                    {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                    <option value="admin_assistant">Admin Assistant</option>
                  </select>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {loadingMembers ? (
                  <div className="p-16 text-center text-gray-400 space-y-3">
                    <RefreshCw size={32} className="animate-spin mx-auto text-[#F26522]" />
                    <p className="font-bold text-sm">Loading registered members and attendance logs...</p>
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="p-16 text-center space-y-3">
                    <Users size={48} className="mx-auto text-gray-300" />
                    <h4 className="font-black text-[#1A1F3C] text-lg">No Members Found</h4>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                          <th className="p-4 w-10 text-center">
                            <input 
                              type="checkbox"
                              checked={
                                filteredMembers.filter(m => !isAccountProtected(m) && (!user || m.uid !== user.uid)).length > 0 &&
                                selectedMemberUids.length === filteredMembers.filter(m => !isAccountProtected(m) && (!user || m.uid !== user.uid)).length
                              }
                              onChange={handleSelectAllFilteredMembers}
                              className="w-4 h-4 rounded text-[#F26522] focus:ring-[#F26522] cursor-pointer"
                              title="Select / Deselect All Filtered Members"
                            />
                          </th>
                          <th className="p-5">Member</th>
                          <th className="p-5">WhatsApp Community</th>
                          <th className="p-5">Live Presence</th>
                          <th className="p-5">Role</th>
                          <th className="p-5">Days Attended</th>
                          <th className="p-5">Minutes Today</th>
                          <th className="p-5">Minutes This Year</th>
                          <th className="p-5">Total Prayer Time</th>
                          <th className="p-5">Location</th>
                          <th className="p-5 text-right min-w-[240px]">Attendance & Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                        {filteredMembers.map((m) => {
                          const todayDateStr = getTodayDateString();
                          const daysCount = m.attendanceCount || (m.attendanceDaysList?.length || 0);
                          const todayMins = (m.dailyMinutes && m.dailyMinutes[todayDateStr] !== undefined)
                            ? m.dailyMinutes[todayDateStr]
                            : (m.lastAttendedDate === todayDateStr ? (m.todayMinutes || 0) : (m.todayMinutes || 0));
                          const yearMins = m.thisYearMinutes || m.thisWeekMinutes || 0;
                          const totalMins = m.totalMinutes || 0;
                          const isLiveNow = isMemberInZoomNow(m);
                          const memberCommunity = getMemberWhatsAppCommunity(m);
                          const isProtected = isAccountProtected(m);
                          const isSelf = user?.uid === m.uid;
                          const isSelected = selectedMemberUids.includes(m.uid);
                          const duplicateInfo = duplicateMemberClusterMap.get(m.uid);
                          const isRedundantDuplicate = Boolean(duplicateInfo && !duplicateInfo.isPrimary);
                          const canDelete = !isProtected && !isSelf && (isSuperAdmin || m.role === 'member');
                          const isPresentToday = Boolean(
                            (Array.isArray(m.attendanceDaysList) && m.attendanceDaysList.includes(todayDateStr)) ||
                            (m.lastAttendedDate === todayDateStr && (todayMins > 0 || (m.todayMinutes || 0) > 0))
                          );

                          return (
                            <tr key={m.uid} className={cn("transition-colors", isSelected ? "bg-orange-50/40" : (isRedundantDuplicate ? "bg-amber-50/50 hover:bg-amber-100/50" : (isLiveNow ? "bg-emerald-50/40 hover:bg-emerald-50/70" : "hover:bg-gray-50/50")))}>
                              <td className="p-4 text-center">
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectMember(m.uid)}
                                  disabled={!canDelete}
                                  className={cn(
                                    "w-4 h-4 rounded text-[#F26522] focus:ring-[#F26522]",
                                    canDelete ? "cursor-pointer" : "opacity-30 cursor-not-allowed"
                                  )}
                                />
                              </td>
                              <td className="p-5 font-bold text-[#1A1F3C]">
                                <div className="flex items-center space-x-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-full font-black flex items-center justify-center text-xs uppercase shrink-0",
                                    isLiveNow ? "bg-emerald-600 text-white ring-2 ring-emerald-400 animate-pulse" : (isRedundantDuplicate ? "bg-amber-600 text-white" : "bg-[#1A1F3C] text-white")
                                  )}>
                                    {(m.displayName || m.email || 'M').charAt(0)}
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <p className="font-black text-[#1A1F3C]">{m.displayName || 'Member'}</p>
                                      {isProtected && (
                                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black uppercase rounded">
                                          Master
                                        </span>
                                      )}
                                      {isSelf && (
                                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-black uppercase rounded">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] font-mono text-gray-400">{m.email}</p>
                                    {duplicateInfo && (
                                      <div className="mt-1">
                                        {duplicateInfo.isPrimary ? (
                                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-md border border-emerald-200">
                                            <CheckCheck size={11} className="text-emerald-700" />
                                            <span>Primary Record (Keep)</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-rose-100 text-rose-900 text-[9px] font-black rounded-md border border-rose-300">
                                            <CopyX size={11} className="text-rose-700" />
                                            <span>Duplicate ({duplicateInfo.cluster.reason})</span>
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {(m.phone || (m.whatsappGroup && m.whatsappGroup.replace(/\D/g, '').length >= 7)) && (() => {
                                      const rawPhone = m.phone || m.whatsappGroup || '';
                                      const cleanDigits = rawPhone.replace(/\D/g, '');
                                      return (
                                        <div className="flex items-center space-x-2 mt-1">
                                          <span className="text-[10px] font-mono text-emerald-700 flex items-center gap-1 font-bold">
                                            <Phone size={10} />
                                            <span>{rawPhone}</span>
                                          </span>
                                          {cleanDigits.length >= 7 && (
                                            <a
                                              href={`https://wa.me/${cleanDigits}?text=${encodeURIComponent(`Praise God ${m.displayName || 'beloved'}, welcome to Light Up Prayer House! You are registered in ${memberCommunity}. We are adding you to the official WhatsApp prayer cell.`)}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-[#25D366]/15 hover:bg-[#25D366] text-[#128C7E] hover:text-white rounded text-[9px] font-black transition-all"
                                              title="Message / Add on WhatsApp"
                                            >
                                              <MessageCircle size={9} />
                                              <span>Add on WhatsApp</span>
                                            </a>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </td>
                              <td className="p-5">
                                <div className="space-y-1">
                                  <div className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-200">
                                    <MessageCircle size={11} className="text-emerald-600 shrink-0" />
                                    <span>{memberCommunity}</span>
                                  </div>
                                  <div>
                                    <select
                                      value={m.whatsappCommunity || m.whatsappGroupName || ''}
                                      onChange={(e) => handleUpdateMemberCommunity(m.uid, e.target.value)}
                                      className="text-[9px] font-bold text-gray-500 bg-transparent hover:bg-gray-100 px-1 py-0.5 rounded border border-gray-200 outline-none cursor-pointer"
                                      title="Reassign WhatsApp Community"
                                    >
                                      <option value="">(Change Community)</option>
                                      {dynamicCommunityOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </td>
                              <td className="p-5">
                                {isLiveNow ? (
                                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-full ring-2 ring-emerald-400/50 animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span>IN ZOOM NOW</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    Offline
                                  </span>
                                )}
                              </td>
                              <td className="p-5">
                                <select 
                                  value={m.role}
                                  onChange={(e) => handleUpdateUserRole(m.uid, e.target.value as any)}
                                  disabled={!isSuperAdmin}
                                  className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border outline-none",
                                    !isSuperAdmin ? "cursor-default opacity-80" : "cursor-pointer",
                                    m.role === 'super_admin' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                    m.role === 'admin_assistant' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                    "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  )}
                                >
                                  <option value="member">Member</option>
                                  <option value="admin_assistant">Admin Assistant</option>
                                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                                </select>
                              </td>
                              <td className="p-5 font-black text-emerald-600">
                                <div className="flex items-center space-x-1.5">
                                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                  <span>{daysCount} Days</span>
                                </div>
                              </td>
                              <td className="p-5 font-bold text-[#1A1F3C]">
                                <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-mono font-black">
                                  {todayMins} mins
                                </span>
                              </td>
                              <td className="p-5 font-bold text-blue-600">
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-mono font-black">
                                  {yearMins} mins
                                </span>
                              </td>
                              <td className="p-5 font-black text-[#F26522]">
                                {formatMinutesToHours(totalMins)}
                              </td>
                              <td className="p-5 font-medium text-gray-500 text-xs">
                                {m.country || 'International'}
                              </td>
                              <td className="p-5 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  {/* Quick Present / Absent Toggle Buttons Against Name */}
                                  <div className="inline-flex items-center bg-gray-200/80 p-1 rounded-xl space-x-1.5 shrink-0 border border-gray-300 shadow-xs">
                                    <button
                                      type="button"
                                      disabled={togglingMemberUid === m.uid}
                                      onClick={() => handleInlineToggleAttendance(m, 'present')}
                                      className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs",
                                        isPresentToday
                                          ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500 font-black"
                                          : "bg-white text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 border border-emerald-300 font-bold"
                                      )}
                                      title={`Mark ${m.displayName || 'Member'} as Present for today (${todayDateStr})`}
                                    >
                                      <CheckCircle2 size={13} className={isPresentToday ? "text-white" : "text-emerald-600"} />
                                      <span>Present</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={togglingMemberUid === m.uid}
                                      onClick={() => handleInlineToggleAttendance(m, 'absent')}
                                      className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs",
                                        !isPresentToday
                                          ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-500 font-black"
                                          : "bg-white text-rose-800 hover:bg-rose-50 hover:text-rose-900 border border-rose-300 font-bold"
                                      )}
                                      title={`Mark ${m.displayName || 'Member'} as Absent for today (${todayDateStr})`}
                                    >
                                      <XCircle size={13} className={!isPresentToday ? "text-white" : "text-rose-600"} />
                                      <span>Absent</span>
                                    </button>
                                  </div>

                                  {/* Direct Delete Duplicate Button for Redundant Duplicates */}
                                  {duplicateInfo && !duplicateInfo.isPrimary && canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDuplicate(m)}
                                      disabled={duplicateActionLoading === m.uid}
                                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                                      title="Permanently delete this redundant duplicate member entry from database"
                                    >
                                      {duplicateActionLoading === m.uid ? (
                                        <RefreshCw size={12} className="animate-spin" />
                                      ) : (
                                        <Trash2 size={12} />
                                      )}
                                      <span>Delete Duplicate</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => setMemberToDelete(m)}
                                    disabled={!canDelete || deletingMemberUid === m.uid}
                                    className={cn(
                                      "p-2 rounded-xl transition-all inline-flex items-center justify-center",
                                      canDelete
                                        ? "text-red-600 bg-red-50 hover:bg-red-100 hover:scale-105 cursor-pointer shadow-sm"
                                        : "text-gray-300 bg-gray-50 cursor-not-allowed opacity-50"
                                    )}
                                    title={
                                      isProtected 
                                        ? "Master Super Admin cannot be deleted" 
                                        : isSelf 
                                        ? "You cannot delete your own account" 
                                        : !canDelete 
                                        ? "Only Super Admins can delete admin accounts" 
                                        : "Delete Member Account"
                                    }
                                  >
                                    {deletingMemberUid === m.uid ? (
                                      <RefreshCw size={14} className="animate-spin text-red-600" />
                                    ) : (
                                      <Trash2 size={14} />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Single Member Delete Confirmation Modal */}
              {memberToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-white w-full max-w-md rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto">
                      <Trash2 size={28} />
                    </div>

                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black text-[#1A1F3C]">Delete Member Account?</h3>
                      <p className="text-gray-500 text-xs font-medium leading-relaxed">
                        Are you sure you want to permanently delete this member? All associated profile data and attendance history will be completely removed from the database.
                      </p>
                    </div>

                    {/* Member Details Summary Box */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-[#1A1F3C] text-white font-black flex items-center justify-center text-xs uppercase shrink-0">
                          {(memberToDelete.displayName || memberToDelete.email || 'M').charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-[#1A1F3C] text-sm truncate">{memberToDelete.displayName || 'Unnamed Member'}</p>
                          <p className="text-xs font-mono text-gray-500 truncate">{memberToDelete.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 text-xs">
                        <div className="bg-white p-2 rounded-xl border border-gray-100">
                          <span className="text-[10px] font-black uppercase text-gray-400 block">Attendance</span>
                          <span className="font-black text-emerald-600">
                            {memberToDelete.attendanceCount || (memberToDelete.attendanceDaysList?.length || 0)} Days
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-gray-100">
                          <span className="text-[10px] font-black uppercase text-gray-400 block">Prayer Time</span>
                          <span className="font-black text-[#F26522]">
                            {formatMinutesToHours(memberToDelete.totalMinutes || 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setMemberToDelete(null)}
                        disabled={deletingMemberUid === memberToDelete.uid}
                        className="flex-1 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(memberToDelete)}
                        disabled={deletingMemberUid === memberToDelete.uid}
                        className="flex-1 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50"
                      >
                        {deletingMemberUid === memberToDelete.uid ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            <span>Confirm Delete</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bulk Delete Confirmation Modal */}
              {showBulkDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-white w-full max-w-md rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto">
                      <AlertTriangle size={28} />
                    </div>

                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black text-[#1A1F3C]">Delete {selectedMemberUids.length} Selected Members?</h3>
                      <p className="text-gray-500 text-xs font-medium leading-relaxed">
                        This action will permanently delete <span className="font-bold text-[#1A1F3C]">{selectedMemberUids.length} member accounts</span> and their attendance records. Protected master accounts will be skipped automatically.
                      </p>
                    </div>

                    <div className="p-3 bg-red-50 rounded-2xl border border-red-200 text-xs text-red-800 font-medium">
                      ⚠️ <strong className="font-bold">Warning:</strong> This cannot be undone. All prayer attendance, hours, and profile data will be permanently wiped.
                    </div>

                    <div className="flex items-center space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowBulkDeleteModal(false)}
                        disabled={deletingMemberUid === 'bulk'}
                        className="flex-1 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkDeleteMembers}
                        disabled={deletingMemberUid === 'bulk'}
                        className="flex-1 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50"
                      >
                        {deletingMemberUid === 'bulk' ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            <span>Delete All {selectedMemberUids.length}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* DUPLICATE RESOLUTION & CLEANUP CENTER MODAL */}
              {showDuplicateResolutionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                  <div className="bg-white w-full max-w-5xl rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl border border-gray-100 my-8 max-h-[90vh] flex flex-col">
                    {/* Modal Header */}
                    <div className="flex items-start justify-between border-b border-gray-100 pb-5 shrink-0">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                          <CopyX size={24} />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-xl sm:text-2xl font-black text-[#1A1F3C]">Duplicate Resolution & Cleanup Center</h3>
                            <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-xs font-black uppercase rounded-full">
                              {allRedundantDuplicateUids.length} Duplicates Available for Deletion
                            </span>
                          </div>
                          <p className="text-gray-500 text-xs font-medium mt-1">
                            Review duplicate accounts side-by-side. Choose the Primary record to keep, merge prayer logs, or delete duplicates immediately.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setShowDuplicateResolutionModal(false)}
                        className="p-2 text-gray-400 hover:text-[#1A1F3C] hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="text-xs font-black uppercase text-gray-400 mr-2">Filter Match Type:</span>
                      <button
                        onClick={() => setDuplicateClusterFilter('all')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                          duplicateClusterFilter === 'all' ? "bg-[#1A1F3C] text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        All Clusters ({duplicateMemberClusters.length})
                      </button>
                      <button
                        onClick={() => setDuplicateClusterFilter('exact_email')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                          duplicateClusterFilter === 'exact_email' ? "bg-amber-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        Email Matches ({duplicateMemberClusters.filter(c => c.reason.includes('Email')).length})
                      </button>
                      <button
                        onClick={() => setDuplicateClusterFilter('phone')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                          duplicateClusterFilter === 'phone' ? "bg-amber-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        Phone Matches ({duplicateMemberClusters.filter(c => c.reason.includes('Phone')).length})
                      </button>
                      <button
                        onClick={() => setDuplicateClusterFilter('name')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                          duplicateClusterFilter === 'name' ? "bg-amber-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        Name Matches ({duplicateMemberClusters.filter(c => c.reason.includes('Name')).length})
                      </button>
                    </div>

                    {/* Scrollable Cluster Cards */}
                    <div className="space-y-6 overflow-y-auto pr-1 flex-1">
                      {duplicateMemberClusters
                        .filter(c => {
                          if (duplicateClusterFilter === 'exact_email') return c.reason.includes('Email');
                          if (duplicateClusterFilter === 'phone') return c.reason.includes('Phone');
                          if (duplicateClusterFilter === 'name') return c.reason.includes('Name');
                          return true;
                        })
                        .map((cluster, cIdx) => (
                          <div key={cluster.id} className="bg-gray-50/80 border border-amber-200/80 rounded-3xl p-5 space-y-4 shadow-xs">
                            {/* Cluster Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/70 pb-3">
                              <div className="flex items-center space-x-2.5">
                                <span className="px-2.5 py-1 bg-[#1A1F3C] text-white text-[11px] font-black uppercase rounded-lg">
                                  Cluster #{cIdx + 1}
                                </span>
                                <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold rounded-lg flex items-center space-x-1">
                                  <AlertCircle size={12} className="text-amber-700" />
                                  <span>{cluster.reason}</span>
                                </span>
                                {cluster.matchValue && (
                                  <span className="text-xs text-gray-500 font-mono font-medium hidden sm:inline">
                                    "{cluster.matchValue}"
                                  </span>
                                )}
                              </div>

                              <div className="text-xs font-bold text-gray-500">
                                {cluster.members.length} Accounts ({cluster.redundantUids.length} to delete)
                              </div>
                            </div>

                            {/* Side-by-Side Member Comparison Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {cluster.members.map((mem) => {
                                const isPrimary = mem.uid === cluster.primaryUid;
                                const isProtected = isAccountProtected(mem);
                                const isSelf = user?.uid === mem.uid;
                                const canDelete = !isProtected && !isSelf && (isSuperAdmin || mem.role === 'member');
                                const daysCount = mem.attendanceCount || (mem.attendanceDaysList?.length || 0);
                                const totalMins = mem.totalMinutes || 0;
                                const primaryMemberObj = cluster.members.find(m => m.uid === cluster.primaryUid) || cluster.members[0];

                                return (
                                  <div
                                    key={mem.uid}
                                    className={cn(
                                      "p-4 rounded-2xl border-2 transition-all flex flex-col justify-between space-y-3",
                                      isPrimary
                                        ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-400/20"
                                        : "bg-white/80 border-gray-200 hover:border-amber-300"
                                    )}
                                  >
                                    <div className="space-y-3">
                                      {/* Header with Radio to select Primary */}
                                      <div className="flex items-start justify-between gap-2">
                                        <label 
                                          className="flex items-center space-x-2 cursor-pointer"
                                          onClick={() => {
                                            setDuplicateSelectedPrimaryMap(prev => ({ ...prev, [cluster.id]: mem.uid }));
                                          }}
                                        >
                                          <input
                                            type="radio"
                                            name={`primary-${cluster.id}`}
                                            checked={isPrimary}
                                            onChange={() => {
                                              setDuplicateSelectedPrimaryMap(prev => ({ ...prev, [cluster.id]: mem.uid }));
                                            }}
                                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                          />
                                          <span className={cn(
                                            "text-xs font-black uppercase tracking-wider",
                                            isPrimary ? "text-emerald-700" : "text-gray-600 hover:text-black"
                                          )}>
                                            {isPrimary ? '👑 Keep as Primary' : 'Set as Primary'}
                                          </span>
                                        </label>

                                        {isProtected && (
                                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black uppercase rounded">
                                            Master
                                          </span>
                                        )}
                                      </div>

                                      {/* Member info */}
                                      <div className="space-y-1">
                                        <p className="font-black text-sm text-[#1A1F3C] leading-snug">{mem.displayName || 'Unnamed Member'}</p>
                                        <p className="text-xs font-mono text-gray-500 truncate" title={mem.email}>{mem.email || 'No email'}</p>
                                        {mem.phone && (
                                          <p className="text-xs font-mono text-emerald-700 font-bold flex items-center space-x-1">
                                            <Phone size={11} />
                                            <span>{mem.phone}</span>
                                          </p>
                                        )}
                                        <div className="pt-1 flex flex-wrap gap-1">
                                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded">
                                            Role: {mem.role || 'member'}
                                          </span>
                                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded">
                                            {getMemberWhatsAppCommunity(mem)}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Attendance snapshot */}
                                      <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-xl text-center border border-gray-100">
                                        <div>
                                          <span className="text-[9px] font-black uppercase text-gray-400 block">Attendance</span>
                                          <span className="font-black text-xs text-emerald-700">{daysCount} Days</span>
                                        </div>
                                        <div>
                                          <span className="text-[9px] font-black uppercase text-gray-400 block">Prayer Time</span>
                                          <span className="font-black text-xs text-[#F26522]">{formatMinutesToHours(totalMins)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Action buttons for redundant records */}
                                    {!isPrimary && (
                                      <div className="space-y-1.5 pt-2 border-t border-gray-100">
                                        <button
                                          type="button"
                                          disabled={!canDelete || duplicateActionLoading === mem.uid}
                                          onClick={() => handleDeleteDuplicate(mem)}
                                          className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                                          title="Delete this redundant duplicate record directly from database"
                                        >
                                          {duplicateActionLoading === mem.uid ? (
                                            <RefreshCw size={12} className="animate-spin" />
                                          ) : (
                                            <Trash2 size={12} />
                                          )}
                                          <span>Delete Duplicate</span>
                                        </button>

                                        <button
                                          type="button"
                                          disabled={!canDelete || duplicateActionLoading === `merge-${mem.uid}`}
                                          onClick={() => handleMergeAndDeleteDuplicate(mem, primaryMemberObj)}
                                          className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                                          title="Transfer attendance days & minutes to primary account, then delete duplicate"
                                        >
                                          {duplicateActionLoading === `merge-${mem.uid}` ? (
                                            <RefreshCw size={12} className="animate-spin" />
                                          ) : (
                                            <GitMerge size={12} />
                                          )}
                                          <span>Merge & Delete</span>
                                        </button>
                                      </div>
                                    )}

                                    {isPrimary && (
                                      <div className="pt-2 border-t border-emerald-100 text-center">
                                        <span className="text-[11px] font-black text-emerald-700 uppercase flex items-center justify-center space-x-1">
                                          <CheckCheck size={14} />
                                          <span>Preserved Master Profile</span>
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Modal Footer */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-100 pt-5 shrink-0">
                      <div className="text-xs text-gray-500 font-medium">
                        Showing <strong className="text-[#1A1F3C] font-black">{duplicateMemberClusters.length} duplicate clusters</strong> containing <strong className="text-rose-600 font-black">{allRedundantDuplicateUids.length} redundant accounts</strong> available for deletion.
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={() => setShowDeleteAllDuplicatesModal(true)}
                          disabled={allRedundantDuplicateUids.length === 0 || duplicateActionLoading === 'all-redundant'}
                          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          <span>Delete All {allRedundantDuplicateUids.length} Duplicates</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowDuplicateResolutionModal(false)}
                          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Close / Done
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DELETE ALL DUPLICATES CONFIRMATION MODAL */}
              {showDeleteAllDuplicatesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-white w-full max-w-md rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                      <CopyX size={28} />
                    </div>

                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black text-[#1A1F3C]">Delete All {allRedundantDuplicateUids.length} Redundant Duplicates?</h3>
                      <p className="text-gray-500 text-xs font-medium leading-relaxed">
                        This action will permanently delete <span className="font-bold text-rose-600">{allRedundantDuplicateUids.length} redundant duplicate accounts</span> across all {duplicateMemberClusters.length} detected clusters.
                      </p>
                    </div>

                    <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 font-medium space-y-1">
                      <p className="font-bold flex items-center space-x-1 text-amber-950">
                        <CheckCheck size={14} className="text-emerald-600" />
                        <span>Preserved Records:</span>
                      </p>
                      <p className="text-[11px] text-amber-800">
                        All primary member records, master administrator accounts, and historical attendance logs are safeguarded.
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteAllDuplicatesModal(false)}
                        disabled={duplicateActionLoading === 'all-redundant'}
                        className="flex-1 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={handleDeleteAllRedundantDuplicates}
                        disabled={duplicateActionLoading === 'all-redundant'}
                        className="flex-1 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
                      >
                        {duplicateActionLoading === 'all-redundant' ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Deleting Duplicates...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            <span>Confirm & Delete</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ATTENDANCE HUB (DAILY REPORTS & ABSENT FOLLOW-UP) */}
          {activeTab === 'attendance-reports' && (
            <DailyAttendanceReport 
              members={members} 
              onRefreshMembers={() => {}} 
              initialSubTab={attendanceReportInitialSubTab}
              initialDate={attendanceReportTargetDate}
            />
          )}

          {/* ZOOM CSV IMPORT TOOL */}
          {activeTab === 'zoom-sync' && (
            <div className="space-y-6">
              <ZoomAttendanceSync 
                members={members} 
                onRefreshMembers={() => {}} 
                onNavigateToReports={(targetDate, subTab = 'reports') => {
                  if (targetDate) setAttendanceReportTargetDate(targetDate);
                  setAttendanceReportInitialSubTab(subTab);
                  setActiveTab('attendance-reports');
                }}
              />
            </div>
          )}

          {/* GUEST / UNREGISTERED ZOOM LOGS TAB */}
          {activeTab === 'guests' && (
            <div className="space-y-8">
              {/* Header bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-[#1A1F3C] flex items-center space-x-2">
                    <Video className="text-[#F26522]" size={28} />
                    <span>Non-Registered / Guest Zoom Attendance Logs</span>
                  </h3>
                  <p className="text-gray-500 text-sm font-medium">
                    Live record of non-registered visitors logging into Zoom prayer meetings. Visitors are recognized across visits without duplication.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setActiveTab('zoom-sync')}
                    className="flex items-center justify-center space-x-2 px-5 py-3.5 bg-[#1A1F3C] hover:bg-[#282E5C] text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all cursor-pointer"
                  >
                    <Upload size={15} className="text-[#F26522]" />
                    <span>Import Zoom CSV</span>
                  </button>
                  <button
                    onClick={() => setShowLiveRosterModal(true)}
                    className="flex items-center justify-center space-x-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
                    <span>Live Zoom Room ({totalLiveInZoomCount})</span>
                  </button>
                  <button 
                    onClick={() => {
                      setLoadingGuests(true);
                      setTimeout(() => setLoadingGuests(false), 500);
                    }}
                    className="flex items-center justify-center space-x-2 px-4 py-3.5 bg-gray-100 text-[#1A1F3C] rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all cursor-pointer"
                    title="Refresh live guest logs"
                  >
                    <RefreshCw size={15} className={loadingGuests ? "animate-spin text-[#F26522]" : ""} />
                    <span>Refresh</span>
                  </button>
                  <button 
                    onClick={handleExportGuestCSV}
                    disabled={filteredGuestRecords.length === 0}
                    className="flex items-center justify-center space-x-2 px-6 py-3.5 bg-[#F26522] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#d9561a] shadow-lg shadow-[#F26522]/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Download size={16} />
                    <span>Download Guest CSV</span>
                  </button>
                </div>
              </div>

              {/* Attendance Community Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-gray-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">Recognized Visitors</p>
                    <Video size={18} className="text-[#F26522]" />
                  </div>
                  <p className="text-3xl font-black text-[#1A1F3C]">{guestRecords.length}</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-gray-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">Visitors Live in Zoom</p>
                    <Flame size={18} className="text-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-3xl font-black text-emerald-600">{liveGuestsList.length} <span className="text-xs font-bold text-gray-400">Active</span></p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-gray-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">Guest Prayer Time</p>
                    <Clock size={18} className="text-blue-600" />
                  </div>
                  <p className="text-3xl font-black text-blue-600">{formatMinutesToHours(totalGuestMinutes)}</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-gray-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">Unique Devices/IPs</p>
                    <Smartphone size={18} className="text-purple-600" />
                  </div>
                  <p className="text-3xl font-black text-[#1A1F3C]">{totalUniqueGuestDevices}</p>
                </div>
              </div>

              {/* Search & Filter bar */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search by Name, Phone, Guest ID, device, or date..."
                    value={guestSearchQuery}
                    onChange={(e) => setGuestSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#F26522] font-medium transition-all"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={() => setGuestStatusFilter('all')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      guestStatusFilter === 'all' ? "bg-[#1A1F3C] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    All Visitors ({guestRecords.length})
                  </button>
                  <button
                    onClick={() => setGuestStatusFilter('active')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5",
                      guestStatusFilter === 'active' ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Live in Zoom ({liveGuestsList.length})</span>
                  </button>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Time:</span>
                    <select 
                      value={guestDateFilter}
                      onChange={(e) => setGuestDateFilter(e.target.value as any)}
                      className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#1A1F3C] outline-none cursor-pointer"
                    >
                      <option value="all">All History</option>
                      <option value="today">Today Only</option>
                      <option value="year">This Year ({new Date().getFullYear()})</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Guests Table */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {loadingGuests ? (
                  <div className="p-16 text-center text-gray-400 space-y-3">
                    <RefreshCw size={32} className="animate-spin mx-auto text-[#F26522]" />
                    <p className="font-bold text-sm">Loading guest Zoom logs...</p>
                  </div>
                ) : filteredGuestRecords.length === 0 ? (
                  <div className="p-16 text-center space-y-3">
                    <Video size={48} className="mx-auto text-gray-300" />
                    <p className="font-bold text-gray-500 text-base">No non-registered visitor records match your search query.</p>
                    <p className="text-xs text-gray-400">Visitor attendance records update live automatically as visitors log into Zoom.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                          <th className="p-5">Visitor Name & Details</th>
                          <th className="p-5">Live Presence</th>
                          <th className="p-5">Today's Prayer Time</th>
                          <th className="p-5">Yearly Cumulative Time</th>
                          <th className="p-5">Device / Platform</th>
                          <th className="p-5">Last Active</th>
                          <th className="p-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                        {filteredGuestRecords.map((g) => {
                          const todaySecs = g.todaySeconds || 0;
                          const todayMins = g.todayMinutes || Math.floor(todaySecs / 60);
                          const yearlySecs = g.yearlySeconds || g.totalSeconds || 0;
                          const yearlyMins = g.yearlyMinutes || g.totalMinutes || Math.floor(yearlySecs / 60);
                          const isLiveNow = isGuestInZoomNow(g);

                          return (
                            <tr key={g.id} className={cn("transition-colors", isLiveNow ? "bg-emerald-50/40 hover:bg-emerald-50/70" : "hover:bg-gray-50/50")}>
                              <td className="p-5 font-bold text-[#1A1F3C]">
                                <div className="flex items-center space-x-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-full font-black flex items-center justify-center text-xs uppercase shrink-0 border",
                                    isLiveNow ? "bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400 animate-pulse" : "bg-amber-500/10 text-amber-700 border-amber-200"
                                  )}>
                                    {g.guestName ? g.guestName.charAt(0).toUpperCase() : 'G'}
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <p className="font-black text-[#1A1F3C]">{g.guestName || 'Anonymous Guest'}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-gray-400 font-mono">{g.guestId}</span>
                                      {g.guestPhone && (
                                        <div className="flex items-center text-[10px] text-[#F26522] font-bold">
                                          <Phone size={10} className="mr-1" />
                                          {g.guestPhone}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-5">
                                {isLiveNow ? (
                                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-full ring-2 ring-emerald-400/50 animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span>IN ZOOM NOW</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider rounded-full">
                                    <CheckCircle2 size={12} className="text-gray-400" />
                                    <span>Offline</span>
                                  </span>
                                )}
                              </td>
                              <td className="p-5">
                                {todaySecs > 0 ? (
                                  <div className="space-y-0.5">
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-mono font-black inline-block">
                                      {todayMins > 0 ? `${todayMins} mins (${todaySecs}s)` : `${todaySecs} seconds`}
                                    </span>
                                    <p className="text-[10px] text-gray-400">Resets daily / session</p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 font-medium">
                                    0 mins <span className="text-[10px] text-gray-400 block">(Awaiting session)</span>
                                  </span>
                                )}
                              </td>
                              <td className="p-5">
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl text-xs font-mono font-black inline-flex items-center space-x-1">
                                  <Clock size={12} className="mr-1 text-blue-500" />
                                  <span>{formatMinutesToHours(yearlyMins)}</span>
                                  <span className="text-[10px] text-blue-400 font-normal">({yearlyMins}m)</span>
                                </span>
                              </td>
                              <td className="p-5 font-medium text-gray-600 text-xs">
                                <div className="flex items-center space-x-1.5">
                                  <Smartphone size={14} className="text-gray-400" />
                                  <span>{g.deviceInfo || 'Web Browser'}</span>
                                </div>
                              </td>
                              <td className="p-5 text-xs text-gray-500 font-medium">
                                <p className="font-bold text-gray-700">{g.lastDateStr || g.dateStr || 'Today'}</p>
                                <p className="text-gray-400 text-[10px]">
                                  {g.lastActiveAt?.toDate ? g.lastActiveAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                                </p>
                              </td>
                              <td className="p-5 text-right">
                                <button 
                                  onClick={() => handleDeleteGuestRecord(g.id)}
                                  className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                  title="Delete visitor profile"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WHATSAPP TRACKING & REFERRAL ANALYTICS TAB */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-[#1A1F3C] flex items-center space-x-2">
                    <MessageCircle className="text-[#25D366]" size={28} />
                    <span>WhatsApp Community & Referral Link Analytics</span>
                  </h3>
                  <p className="text-gray-500 text-sm font-medium">
                    Track members joining via WhatsApp invite links, manage official regional WhatsApp group URLs, and monitor referrals.
                  </p>
                </div>

                <a
                  href={generateWhatsAppShareUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-md shrink-0"
                >
                  <Share2 size={16} />
                  <span>Share App on WhatsApp</span>
                </a>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-[#25D366]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Group Clicks</span>
                    <MessageCircle size={20} />
                  </div>
                  <p className="text-3xl font-black text-[#1A1F3C]">
                    {whatsappConfig.totalClicks || whatsappJoinsList.length}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400">Joins logged via app links</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-[#F26522]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">WhatsApp Members</span>
                    <Phone size={20} />
                  </div>
                  <p className="text-3xl font-black text-[#1A1F3C]">
                    {members.filter(m => m.whatsappGroup).length}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400">Members with phone logged</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-blue-600">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">WhatsApp Referrals</span>
                    <Globe size={20} />
                  </div>
                  <p className="text-3xl font-black text-[#1A1F3C]">
                    {members.filter(m => m.trafficSource === 'WhatsApp').length || whatsappJoinsList.filter(j => j.source.includes('Referral')).length}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400">Arrived via ?source=whatsapp</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-purple-600">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Regional Groups</span>
                    <Users size={20} />
                  </div>
                  <p className="text-3xl font-black text-[#1A1F3C]">4</p>
                  <p className="text-[10px] font-bold text-gray-400">West Africa, USA, UK, Global</p>
                </div>
              </div>

              {/* Configure WhatsApp Group URLs Form */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <h4 className="text-lg font-black text-[#1A1F3C]">Regional WhatsApp Prayer Cells & Admin Assignment</h4>
                    <p className="text-xs text-gray-500 font-medium">Public direct joining is disabled. New members register their WhatsApp number and are added by Admin to their assigned prayer cell.</p>
                  </div>
                  {whatsappSavedMessage && (
                    <span className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-1.5 animate-fade-in">
                      <CheckCircle2 size={16} />
                      <span>{whatsappSavedMessage}</span>
                    </span>
                  )}
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-3 text-xs text-emerald-900 font-medium">
                  <ShieldCheck size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                  <p>
                    <strong>Admin Workflow:</strong> When new members register on the site, their phone number and selected regional cell appear in the <strong>Members</strong> tab above. Click <em>"Add on WhatsApp"</em> next to any member's phone number or use the group links below to manually place them into the official WhatsApp cell.
                  </p>
                </div>

                <form onSubmit={handleSaveWhatsappUrls} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-[#25D366]"></span>
                        <span>Esther’s Group (Benin) Link</span>
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="url"
                          placeholder="https://chat.whatsapp.com/..."
                          value={whatsappEstherBeninUrl}
                          onChange={(e) => setWhatsappEstherBeninUrl(e.target.value)}
                          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-medium outline-none focus:ring-2 focus:ring-[#25D366]"
                        />
                        <a
                          href={whatsappEstherBeninUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center"
                          title="Test Link"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>King David’s Group (Lagos) Link</span>
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="url"
                          placeholder="https://chat.whatsapp.com/..."
                          value={whatsappKingDavidLagosUrl}
                          onChange={(e) => setWhatsappKingDavidLagosUrl(e.target.value)}
                          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-medium outline-none focus:ring-2 focus:ring-[#25D366]"
                        />
                        <a
                          href={whatsappKingDavidLagosUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center"
                          title="Test Link"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Joyful Group (Abuja) Link</span>
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="url"
                          placeholder="https://chat.whatsapp.com/..."
                          value={whatsappJoyfulAbujaUrl}
                          onChange={(e) => setWhatsappJoyfulAbujaUrl(e.target.value)}
                          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-medium outline-none focus:ring-2 focus:ring-[#25D366]"
                        />
                        <a
                          href={whatsappJoyfulAbujaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center"
                          title="Test Link"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        <span>Grace Group (Asaba) Group Link</span>
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="url"
                          placeholder="https://chat.whatsapp.com/..."
                          value={whatsappGraceAsabaUrl}
                          onChange={(e) => setWhatsappGraceAsabaUrl(e.target.value)}
                          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-medium outline-none focus:ring-2 focus:ring-[#25D366]"
                        />
                        <a
                          href={whatsappGraceAsabaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center"
                          title="Test Link"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>Global / International Community Link</span>
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="url"
                          placeholder="https://chat.whatsapp.com/..."
                          value={whatsappGlobalUrl}
                          onChange={(e) => setWhatsappGlobalUrl(e.target.value)}
                          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-medium outline-none focus:ring-2 focus:ring-[#25D366]"
                        />
                        <a
                          href={whatsappGlobalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center"
                          title="Test Link"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingWhatsappConfig}
                      className="px-8 py-3.5 bg-[#1A1F3C] text-white hover:bg-[#252b4d] rounded-xl font-black text-xs uppercase tracking-wider flex items-center space-x-2 transition-all shadow-md disabled:opacity-50"
                    >
                      <Save size={16} />
                      <span>{savingWhatsappConfig ? 'Saving Links...' : 'Save WhatsApp Group Links'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Recent WhatsApp Joins Activity Log */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-4 p-8">
                <div>
                  <h4 className="text-lg font-black text-[#1A1F3C]">Recent WhatsApp Group Clicks & Joins Log</h4>
                  <p className="text-xs text-gray-500 font-medium">Real-time record of members and guests clicking through to join WhatsApp groups.</p>
                </div>

                {whatsappJoinsList.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 space-y-2 bg-gray-50 rounded-2xl">
                    <MessageCircle size={36} className="mx-auto text-gray-300" />
                    <p className="font-bold text-sm">No WhatsApp group clicks recorded yet.</p>
                    <p className="text-xs">When users click "Join Group" on the website, their activity will be listed here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                          <th className="p-4">Visitor / Member</th>
                          <th className="p-4">Email</th>
                          <th className="p-4">WhatsApp Group</th>
                          <th className="p-4">Traffic Source</th>
                          <th className="p-4">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {whatsappJoinsList.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="p-4 font-black text-[#1A1F3C]">{log.userName}</td>
                            <td className="p-4 text-gray-600 font-medium">{log.userEmail}</td>
                            <td className="p-4">
                              <span className="px-3 py-1 bg-[#25D366]/10 text-[#25D366] rounded-full font-bold text-[11px] inline-flex items-center space-x-1">
                                <MessageCircle size={12} />
                                <span>{log.groupName}</span>
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                log.source?.includes('Referral')
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {log.source}
                              </span>
                            </td>
                            <td className="p-4 text-gray-500 font-medium">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SITE BRANDING & LOGO TAB */}
          {activeTab === 'branding' && (
            <div className="space-y-8">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 rounded-2xl bg-[#F26522]/10 text-[#F26522] flex items-center justify-center font-bold">
                    <Palette size={22} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-[#1A1F3C]">Logo & Website Branding</h3>
                    <p className="text-gray-500 text-sm font-medium">
                      Customize the official logo, church name, and tagline displayed across the website header, footer, and mobile app.
                    </p>
                  </div>
                </div>
              </div>

              {brandingSavedMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center space-x-3 animate-fade-in">
                  <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
                  <span className="font-bold text-sm">{brandingSavedMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Form Controls */}
                <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                  <form onSubmit={handleSaveBranding} className="space-y-6">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
                        1. Select or Upload New Logo Image
                      </label>
                      <div className="space-y-4">
                        {/* File Upload Option */}
                        <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl text-center hover:bg-gray-100/80 transition-all">
                          <input 
                            type="file" 
                            id="logo-upload-input" 
                            accept="image/*" 
                            onChange={handleLogoFileUpload}
                            className="hidden" 
                          />
                          <label 
                            htmlFor="logo-upload-input" 
                            className="cursor-pointer inline-flex items-center space-x-2 px-5 py-2.5 bg-white text-[#1A1F3C] border border-gray-200 hover:border-[#F26522] rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all"
                          >
                            <Upload size={16} className="text-[#F26522]" />
                            <span>Upload Custom Logo File</span>
                          </label>
                          <p className="text-[11px] text-gray-400 mt-2 font-medium">
                            Upload PNG, JPG, or WEBP from your phone or PC (Max 3MB)
                          </p>
                        </div>

                        {/* Image URL Input */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                            Or Enter Direct Image URL
                          </label>
                          <div className="relative">
                            <ImageIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                              type="text" 
                              value={logoInput} 
                              onChange={(e) => setLogoInput(e.target.value)}
                              placeholder="e.g. https://example.com/my-logo.png or /logo.jpg"
                              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F26522]/20 focus:border-[#F26522]"
                            />
                          </div>
                        </div>

                        {/* Preset Logos */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                            Quick Select Preset Logos
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            <button
                              type="button"
                              onClick={() => setLogoInput('/logo.jpg')}
                              className={cn(
                                "p-3 rounded-xl border text-left flex items-center space-x-2 transition-all",
                                logoInput === '/logo.jpg' ? "border-[#F26522] bg-[#F26522]/5 ring-2 ring-[#F26522]/20" : "border-gray-200 hover:bg-gray-50"
                              )}
                            >
                              <img src="/logo.jpg" alt="Default Logo" className="w-8 h-8 rounded-full object-cover shrink-0 border" />
                              <div className="overflow-hidden">
                                <p className="font-bold text-xs truncate">Original Logo</p>
                                <p className="text-[10px] text-gray-400">Default</p>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setLogoInput('/icon-192.png')}
                              className={cn(
                                "p-3 rounded-xl border text-left flex items-center space-x-2 transition-all",
                                logoInput === '/icon-192.png' ? "border-[#F26522] bg-[#F26522]/5 ring-2 ring-[#F26522]/20" : "border-gray-200 hover:bg-gray-50"
                              )}
                            >
                              <img src="/icon-192.png" alt="Flame Icon" className="w-8 h-8 rounded-full object-cover shrink-0 border" />
                              <div className="overflow-hidden">
                                <p className="font-bold text-xs truncate">Flame Icon</p>
                                <p className="text-[10px] text-gray-400">App Emblem</p>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setLogoInput('/logo.png')}
                              className={cn(
                                "p-3 rounded-xl border text-left flex items-center space-x-2 transition-all",
                                logoInput === '/logo.png' ? "border-[#F26522] bg-[#F26522]/5 ring-2 ring-[#F26522]/20" : "border-gray-200 hover:bg-gray-50"
                              )}
                            >
                              <img src="/logo.png" alt="Clean Logo" className="w-8 h-8 rounded-full object-cover shrink-0 border" />
                              <div className="overflow-hidden">
                                <p className="font-bold text-xs truncate">Clean Emblem</p>
                                <p className="text-[10px] text-gray-400">PNG</p>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Site Title */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1">
                        2. Organization / Church Name
                      </label>
                      <input 
                        type="text" 
                        value={siteNameInput} 
                        onChange={(e) => setSiteNameInput(e.target.value)}
                        placeholder="LIGHT UP PRAYER HOUSE"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-[#1A1F3C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F26522]/20 focus:border-[#F26522]"
                      />
                    </div>

                    {/* Tagline */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1">
                        3. Tagline / Subtitle
                      </label>
                      <input 
                        type="text" 
                        value={taglineInput} 
                        onChange={(e) => setTaglineInput(e.target.value)}
                        placeholder="Family Outreach"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F26522]/20 focus:border-[#F26522]"
                      />
                    </div>

                    {/* Action button */}
                    <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={savingBranding}
                        className="w-full sm:w-auto px-8 py-3.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-2 transition-all shadow-lg shadow-[#F26522]/20 disabled:opacity-50"
                      >
                        <Save size={16} />
                        <span>{savingBranding ? 'Updating Branding...' : 'Save Logo & Site Branding'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Live Previews */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-wider text-[#1A1F3C] flex items-center space-x-2">
                      <Sparkles size={16} className="text-[#F26522]" />
                      <span>Real-time Live Previews</span>
                    </h4>
                    <p className="text-xs text-gray-500 font-medium">
                      Here is how your logo and branding will look across header navigation, footer, and mobile screens.
                    </p>

                    {/* Navbar Header Preview */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">1. Navigation Bar Preview</span>
                      <div className="bg-[#1A1F3C] p-4 rounded-2xl text-white flex items-center space-x-3 border border-white/10 shadow-inner">
                        <div className="bg-white p-0.5 rounded-full overflow-hidden w-10 h-10 flex items-center justify-center shrink-0">
                          <img 
                            src={logoInput || '/logo.jpg'} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/logo.jpg'; }}
                          />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="font-bold text-sm leading-tight truncate">{siteNameInput || 'LIGHT UP PRAYER HOUSE'}</span>
                          <span className="text-[9px] text-gray-300 uppercase tracking-widest truncate">{taglineInput || 'Family Outreach'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Preview */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">2. Footer Preview</span>
                      <div className="bg-[#1A1F3C]/90 p-5 rounded-2xl text-white space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-white p-0.5 shrink-0 flex items-center justify-center">
                            <img 
                              src={logoInput || '/logo.jpg'} 
                              alt="Preview" 
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = '/logo.jpg'; }}
                            />
                          </div>
                          <span className="font-bold text-base leading-tight truncate">{siteNameInput || 'LIGHT UP PRAYER HOUSE'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile App Badge Preview */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">3. Mobile Home Screen App Icon</span>
                      <div className="bg-gray-100 p-4 rounded-2xl flex items-center space-x-4 border border-gray-200">
                        <div className="w-14 h-14 rounded-2xl bg-white p-1 shadow-md border overflow-hidden flex items-center justify-center shrink-0">
                          <img 
                            src={logoInput || '/logo.jpg'} 
                            alt="Preview" 
                            className="w-full h-full object-cover rounded-xl"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/logo.jpg'; }}
                          />
                        </div>
                        <div>
                          <p className="font-extrabold text-sm text-[#1A1F3C]">{siteNameInput || 'Light Up'}</p>
                          <p className="text-xs text-gray-500">Installed Web App Icon</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'themes' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-[#1A1F3C]">Weekly Themes Management</h3>
                  <p className="text-gray-500 text-sm font-medium">Create, edit, or select the active theme displayed across the entire website.</p>
                </div>
                <button
                  onClick={() => {
                    resetThemeForm();
                    setShowThemeModal(true);
                  }}
                  className="flex items-center justify-center space-x-2 px-6 py-3.5 bg-[#F26522] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#d9561a] shadow-lg shadow-[#F26522]/20 transition-all shrink-0 cursor-pointer"
                >
                  <Plus size={18} />
                  <span>Add New Theme</span>
                </button>
              </div>

              {themeSuccessMsg && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-3 text-emerald-700 text-sm font-bold animate-in fade-in">
                  <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
                  <span>{themeSuccessMsg}</span>
                </div>
              )}

              {themeErrorMsg && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center space-x-3 text-red-700 text-sm font-bold animate-in fade-in">
                  <X size={20} className="shrink-0 text-red-600" />
                  <span>{themeErrorMsg}</span>
                </div>
              )}

              {/* Theme Modal */}
              {showThemeModal && (
                <div 
                  onClick={() => setShowThemeModal(false)}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
                >
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-gray-100 my-8 cursor-default max-h-[90vh] overflow-y-auto"
                  >
                    <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                      <h4 className="text-xl font-black text-[#1A1F3C] uppercase">
                        {editingThemeId ? 'Edit Weekly Theme' : 'Create Weekly Theme'}
                      </h4>
                      <button onClick={() => setShowThemeModal(false)} className="p-2 text-gray-400 hover:text-gray-600 cursor-pointer">
                        <X size={20} />
                      </button>
                    </div>

                    {themeErrorMsg && (
                      <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold">
                        {themeErrorMsg}
                      </div>
                    )}

                    <form onSubmit={handleSaveTheme} className="space-y-4">
                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Theme Title *</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. THE ASSIGNMENT OF GOD IN MY LIFE"
                          value={themeTitle}
                          onChange={(e) => setThemeTitle(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Scripture Focus *</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Jeremiah 1:5, Proverbs 3:5-6"
                          value={themeScripture}
                          onChange={(e) => setThemeScripture(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                          Ministering Minister(s) / Speaker
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Pastor Osaro Aghedo & other Anointed Ministers of God"
                          value={themeMinister}
                          onChange={(e) => setThemeMinister(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                        />
                        <span className="text-[10px] text-gray-400 font-medium">This name appears under the "MINISTERING" section on the website.</span>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                          Week Dates Range (Schedule) *
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. August 17 – 21, 2026"
                          value={themeDates}
                          onChange={(e) => setThemeDates(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                        />
                        <span className="text-[10px] text-gray-400 font-medium">This date appears with the calendar icon for the weekly theme.</span>
                      </div>

                      {/* Theme Flyer Image Selection / Upload */}
                      <div className="space-y-2">
                        <label className="block text-xs font-black uppercase text-gray-400">
                          Theme Flyer Image (Upload from Phone/PC or Select Preset)
                        </label>
                        
                        <div className="flex items-center space-x-3">
                          <label className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer border border-dashed border-gray-300 transition-colors">
                            <Upload size={14} className="text-[#F26522]" />
                            <span>Upload Flyer File</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleThemeFileUpload} 
                              className="hidden" 
                            />
                          </label>
                        </div>

                        {/* Image Preview & URL input */}
                        <div className="flex items-center space-x-3 pt-1">
                          <div className="w-16 h-12 rounded-lg bg-gray-900 overflow-hidden shrink-0 border">
                            <img 
                              src={themeImageUrl || '/theme_assignment.jpg'} 
                              alt="Theme Preview" 
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = '/theme_assignment.jpg'; }}
                            />
                          </div>
                          <input 
                            type="text" 
                            placeholder="Image URL or Base64"
                            value={themeImageUrl}
                            onChange={(e) => setThemeImageUrl(e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-50 rounded-xl text-xs font-mono border outline-none focus:ring-2 focus:ring-[#F26522]"
                          />
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setThemeImageUrl('/theme_assignment.jpg')}
                            className="text-[10px] font-bold px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
                          >
                            Preset 1 (Assignment)
                          </button>
                          <button
                            type="button"
                            onClick={() => setThemeImageUrl('/theme_greatness.jpg')}
                            className="text-[10px] font-bold px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
                          >
                            Preset 2 (Greatness)
                          </button>
                          <button
                            type="button"
                            onClick={() => setThemeImageUrl('/theme_fire.jpg')}
                            className="text-[10px] font-bold px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
                          >
                            Preset 3 (Fire)
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Prayer Points (1 per line)</label>
                        <textarea 
                          rows={3}
                          placeholder="Discovery of divine assignment&#10;Grace for fulfillment&#10;Strategic direction"
                          value={themePrayerPoints}
                          onChange={(e) => setThemePrayerPoints(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                        />
                      </div>

                      <div className="flex items-center space-x-3 pt-2">
                        <input 
                          type="checkbox" 
                          id="setAsCurrent"
                          checked={themeIsCurrent}
                          onChange={(e) => setThemeIsCurrent(e.target.checked)}
                          className="w-5 h-5 text-[#F26522] rounded accent-[#F26522] cursor-pointer"
                        />
                        <label htmlFor="setAsCurrent" className="text-xs font-black text-[#1A1F3C] cursor-pointer">
                          Set as Active Current Theme for Website
                        </label>
                      </div>

                      <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setShowThemeModal(false)}
                          className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs cursor-pointer hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingTheme}
                          className="px-6 py-3 bg-[#F26522] text-white rounded-xl font-black uppercase text-xs hover:bg-[#d9561a] cursor-pointer shadow-lg shadow-[#F26522]/20 disabled:opacity-50"
                        >
                          {savingTheme ? 'Saving...' : (editingThemeId ? 'Update Weekly Theme' : 'Save & Publish Theme')}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Themes List Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {themes.map((theme) => (
                  <div 
                    key={theme.id}
                    className={cn(
                      "bg-white rounded-3xl p-6 border shadow-sm space-y-4 relative transition-all",
                      theme.isCurrent ? "border-2 border-[#F26522] shadow-xl ring-2 ring-[#F26522]/20" : "border-gray-100"
                    )}
                  >
                    {theme.isCurrent ? (
                      <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#F26522] text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-md">
                        <Flame size={12} />
                        <span>Active Website Theme</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">
                        Past / Upcoming Theme
                      </span>
                    )}

                    <div className="aspect-[16/9] relative rounded-2xl overflow-hidden bg-gray-900 border border-gray-100">
                      <img 
                        src={theme.imageUrl || '/theme_assignment.jpg'} 
                        alt={theme.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/theme_assignment.jpg'; }}
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{theme.dates}</span>
                        <h4 className="text-xl font-black text-[#1A1F3C] uppercase leading-snug">{theme.title}</h4>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => openEditTheme(theme)}
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs cursor-pointer"
                          title="Edit Theme"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteTheme(theme.id)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs cursor-pointer"
                          title="Delete Theme"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-2xl space-y-2 border border-gray-100">
                      <div className="flex items-center space-x-2 text-xs font-black text-[#F26522] uppercase tracking-wider">
                        <BookOpen size={14} />
                        <span>Scripture Reference</span>
                      </div>
                      <p className="text-sm font-serif italic font-bold text-gray-700">"{theme.scripture}"</p>
                    </div>

                    {theme.prayerPoints && theme.prayerPoints.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prayer Focus:</p>
                        <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                          {theme.prayerPoints.map((pt, i) => (
                            <li key={i} className="font-medium">{pt}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="pt-2 flex justify-between items-center border-t border-gray-100">
                      <span className="text-xs font-bold text-gray-400">{theme.minister}</span>
                      {!theme.isCurrent ? (
                        <button
                          onClick={() => handleSetCurrentTheme(theme.id)}
                          className="px-4 py-2 bg-[#1A1F3C] text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-[#F26522] transition-all cursor-pointer shadow"
                        >
                          Set as Active Theme
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center space-x-1">
                          <CheckCircle2 size={14} />
                          <span>Currently Displayed</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UPCOMING PROGRAMS TAB */}
          {activeTab === 'programs' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-2xl font-black text-[#1A1F3C]">Programs & Revival Rallies</h3>
                  <p className="text-gray-500 text-sm font-medium">Manage flyers, themes, dates, times, and venue details for church programs.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleLoadSampleFlyers}
                    className="px-5 py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 transition-all cursor-pointer shadow-sm"
                    title="Load or restore Back to Eden series rally flyers"
                  >
                    <Sparkles size={16} className="text-[#F26522]" />
                    <span>Load Back to Eden Flyers</span>
                  </button>

                  {programs.some(p => isProgramExpired(p.date)) && (
                    <button
                      onClick={promptClearExpiredPrograms}
                      disabled={clearingExpired}
                      className="px-5 py-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 transition-all cursor-pointer shadow-sm"
                      title="Permanently remove all past/expired programs from the database"
                    >
                      {clearingExpired ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} className="text-red-600" />
                      )}
                      <span>
                        {clearingExpired 
                          ? 'Deleting...' 
                          : `Delete All Expired (${programs.filter(p => isProgramExpired(p.date)).length})`}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      resetProgramForm();
                      setShowProgramModal(true);
                    }}
                    className="px-6 py-3 bg-[#F26522] text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 hover:bg-[#d9561a] transition-all shadow-lg cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Add New Program</span>
                  </button>
                </div>
              </div>

              {/* Status Note Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-700">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <p>
                    <strong className="text-[#1A1F3C]">Program Flyers Display:</strong> Program flyers remain fully visible, accessible, and previewable on the dashboard. Click on any flyer to inspect in full HD.
                  </p>
                </div>
                {programs.some(p => isProgramExpired(p.date)) && (
                  <span className="font-bold text-amber-700 shrink-0">
                    {programs.filter(p => isProgramExpired(p.date)).length} past program(s) available for management
                  </span>
                )}
              </div>

              {/* Programs Filter Bar */}
              {programs.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAdminProgramFilter('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      adminProgramFilter === 'all'
                        ? 'bg-[#1A1F3C] text-white shadow-sm'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    All ({programs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminProgramFilter('upcoming')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      adminProgramFilter === 'upcoming'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                    }`}
                  >
                    Active Upcoming ({programs.filter(p => !isProgramExpired(p.date)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminProgramFilter('expired')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      adminProgramFilter === 'expired'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
                    }`}
                  >
                    Past / Expired ({programs.filter(p => isProgramExpired(p.date)).length})
                  </button>
                </div>
              )}

              {/* Feedback Message Banner */}
              {programFeedback && (
                <div className={`p-4 rounded-2xl flex items-center justify-between transition-all ${
                  programFeedback.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <div className="flex items-center space-x-2 text-sm font-bold">
                    {programFeedback.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-red-600" />}
                    <span>{programFeedback.message}</span>
                  </div>
                  <button 
                    onClick={() => setProgramFeedback(null)}
                    className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Program Edit/Add Modal */}
              {showProgramModal && (
                <div 
                  onClick={() => setShowProgramModal(false)}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
                >
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-gray-100 space-y-6 my-8 cursor-default max-h-[92vh] overflow-y-auto"
                  >
                    <div className="flex justify-between items-start border-b pb-4">
                      <div>
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#F26522]/10 text-[#F26522] text-[10px] font-black uppercase tracking-widest mb-1">
                          <Sparkles size={12} />
                          <span>{editingProgramId ? 'Update Event' : 'New Program Announcement'}</span>
                        </div>
                        <h4 className="text-xl sm:text-2xl font-black text-[#1A1F3C]">
                          {editingProgramId ? 'Edit Program / Rally' : 'Publish Upcoming Program'}
                        </h4>
                        <p className="text-gray-500 text-xs font-medium mt-0.5">
                          Set the date, venue, details, and upload the official event flyer for display on Home & Schedule.
                        </p>
                      </div>
                      <button 
                        onClick={() => setShowProgramModal(false)} 
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                        title="Close"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Quick Preset Buttons (Only when creating new) */}
                    {!editingProgramId && (
                      <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/60 space-y-2">
                        <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider flex items-center space-x-1">
                          <Sparkles size={12} className="text-[#F26522]" />
                          <span>Quick Fill Templates:</span>
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {[
                            {
                              title: 'Lagos Edition',
                              series: 'Back to Eden',
                              theme: 'Restoration & Renewal',
                              date: 'September 12, 2026',
                              time: '11:00 AM – 3:00 PM',
                              location: 'Abule Odo, Lagos',
                              imageUrl: '/flyer_lagos.jpg',
                              description: 'Special revival service and prayer program in Abule Odo, Lagos.'
                            },
                            {
                              title: 'Edo State Edition',
                              series: 'Back to Eden',
                              theme: 'Edo State for Christ',
                              date: 'September 18, 2026',
                              time: '3:00 PM – 5:30 PM',
                              location: 'Airport Road, Benin City',
                              imageUrl: '/flyer_edo.jpg',
                              description: 'Edo State apostolic revival rally.'
                            },
                            {
                              title: 'Asaba Edition',
                              series: 'Back to Eden',
                              theme: 'Return. Restore. Reign.',
                              date: 'September 25, 2026',
                              time: '4:00 PM Prompt',
                              location: 'Koka, Asaba',
                              imageUrl: '/flyer_asaba.jpg',
                              description: 'Anointed gathering for deliverance, restoration, and kingdom reign.'
                            },
                            {
                              title: 'National Fire Vigil',
                              series: 'Apostolic Power Night',
                              theme: 'Let The Fire Fall',
                              date: 'October 2, 2026',
                              time: '10:00 PM – 4:00 AM',
                              location: 'Light Up Prayer Center & Online Global Zoom',
                              imageUrl: '/theme_fire.jpg',
                              description: 'Intensive all-night prayer and prophetic deliverance service.'
                            }
                          ].map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setProgramTitle(preset.title);
                                setProgramSeries(preset.series);
                                setProgramTheme(preset.theme);
                                setProgramDate(preset.date);
                                setProgramTime(preset.time);
                                setProgramLocation(preset.location);
                                setProgramImageUrl(preset.imageUrl);
                                setProgramDescription(preset.description);
                                setProgramModalError(null);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-[#1A1F3C] text-gray-700 hover:text-white border border-amber-200 rounded-lg text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                            >
                              + {preset.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Modal Error Alert Banner */}
                    {programModalError && (
                      <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-2xl flex items-start space-x-3 text-xs font-bold animate-fade-in">
                        <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="leading-relaxed">{programModalError}</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setProgramModalError(null)} 
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleSaveProgram} className="space-y-5">
                      {/* Title & Series */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black uppercase text-gray-500 mb-1">
                            Program Title / Edition <span className="text-red-500">*</span>
                          </label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. Lagos Edition, National Youth Convention"
                            value={programTitle}
                            onChange={(e) => {
                              setProgramTitle(e.target.value);
                              if (programModalError) setProgramModalError(null);
                            }}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522] focus:bg-white transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black uppercase text-gray-500 mb-1">
                            Program Series
                          </label>
                          <input 
                            type="text" 
                            placeholder="e.g. Back to Eden, Revival 2026"
                            value={programSeries}
                            onChange={(e) => setProgramSeries(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522] focus:bg-white transition-all"
                          />
                        </div>
                      </div>

                      {/* Theme Slogan */}
                      <div>
                        <label className="block text-xs font-black uppercase text-gray-500 mb-1">
                          Program Theme / Slogan
                        </label>
                        <input 
                          type="text" 
                          placeholder="e.g. Restoration & Renewal, Let Fire Fall"
                          value={programTheme}
                          onChange={(e) => setProgramTheme(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522] focus:bg-white transition-all"
                        />
                      </div>

                      {/* Date & Date Picker Helper */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="block text-xs font-black uppercase text-[#1A1F3C]">
                            Program Date <span className="text-red-500">*</span>
                          </label>
                          
                          {/* Live Expiration / Upcoming Status Badge */}
                          {programDate.trim() && (
                            !isProgramExpired(programDate) ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 w-max">
                                <Sparkles size={12} className="text-emerald-600" />
                                <span>Active Upcoming Event (Will Show on Home & Schedule)</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 w-max">
                                <AlertTriangle size={12} className="text-amber-600" />
                                <span>Past Date (Marked as Concluded)</span>
                              </span>
                            )
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                          <div className="sm:col-span-2">
                            <input 
                              type="text" 
                              required
                              placeholder="e.g. September 15, 2026 or Sept 15 – 18, 2026"
                              value={programDate}
                              onChange={(e) => {
                                setProgramDate(e.target.value);
                                if (programModalError) setProgramModalError(null);
                              }}
                              className="w-full px-4 py-3 bg-white rounded-xl text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522] transition-all"
                            />
                          </div>

                          {/* Quick HTML Date Picker */}
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 sm:hidden">
                              Pick from Calendar
                            </label>
                            <input 
                              type="date" 
                              title="Pick date from calendar"
                              onChange={(e) => {
                                if (e.target.value) {
                                  const [year, month, day] = e.target.value.split('-');
                                  const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                  const formatted = parsed.toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                  });
                                  setProgramDate(formatted);
                                  if (programModalError) setProgramModalError(null);
                                }
                              }}
                              className="w-full px-3 py-2.5 bg-white rounded-xl text-xs font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522] cursor-pointer"
                            />
                          </div>
                        </div>

                        <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                          You can type exact date ranges like <span className="font-mono font-bold text-[#1A1F3C]">September 15 – 18, 2026</span> or choose a date from the calendar.
                        </p>
                      </div>

                      {/* Time & Venue */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black uppercase text-gray-500 mb-1">
                            Program Time
                          </label>
                          <input 
                            type="text" 
                            placeholder="e.g. 11:00 AM – 3:00 PM WAT"
                            value={programTime}
                            onChange={(e) => setProgramTime(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522] focus:bg-white transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black uppercase text-gray-500 mb-1">
                            Venue / Location
                          </label>
                          <input 
                            type="text" 
                            placeholder="e.g. Abule Odo, Lagos or Zoom Live"
                            value={programLocation}
                            onChange={(e) => setProgramLocation(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522] focus:bg-white transition-all"
                          />
                        </div>
                      </div>

                      {/* FLYER IMAGE UPLOAD & SELECTION SECTION */}
                      <div className="p-5 bg-orange-50/40 rounded-2xl border border-orange-200/80 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="block text-xs font-black uppercase text-[#1A1F3C] flex items-center space-x-1.5">
                            <ImageIcon size={14} className="text-[#F26522]" />
                            <span>Program Flyer Graphic</span>
                          </label>
                          <span className="text-[11px] text-gray-500 font-medium">PNG, JPG, WEBP (Auto-optimized)</span>
                        </div>

                        {/* File Upload Box */}
                        <div>
                          <input 
                            type="file" 
                            id="admin-program-flyer-file"
                            accept="image/png,image/jpeg,image/webp,image/jpg"
                            onChange={handleProgramImageUpload}
                            className="hidden"
                          />
                          <label
                            htmlFor="admin-program-flyer-file"
                            className="w-full border-2 border-dashed border-orange-300 hover:border-[#F26522] bg-white hover:bg-orange-50/30 p-5 rounded-2xl flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all shadow-xs text-center group"
                          >
                            {uploadingProgramFlyer ? (
                              <div className="flex items-center space-x-2 text-[#F26522] font-bold text-xs">
                                <RefreshCw size={20} className="animate-spin" />
                                <span>Compressing & uploading flyer image...</span>
                              </div>
                            ) : (
                              <>
                                <div className="w-12 h-12 rounded-2xl bg-[#F26522]/10 group-hover:bg-[#F26522] group-hover:text-white text-[#F26522] flex items-center justify-center transition-colors">
                                  <ImagePlus size={24} />
                                </div>
                                <div>
                                  <span className="text-xs font-black text-[#1A1F3C] group-hover:text-[#F26522] block">
                                    Click or Tap to Upload Flyer From Device
                                  </span>
                                  <span className="text-[11px] text-gray-400 font-medium">
                                    Select photo from your phone gallery, computer, or camera
                                  </span>
                                </div>
                              </>
                            )}
                          </label>
                        </div>

                        {/* Current Flyer Preview */}
                        {programImageUrl && (
                          <div className="flex items-center space-x-4 bg-white p-3 rounded-2xl border border-gray-200">
                            <div className="w-16 h-20 bg-slate-900 rounded-xl overflow-hidden shadow-inner shrink-0 relative">
                              <img 
                                src={programImageUrl} 
                                alt="Flyer preview" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/flyer_lagos.jpg';
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded tracking-wider">
                                Flyer Selected
                              </span>
                              <p className="text-xs font-bold text-[#1A1F3C] truncate">
                                {programImageUrl.startsWith('data:') ? 'Custom Uploaded Image (Compressed Base64)' : programImageUrl}
                              </p>
                              <div className="flex items-center space-x-2 pt-1">
                                <label 
                                  htmlFor="admin-program-flyer-file"
                                  className="text-[11px] font-black text-[#F26522] hover:underline cursor-pointer"
                                >
                                  Upload Different Image
                                </label>
                                <span className="text-gray-300">•</span>
                                <button
                                  type="button"
                                  onClick={() => setProgramImageUrl('/flyer_lagos.jpg')}
                                  className="text-[11px] font-bold text-gray-500 hover:text-red-600 cursor-pointer"
                                >
                                  Reset to Default
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Preset Flyers Bar */}
                        <div className="space-y-2 pt-1">
                          <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider block">
                            Or Choose from Bundled Rally Flyers:
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { label: 'Lagos Flyer', url: '/flyer_lagos.jpg' },
                              { label: 'Edo Crusade', url: '/flyer_edo.jpg' },
                              { label: 'Asaba Flyer', url: '/flyer_asaba.jpg' },
                              { label: 'Theme Flyer', url: '/theme_assignment.jpg' }
                            ].map((preset, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => setProgramImageUrl(preset.url)}
                                className={`p-2 rounded-xl text-left border text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                                  programImageUrl === preset.url
                                    ? 'bg-[#1A1F3C] text-white border-[#1A1F3C] shadow-sm'
                                    : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-200'
                                }`}
                              >
                                <span className="w-2 h-2 rounded-full bg-[#F26522] shrink-0"></span>
                                <span className="truncate">{preset.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Direct URL Input */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                            Or Direct Image URL (Web Link)
                          </label>
                          <input 
                            type="text" 
                            placeholder="e.g. https://... or /flyer_lagos.jpg"
                            value={programImageUrl}
                            onChange={(e) => setProgramImageUrl(e.target.value)}
                            className="w-full px-3 py-2 bg-white rounded-xl text-xs font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522]"
                          />
                        </div>
                      </div>

                      {/* Video / Broadcast URL */}
                      <div>
                        <label className="block text-xs font-black uppercase text-gray-500 mb-1 flex items-center space-x-1.5">
                          <Video size={14} className="text-[#F26522]" />
                          <span>Video / Live Broadcast URL (Optional)</span>
                        </label>
                        <input 
                          type="url" 
                          placeholder="e.g. https://www.youtube.com/watch?v=... or direct MP4 link"
                          value={programVideoUrl}
                          onChange={(e) => setProgramVideoUrl(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522] focus:bg-white transition-all"
                        />
                        <p className="text-[11px] text-gray-400 mt-1 font-medium">
                          Add a YouTube video recording link or direct MP4 stream for this program.
                        </p>
                      </div>

                      {/* Description / Notes */}
                      <div>
                        <label className="block text-xs font-black uppercase text-gray-500 mb-1">
                          Description / Program Details
                        </label>
                        <textarea 
                          rows={3}
                          placeholder="Details about the revival service, ministers, prayer focus, special instructions..."
                          value={programDescription}
                          onChange={(e) => setProgramDescription(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-[#F26522] focus:bg-white transition-all"
                        />
                      </div>

                      {/* Website Visibility Toggle */}
                      <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start space-x-3">
                        <input 
                          type="checkbox"
                          id="program-always-visible"
                          checked={programAlwaysVisible}
                          onChange={(e) => setProgramAlwaysVisible(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-[#F26522] rounded accent-[#F26522] cursor-pointer"
                        />
                        <label htmlFor="program-always-visible" className="cursor-pointer">
                          <span className="block text-xs font-black text-emerald-950">
                            Show Flyer on Website Immediately (Active & Featured)
                          </span>
                          <span className="block text-[11px] text-emerald-700 font-medium leading-relaxed">
                            Keep this flyer prominently visible on the homepage and schedule even if the program date has passed or is recurring.
                          </span>
                        </label>
                      </div>

                      {/* Modal Footer Controls */}
                      <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setShowProgramModal(false)}
                          className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingProgram || uploadingProgramFlyer}
                          className="px-8 py-3.5 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-lg shadow-[#F26522]/30 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
                        >
                          {savingProgram ? (
                            <>
                              <RefreshCw size={16} className="animate-spin" />
                              <span>Saving to Database...</span>
                            </>
                          ) : (
                            <>
                              <Check size={16} />
                              <span>{editingProgramId ? 'Update Program' : 'Publish Program Flyer'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Program List Grid */}
              {(() => {
                const displayedPrograms = programs.filter(p => {
                  if (adminProgramFilter === 'upcoming') return !isProgramExpired(p.date, p.isAlwaysVisible);
                  if (adminProgramFilter === 'expired') return isProgramExpired(p.date, p.isAlwaysVisible);
                  return true;
                });

                if (displayedPrograms.length === 0) {
                  return (
                    <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 space-y-4 shadow-sm">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-400">
                        <Calendar size={32} />
                      </div>
                      <h4 className="text-xl font-black text-[#1A1F3C]">
                        {adminProgramFilter === 'upcoming' 
                          ? 'No Active Upcoming Programs' 
                          : adminProgramFilter === 'expired' 
                          ? 'No Past / Expired Programs' 
                          : 'No Programs Listed'}
                      </h4>
                      <p className="text-gray-500 text-sm max-w-md mx-auto">
                        {adminProgramFilter === 'upcoming' 
                          ? 'You do not have any future upcoming programs scheduled. You can add a new program or load the official Back to Eden rally flyers.'
                          : adminProgramFilter === 'expired'
                          ? 'Great! There are no past/expired programs remaining in your database.'
                          : 'There are currently no programs in the database. Add a new program or quickly load the Back to Eden flyers.'}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        {adminProgramFilter !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setAdminProgramFilter('all')}
                            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer"
                          >
                            <span>Show All Programs</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            resetProgramForm();
                            setShowProgramModal(true);
                          }}
                          className="inline-flex items-center space-x-2 px-6 py-3 bg-[#F26522] text-white font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer hover:bg-[#d9561a] shadow-md"
                        >
                          <Plus size={16} />
                          <span>Create New Program</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleLoadSampleFlyers}
                          className="inline-flex items-center space-x-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer shadow-md"
                        >
                          <Sparkles size={16} />
                          <span>Load Back to Eden Flyers</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayedPrograms.map((program) => {
                      const expired = isProgramExpired(program.date, program.isAlwaysVisible);
                      const isDeleting = deletingProgramId === program.id;
                      const flyerData: FlyerModalData = {
                        title: program.title,
                        imageUrl: program.imageUrl || '/flyer_lagos.jpg',
                        dates: program.date,
                        theme: program.theme,
                        location: program.location,
                        scripture: program.description,
                        videoUrl: program.videoUrl
                      };

                      return (
                        <div 
                          key={program.id}
                          className={`bg-white rounded-3xl p-6 border shadow-sm space-y-4 flex flex-col justify-between transition-all ${
                            expired ? 'border-amber-300 ring-2 ring-amber-400/20' : 'border-gray-100'
                          } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <div className="space-y-4">
                            {/* Interactive Program Flyer Box with Full HD Preview Trigger */}
                            <div 
                              onClick={() => setSelectedFlyerModal(flyerData)}
                              className="aspect-[4/3] relative rounded-2xl overflow-hidden bg-gray-900 group cursor-pointer shadow-inner"
                              title="Click to view full HD flyer"
                            >
                              <img 
                                src={program.imageUrl || '/flyer_lagos.jpg'} 
                                alt={program.title}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/flyer_lagos.jpg';
                                }}
                              />

                              {/* Hover View Badge */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="px-4 py-2 bg-white text-[#1A1F3C] rounded-xl text-xs font-black uppercase tracking-wider shadow-2xl flex items-center space-x-2">
                                  <Maximize2 size={14} className="text-[#F26522]" />
                                  <span>View Full Flyer</span>
                                </span>
                              </div>

                              <div className="absolute top-3 left-3 flex flex-col gap-1">
                                {expired ? (
                                  <span className="px-3 py-1 bg-amber-500 text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center space-x-1">
                                    <AlertTriangle size={12} />
                                    <span>Past / Expired</span>
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center space-x-1">
                                    <CheckCircle2 size={12} />
                                    <span>Active Upcoming</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black text-[#F26522] uppercase tracking-widest">{program.series || 'Back to Eden'}</span>
                                {expired ? (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black rounded uppercase">
                                    Hidden from Upcoming
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded uppercase">
                                    Visible on Website
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xl font-black text-[#1A1F3C]">{program.title}</h4>
                              {program.theme && <p className="text-xs font-bold italic text-gray-500">{program.theme}</p>}
                            </div>

                            <div className="space-y-1.5 text-xs font-bold text-gray-600 border-t pt-3">
                              <p className="flex items-center space-x-2">
                                <Calendar size={14} className="text-[#F26522]" />
                                <span className={expired ? 'line-through text-gray-400' : 'text-gray-800 font-bold'}>{program.date}</span>
                                {expired && <span className="text-amber-600 font-bold text-[10px]">(Past date)</span>}
                              </p>
                              {program.time && (
                                <p className="flex items-center space-x-2">
                                  <Clock size={14} className="text-[#F26522]" />
                                  <span>{program.time}</span>
                                </p>
                              )}
                              {program.location && (
                                <p className="flex items-center space-x-2">
                                  <MapPin size={14} className="text-[#F26522]" />
                                  <span className="line-clamp-1">{program.location}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                            <button
                              onClick={() => setSelectedFlyerModal(flyerData)}
                              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                              title="Preview full size flyer"
                            >
                              <Maximize2 size={13} className="text-[#F26522]" />
                              <span>View Flyer</span>
                            </button>

                            <div className="flex space-x-2 ml-auto">
                              <button
                                onClick={() => openEditProgram(program)}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                              >
                                <Edit3 size={14} />
                                <span>{expired ? 'Update Date' : 'Edit'}</span>
                              </button>
                              <button
                                onClick={() => promptDeleteProgram(program)}
                                disabled={isDeleting}
                                title="Delete Program Permanently"
                                className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50 transition-colors"
                              >
                                {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Full HD Flyer Preview Lightbox Modal */}
              <FlyerModal
                isOpen={!!selectedFlyerModal}
                onClose={() => setSelectedFlyerModal(null)}
                flyer={selectedFlyerModal}
              />

              {/* In-App Confirmation Modal: Delete Individual Program */}
              {programToDelete && (
                <div 
                  onClick={() => setProgramToDelete(null)}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
                >
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6 cursor-default"
                  >
                    <div className="flex items-center space-x-3 text-red-600">
                      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                        <Trash2 size={24} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-[#1A1F3C]">Delete Program?</h4>
                        <p className="text-xs text-gray-500 font-medium">This action cannot be undone.</p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center space-x-4">
                      <img 
                        src={programToDelete.imageUrl || '/flyer_lagos.jpg'} 
                        alt={programToDelete.title}
                        className="w-14 h-14 object-cover rounded-xl shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/flyer_lagos.jpg'; }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-[#1A1F3C] text-sm truncate">{programToDelete.title}</p>
                        <p className="text-xs text-gray-500 font-medium">{programToDelete.date || 'No date set'}</p>
                        {programToDelete.location && (
                          <p className="text-[11px] text-gray-400 font-medium truncate">{programToDelete.location}</p>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                      Are you sure you want to permanently remove <strong className="text-[#1A1F3C]">"{programToDelete.title}"</strong> from the database and church schedule?
                    </p>

                    <div className="flex items-center justify-end space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setProgramToDelete(null)}
                        className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => executeDeleteProgram(programToDelete)}
                        disabled={deletingProgramId === programToDelete.id}
                        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-red-600/20 cursor-pointer disabled:opacity-50 transition-all"
                      >
                        {deletingProgramId === programToDelete.id ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            <span>Yes, Delete</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* In-App Confirmation Modal: Delete All Expired Programs */}
              {showClearExpiredModal && (
                <div 
                  onClick={() => setShowClearExpiredModal(false)}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
                >
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6 cursor-default"
                  >
                    <div className="flex items-center space-x-3 text-red-600">
                      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-[#1A1F3C]">Clear All Past Programs?</h4>
                        <p className="text-xs text-gray-500 font-medium">Bulk cleanup action</p>
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 font-medium space-y-2">
                      <p className="font-bold">
                        {programs.filter(p => isProgramExpired(p.date)).length} past/expired program(s) will be permanently deleted from the database:
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-amber-800 text-[11px]">
                        {programs.filter(p => isProgramExpired(p.date)).map(p => (
                          <li key={p.id} className="font-semibold">
                            {p.title} ({p.date})
                          </li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                      This will remove all outdated flyers and past dates completely, keeping your schedule clean and up to date.
                    </p>

                    <div className="flex items-center justify-end space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowClearExpiredModal(false)}
                        className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={executeClearAllExpiredPrograms}
                        disabled={clearingExpired}
                        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-red-600/20 cursor-pointer disabled:opacity-50 transition-all"
                      >
                        {clearingExpired ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Deleting All...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            <span>Yes, Delete All Expired</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-10">
              {/* Live Status Highlight */}
              <div className="bg-[#1A1F3C] text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10">
                <div className="flex items-center space-x-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner shrink-0",
                    totalLiveInZoomCount > 0 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-gray-800 text-gray-400 border border-gray-700"
                  )}>
                    {totalLiveInZoomCount > 0 ? <Flame className="animate-pulse text-emerald-400" size={24} /> : <Video size={24} />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-black text-white">Live Zoom Attendance Monitor</h4>
                      <span className={cn(
                        "px-3 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full border",
                        totalLiveInZoomCount > 0 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse" 
                          : "bg-gray-800 text-gray-400 border-gray-700"
                      )}>
                        {totalLiveInZoomCount > 0 ? `${totalLiveInZoomCount} LIVE ATTENDEES` : 'OFFLINE'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 font-medium mt-0.5">
                      {totalLiveInZoomCount > 0 
                        ? `Currently tracking ${liveGuestsList.length} non-registered visitor(s) and ${liveMembersList.length} registered member(s) in Zoom.`
                        : "Real-time presence updates automatically whenever visitors or members join the Zoom prayer call."}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowLiveRosterModal(true)}
                  className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center space-x-2 cursor-pointer"
                >
                  <Users size={16} />
                  <span>View Live Roster ({totalLiveInZoomCount})</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Live in Zoom Now", value: totalLiveInZoomCount.toString(), trend: `${liveGuestsList.length} Guests + ${liveMembersList.length} Mem`, icon: Flame, color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Registered Members", value: members.length.toString(), trend: "+Live", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "Recognized Visitors", value: guestRecords.length.toString(), trend: "Tracked", icon: Video, color: "text-[#F26522]", bg: "bg-orange-50" },
                  { label: "Submitted Testimonies", value: testimonies.length.toString(), trend: "Firestore", icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-50" },
                ].map((stat, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className={cn("p-3 rounded-2xl", stat.bg, stat.color)}>
                        <stat.icon size={24} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{stat.trend}</span>
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">{stat.label}</p>
                      <p className="text-3xl font-black text-[#1A1F3C]">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TESTIMONIES MODERATION TAB */}
          {activeTab === 'moderation' && (
            <div className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-2xl font-black text-[#1A1F3C]">Testimonies & Prayer Moderation</h3>
                  <p className="text-gray-500 text-sm font-medium">Review, approve, or reject user testimonies submitted on the website.</p>
                </div>
              </div>

              {testimonies.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 space-y-2">
                  <MessageSquare size={40} className="mx-auto text-gray-300" />
                  <p className="font-bold text-[#1A1F3C]">No Testimonies Submitted Yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {testimonies.map((item) => (
                    <div key={item.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                            item.status === 'approved' ? "bg-emerald-100 text-emerald-700" :
                            item.status === 'declined' ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          )}>
                            {item.status || 'pending'}
                          </span>
                        </div>
                        <h4 className="font-black text-[#1A1F3C] text-lg">{item.name}</h4>
                        <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl italic">"{item.text}"</p>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <button 
                          onClick={() => handleUpdateTestimonyStatus(item.id, 'approved')}
                          className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center space-x-1"
                        >
                          <Check size={16} />
                          <span>Approve</span>
                        </button>
                        <button 
                          onClick={() => handleUpdateTestimonyStatus(item.id, 'declined')}
                          className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl text-xs font-bold flex items-center space-x-1"
                        >
                          <X size={16} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MEDIA ARCHIVE TAB */}
          {activeTab === 'media' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-[#F26522]/10 text-[#F26522] text-[10px] font-black uppercase tracking-widest rounded-full">
                      Media Center Control
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-[#1A1F3C] mt-1">Spiritual Teachings & Media Archive</h3>
                  <p className="text-gray-500 text-xs font-medium">
                    Manage video teachings, audio sermons, and message links shown on the public Media page.
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <a 
                    href="/media" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                  >
                    <ExternalLink size={14} />
                    <span>View Public Page</span>
                  </a>
                  <button
                    onClick={openNewSermonModal}
                    className="px-5 py-2.5 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#d9561a] transition-all flex items-center space-x-2 shadow-lg shadow-[#F26522]/20"
                  >
                    <Plus size={16} />
                    <span>Add New Sermon / Teaching</span>
                  </button>
                </div>
              </div>

              {sermonSuccessMsg && (
                <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center space-x-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{sermonSuccessMsg}</span>
                </div>
              )}

              {/* Add/Edit Sermon Modal */}
              {showSermonModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                  <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                      <div>
                        <h4 className="text-xl font-black text-[#1A1F3C]">
                          {editingSermonId ? 'Edit Sermon / Teaching' : 'Add New Sermon / Teaching'}
                        </h4>
                        <p className="text-xs text-gray-400 font-medium">Publish real sermon recordings to the public media center.</p>
                      </div>
                      <button 
                        onClick={() => setShowSermonModal(false)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {sermonErrorMsg && (
                      <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200">
                        {sermonErrorMsg}
                      </div>
                    )}

                    <form onSubmit={handleSaveSermon} className="space-y-4">
                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Teaching / Sermon Title *</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Walking in Divine Purpose, The Fire That Never Goes Out"
                          value={sermonTitle}
                          onChange={(e) => setSermonTitle(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black uppercase text-gray-400 mb-1">Minister / Speaker *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. Pastor Osaro Aghedo"
                            value={sermonMinister}
                            onChange={(e) => setSermonMinister(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black uppercase text-gray-400 mb-1">Media Format *</label>
                          <select
                            value={sermonType}
                            onChange={(e) => setSermonType(e.target.value as 'video' | 'audio')}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                          >
                            <option value="video">Video Teaching / Broadcast</option>
                            <option value="audio">Audio Message / Podcast</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black uppercase text-gray-400 mb-1">Date Preached / Recorded</label>
                          <input 
                            type="text" 
                            placeholder="e.g. August 23, 2026"
                            value={sermonDate}
                            onChange={(e) => setSermonDate(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black uppercase text-gray-400 mb-1">Estimated Duration</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 1 hr 15 mins, 45 mins"
                            value={sermonDuration}
                            onChange={(e) => setSermonDuration(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                          Media Stream / Recording Link (YouTube URL, MP3 link, or Podcast stream)
                        </label>
                        <input 
                          type="text" 
                          placeholder="e.g. https://www.youtube.com/watch?v=... or https://example.com/sermon.mp3"
                          value={sermonMediaUrl}
                          onChange={(e) => setSermonMediaUrl(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                        />
                        <span className="text-[10px] text-gray-400 font-medium">
                          YouTube links embed directly in the media player. Audio MP3 links stream right on the website.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Scripture Reference</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Jeremiah 1:5, Leviticus 6:13, Romans 12:11"
                          value={sermonScripture}
                          onChange={(e) => setSermonScripture(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                        />
                      </div>

                      {/* Thumbnail Image Selection / Upload */}
                      <div className="space-y-2">
                        <label className="block text-xs font-black uppercase text-gray-400">
                          Sermon Cover Flyer / Thumbnail (Upload or Image URL)
                        </label>
                        
                        <div className="flex items-center space-x-3">
                          <label className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer border border-dashed border-gray-300 transition-colors">
                            <Upload size={14} className="text-[#F26522]" />
                            <span>Upload Thumbnail File</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleSermonThumbnailUpload} 
                              className="hidden" 
                            />
                          </label>
                        </div>

                        <div className="flex items-center space-x-3 pt-1">
                          <div className="w-16 h-12 rounded-lg bg-gray-900 overflow-hidden shrink-0 border">
                            <img 
                              src={sermonThumbnailUrl} 
                              alt="Thumbnail Preview" 
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1490161705155-d28c4210e9c1?auto=format&fit=crop&q=80'; }}
                            />
                          </div>
                          <input 
                            type="text" 
                            placeholder="Thumbnail Image URL"
                            value={sermonThumbnailUrl}
                            onChange={(e) => setSermonThumbnailUrl(e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-50 rounded-xl text-xs font-mono border outline-none focus:ring-2 focus:ring-[#F26522]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Teaching Summary / Description</label>
                        <textarea 
                          rows={3}
                          placeholder="Brief summary of spiritual insights covered in this teaching..."
                          value={sermonDescription}
                          onChange={(e) => setSermonDescription(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                        />
                      </div>

                      <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setShowSermonModal(false)}
                          className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingSermon}
                          className="px-6 py-3 bg-[#F26522] text-white rounded-xl font-black uppercase text-xs hover:bg-[#d9561a] shadow-lg shadow-[#F26522]/20 disabled:opacity-50"
                        >
                          {savingSermon ? 'Saving...' : (editingSermonId ? 'Update Teaching' : 'Publish to Media Center')}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Sermons List Table / Grid */}
              {loadingSermons ? (
                <div className="py-12 text-center text-gray-400 text-xs font-bold">
                  Loading sermon archive...
                </div>
              ) : sermonsList.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 space-y-4">
                  <Video size={40} className="mx-auto text-gray-300" />
                  <h4 className="font-black text-[#1A1F3C]">No Teachings in Media Archive</h4>
                  <p className="text-gray-400 text-xs max-w-sm mx-auto">
                    Click the "+ Add New Sermon / Teaching" button above to upload your first message recording.
                  </p>
                  <button
                    onClick={openNewSermonModal}
                    className="px-5 py-2.5 bg-[#F26522] text-white rounded-xl text-xs font-bold"
                  >
                    Add Teaching Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sermonsList.map((sermon) => (
                    <div 
                      key={sermon.id}
                      className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="aspect-video relative rounded-2xl overflow-hidden bg-gray-900 border">
                          <img 
                            src={sermon.thumbnailUrl} 
                            alt={sermon.title}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1490161705155-d28c4210e9c1?auto=format&fit=crop&q=80'; }}
                          />
                          <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded text-[9px] font-black uppercase tracking-widest text-white">
                            {sermon.type}
                          </div>
                          {sermon.duration && (
                            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-gray-200">
                              {sermon.duration}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-[#F26522] uppercase tracking-widest">{sermon.date}</span>
                            {sermon.scripture && (
                              <span className="text-[10px] text-gray-400 font-bold truncate max-w-[120px]">
                                {sermon.scripture}
                              </span>
                            )}
                          </div>
                          <h4 className="font-black text-[#1A1F3C] text-base leading-snug mt-1 line-clamp-2">{sermon.title}</h4>
                          <p className="text-xs text-gray-500 font-bold mt-0.5">{sermon.minister}</p>
                        </div>

                        {sermon.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed bg-gray-50 p-2.5 rounded-xl">
                            {sermon.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        {sermon.mediaUrl ? (
                          <a 
                            href={sermon.mediaUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-[#F26522] flex items-center space-x-1 hover:underline"
                          >
                            <span>Open Link</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium italic">No direct link</span>
                        )}

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openEditSermonModal(sermon)}
                            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                            title="Edit Sermon"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteSermon(sermon.id, sermon.title)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors"
                            title="Delete Sermon"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BOOKS & PUBLICATIONS TAB */}
          {activeTab === 'books' && (
            <AdminBooksTab />
          )}

          {/* NGO & OUTREACH PROJECTS TAB */}
          {activeTab === 'outreach' && (
            <AdminOutreachTab />
          )}

          {/* ADMIN STAFF TAB */}
          {activeTab === 'admins' && isSuperAdmin && (
            <AdminStaffManagementTab members={members} />
          )}

          {/* LIVE ZOOM ROOM ROSTER MODAL */}
          {showLiveRosterModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-[#1A1F3C] p-6 text-white flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                      <Flame size={22} className="animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-xl font-black text-white">Live Zoom Prayer Room Roster</h3>
                        <span className="px-2.5 py-0.5 bg-emerald-500 text-slate-900 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                          LIVE COUNT
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">
                        Real-time monitor of all visitors and registered members currently logged into the Zoom prayer meeting.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowLiveRosterModal(false)}
                    className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Counter Summary Bar */}
                <div className="bg-gray-50 border-b border-gray-100 p-4 px-6 grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Attending</p>
                    <p className="text-2xl font-black text-[#1A1F3C]">{totalLiveInZoomCount}</p>
                  </div>
                  <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Visitors / Guests</p>
                    <p className="text-2xl font-black text-emerald-700">{liveGuestsList.length}</p>
                  </div>
                  <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-200 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Registered Members</p>
                    <p className="text-2xl font-black text-blue-700">{liveMembersList.length}</p>
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  {totalLiveInZoomCount === 0 ? (
                    <div className="p-12 text-center space-y-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <Video size={48} className="mx-auto text-gray-300" />
                      <p className="font-black text-gray-600 text-lg">No Attendees Currently Active in Zoom</p>
                      <p className="text-xs text-gray-400 max-w-md mx-auto font-medium">
                        Live attendance updates automatically in real-time as soon as a visitor or registered member joins the Zoom prayer session.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Section: Live Visitors */}
                      {liveGuestsList.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-black uppercase tracking-widest text-emerald-700 flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Live Visitors / Guests ({liveGuestsList.length})</span>
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {liveGuestsList.map((g) => {
                              const todaySecs = g.todaySeconds || 0;
                              const todayMins = g.todayMinutes || Math.floor(todaySecs / 60);
                              const yearlySecs = g.yearlySeconds || g.totalSeconds || 0;
                              const yearlyMins = g.yearlyMinutes || g.totalMinutes || Math.floor(yearlySecs / 60);

                              return (
                                <div key={g.id} className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex items-center justify-between space-x-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-xs uppercase shrink-0 shadow-sm ring-2 ring-emerald-400 animate-pulse">
                                      {g.guestName ? g.guestName.charAt(0).toUpperCase() : 'G'}
                                    </div>
                                    <div>
                                      <p className="font-black text-[#1A1F3C] text-sm">{g.guestName || 'Anonymous Guest'}</p>
                                      <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                                        {g.guestPhone && (
                                          <span className="text-[#F26522] font-bold flex items-center">
                                            <Phone size={10} className="mr-1" />
                                            {g.guestPhone}
                                          </span>
                                        )}
                                        <span className="text-gray-400">• {g.deviceInfo || 'Web Browser'}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className="inline-block px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-lg uppercase">
                                      {todayMins > 0 ? `${todayMins}m Today` : `${todaySecs}s Today`}
                                    </span>
                                    <p className="text-[10px] text-gray-400 mt-1 font-mono">{yearlyMins}m all-time</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Section: Live Members */}
                      {liveMembersList.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-black uppercase tracking-widest text-blue-700 flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <span>Live Registered Members ({liveMembersList.length})</span>
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {liveMembersList.map((m) => {
                              const todayMins = m.todayMinutes || 0;
                              const yearMins = m.thisYearMinutes || m.thisWeekMinutes || 0;

                              return (
                                <div key={m.uid} className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl flex items-center justify-between space-x-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-[#1A1F3C] text-white font-black flex items-center justify-center text-xs uppercase shrink-0 shadow-sm ring-2 ring-blue-400 animate-pulse">
                                      {m.displayName ? m.displayName.charAt(0).toUpperCase() : 'M'}
                                    </div>
                                    <div>
                                      <p className="font-black text-[#1A1F3C] text-sm">{m.displayName || 'Unnamed Member'}</p>
                                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 font-medium mt-0.5">
                                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200">
                                          <MessageCircle size={10} className="text-emerald-600 shrink-0" />
                                          <span>{getMemberWhatsAppCommunity(m)}</span>
                                        </span>
                                        {m.country && <span className="text-gray-400">• {m.country}</span>}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className="inline-block px-2.5 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase">
                                      {todayMins}m Today
                                    </span>
                                    <p className="text-[10px] text-gray-400 mt-1 font-mono">{yearMins}m this year</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">
                    ⚡ Real-time presence updates active
                  </span>
                  <button
                    onClick={() => setShowLiveRosterModal(false)}
                    className="px-6 py-2.5 bg-[#1A1F3C] hover:bg-[#252b4e] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Close Roster
                  </button>
                </div>
              </div>
            </div>
          )}

          {showEstherGroupModal && (
            <EstherGroupModal
              isOpen={showEstherGroupModal}
              onClose={() => setShowEstherGroupModal(false)}
              members={members}
              onFilterByEsther={() => setCommunityFilter("Esther’s Group (Benin)")}
              onOpenAttendanceReport={() => setActiveTab('attendance-reports')}
            />
          )}

          {showManualAttendanceModal && (
            <ManualAttendanceModal
              isOpen={showManualAttendanceModal}
              onClose={() => {
                setShowManualAttendanceModal(false);
                setManualAttendanceSelectedMember(null);
              }}
              members={members}
              initialMember={manualAttendanceSelectedMember}
              onSuccess={(msg) => {
                setMemberFeedback({ type: 'success', message: msg });
                setShowManualAttendanceModal(false);
                setManualAttendanceSelectedMember(null);
              }}
            />
          )}

        </div>
      </main>
    </div>
  );
}
