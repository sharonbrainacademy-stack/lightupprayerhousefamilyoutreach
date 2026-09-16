/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit3, Trash2, Video, ExternalLink, 
  Upload, X, CheckCircle2, HandHeart, Eye, EyeOff, 
  ImagePlus, Sparkles, MapPin, Calendar, Tag, Layers,
  Play, Film, Search, Filter, AlertTriangle, RefreshCw,
  DollarSign, Users, HeartHandshake, Check
} from 'lucide-react';
import { 
  OutreachProject, 
  DEFAULT_OUTREACH_PROJECTS, 
  subscribeOutreach, 
  addOutreachProject, 
  updateOutreachProject, 
  deleteOutreachProject,
  getYouTubeThumbnailUrl,
  StoryPicture,
  DEFAULT_STORY_PICTURES,
  subscribeStoryPictures,
  addStoryPicture,
  updateStoryPicture,
  deleteStoryPicture
} from '../../lib/outreach';
import { parseVideoUrl } from '../../lib/video-utils';
import { useAuth } from '../../lib/auth';

export default function AdminOutreachTab() {
  const { user } = useAuth();
  
  // Tab Switch: 'videos' | 'projects' | 'home_story'
  const [activeSubTab, setActiveSubTab] = useState<'videos' | 'projects' | 'home_story'>('videos');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // NGO Outreach Projects State (also acts as outreach video library)
  const [outreachList, setOutreachList] = useState<OutreachProject[]>([]);
  const [loadingOutreach, setLoadingOutreach] = useState(true);

  // Outreach Video / Project Modal State
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [isEditingVideoMode, setIsEditingVideoMode] = useState(false);
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
  const [outreachShowOnHome, setOutreachShowOnHome] = useState(true);
  const [outreachOrder, setOutreachOrder] = useState<number>(0);
  const [savingOutreach, setSavingOutreach] = useState(false);
  const [outreachSuccessMsg, setOutreachSuccessMsg] = useState('');
  const [outreachErrorMsg, setOutreachErrorMsg] = useState('');

  // Video Player Modal Preview
  const [selectedVideoForPreview, setSelectedVideoForPreview] = useState<OutreachProject | null>(null);

  // Delete Confirmation State
  const [deletingItem, setDeletingItem] = useState<{ id: string; title: string; type: 'video' | 'project' | 'photo' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Home Story Photos ("Our Full Story") State
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

  // Subscribe to Projects & Videos
  useEffect(() => {
    let unsub: () => void;
    if (user) {
      setLoadingOutreach(true);
      unsub = subscribeOutreach(
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
      if (unsub) unsub();
    };
  }, [user]);

  // Subscribe to Home Story Pictures
  useEffect(() => {
    let unsub: () => void;
    if (user) {
      setLoadingStoryPics(true);
      unsub = subscribeStoryPictures(
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
      if (unsub) unsub();
    };
  }, [user]);

  // Auto-extract thumbnail when video URL changes and image is empty or default
  const handleAutoFetchThumbnail = () => {
    const thumb = getYouTubeThumbnailUrl(outreachVideoUrl);
    if (thumb) {
      setOutreachImage(thumb);
      setOutreachSuccessMsg('YouTube thumbnail extracted successfully!');
      setTimeout(() => setOutreachSuccessMsg(''), 3000);
    } else {
      setOutreachErrorMsg('Please enter a valid YouTube video link to auto-fetch the thumbnail.');
      setTimeout(() => setOutreachErrorMsg(''), 3000);
    }
  };

  // Image Upload Handlers
  const handleOutreachImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Please select an image under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setOutreachImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStoryPicFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Please select an image under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setStoryPicImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Forms Reset / Open
  const resetOutreachForm = (isVideoMode = false) => {
    setEditingOutreachId(null);
    setIsEditingVideoMode(isVideoMode);
    setOutreachTitle('');
    setOutreachCategory('Hunger Relief');
    setOutreachLocation('Lagos, Nigeria');
    setOutreachDate(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    setOutreachImage(isVideoMode ? 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80' : 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80');
    setOutreachVideoUrl('');
    setOutreachRaised('0');
    setOutreachGoal('5000');
    setOutreachDescription('');
    setOutreachBeneficiaries('');
    setOutreachStatus('active');
    setOutreachShowOnHome(true);
    setOutreachOrder(outreachList.length + 1);
    setOutreachErrorMsg('');
    setOutreachSuccessMsg('');
  };

  const openNewVideoModal = () => {
    resetOutreachForm(true);
    setShowOutreachModal(true);
  };

  const openNewProjectModal = () => {
    resetOutreachForm(false);
    setShowOutreachModal(true);
  };

  const openEditOutreachModal = (proj: OutreachProject, isVideo = false) => {
    setEditingOutreachId(proj.id);
    setIsEditingVideoMode(isVideo || Boolean(proj.videoUrl));
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
    setOutreachShowOnHome(proj.showOnHome !== false);
    setOutreachOrder(proj.order ?? 0);
    setOutreachErrorMsg('');
    setOutreachSuccessMsg('');
    setShowOutreachModal(true);
  };

  const handleSaveOutreach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outreachTitle.trim()) {
      setOutreachErrorMsg('Please provide a title.');
      return;
    }

    if (isEditingVideoMode && !outreachVideoUrl.trim()) {
      setOutreachErrorMsg('Please provide a video link (YouTube, Vimeo, MP4 direct video, etc.).');
      return;
    }

    setSavingOutreach(true);
    setOutreachErrorMsg('');
    setOutreachSuccessMsg('');

    try {
      // Auto-extract thumbnail if image is default and video is YouTube
      let finalImage = outreachImage.trim();
      if (!finalImage || finalImage.includes('unsplash.com/photo-1488521787991')) {
        const ytThumb = getYouTubeThumbnailUrl(outreachVideoUrl);
        if (ytThumb) finalImage = ytThumb;
      }
      if (!finalImage) {
        finalImage = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80';
      }

      const payload = {
        title: outreachTitle.trim(),
        category: outreachCategory.trim() || 'Outreach',
        location: outreachLocation.trim(),
        date: outreachDate.trim() || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        image: finalImage,
        videoUrl: outreachVideoUrl.trim(),
        raised: Number(outreachRaised) || 0,
        goal: Number(outreachGoal) || 0,
        description: outreachDescription.trim() || 'Outreach mission documentary and humanitarian service by Light Up Prayer House Outreach Foundation.',
        beneficiariesCount: outreachBeneficiaries.trim(),
        status: outreachStatus,
        showOnHome: outreachShowOnHome,
        order: Number(outreachOrder) || 0
      };

      if (editingOutreachId) {
        await updateOutreachProject(editingOutreachId, payload);
        setOutreachSuccessMsg(isEditingVideoMode ? 'Outreach video updated successfully!' : 'Outreach project updated successfully!');
      } else {
        await addOutreachProject(payload);
        setOutreachSuccessMsg(isEditingVideoMode ? 'New outreach video added successfully!' : 'New outreach project published successfully!');
      }

      setTimeout(() => {
        setShowOutreachModal(false);
        resetOutreachForm();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving outreach item:', err);
      setOutreachErrorMsg(err?.message || 'Failed to save. Please check your network connection.');
    } finally {
      setSavingOutreach(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      if (deletingItem.type === 'photo') {
        await deleteStoryPicture(deletingItem.id);
        setStoryPicSuccessMsg(`"${deletingItem.title}" photo removed successfully.`);
        setTimeout(() => setStoryPicSuccessMsg(''), 3000);
      } else {
        await deleteOutreachProject(deletingItem.id);
        setOutreachSuccessMsg(`"${deletingItem.title}" ${deletingItem.type === 'video' ? 'video' : 'project'} deleted successfully.`);
        setTimeout(() => setOutreachSuccessMsg(''), 3000);
      }
      setDeletingItem(null);
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Failed to delete item. Please check your connection.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleOutreachVisibility = async (proj: OutreachProject) => {
    try {
      const current = proj.showOnHome !== false;
      await updateOutreachProject(proj.id, { showOnHome: !current });
    } catch (err) {
      console.error('Error toggling project home visibility:', err);
    }
  };

  // Story Pictures Handlers
  const resetStoryPicForm = () => {
    setEditingStoryPicId(null);
    setStoryPicTitle('');
    setStoryPicCaption('');
    setStoryPicLocation('Lagos, Nigeria');
    setStoryPicDate(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    setStoryPicCategory('Hunger Relief');
    setStoryPicImageUrl('');
    setStoryPicShowOnHome(true);
    setStoryPicOrder(storyPicturesList.length + 1);
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
      setStoryPicErrorMsg('Please provide a photo headline or title.');
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
        imageUrl: storyPicImageUrl.trim(),
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
        setStoryPicSuccessMsg('New outreach photo added under Our Full Story on the Home page!');
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

  const handleToggleStoryPicVisibility = async (pic: StoryPicture) => {
    try {
      const current = pic.showOnHomeStory !== false;
      await updateStoryPicture(pic.id, { showOnHomeStory: !current });
    } catch (err) {
      console.error('Error toggling photo visibility:', err);
    }
  };

  // Filtered outreach items for Videos subtab vs Projects subtab
  const videoList = outreachList.filter(item => Boolean(item.videoUrl));
  const filteredVideos = videoList.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredProjects = outreachList.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Unique categories for filter dropdown
  const allCategories = Array.from(new Set(outreachList.map(item => item.category).filter(Boolean)));

  return (
    <div id="admin-outreach-container" className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-[#F26522]/10 text-[#F26522] text-[10px] font-black uppercase tracking-widest rounded-full flex items-center space-x-1">
              <Film size={12} className="mr-1" />
              Outreach Media & Missions Hub
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#1A1F3C] mt-2">Outreach Videos, Missions & Photo Stories</h3>
          <p className="text-gray-500 text-xs sm:text-sm font-medium mt-1 max-w-3xl leading-relaxed">
            Manage NGO field documentaries, attach YouTube/video recordings, publish funding campaigns, and manage photo gallery exhibits displayed on the Home and Outreach pages.
          </p>
        </div>

        {/* Action Buttons based on Active Subtab */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {activeSubTab === 'videos' && (
            <>
              <a 
                href="/#outreach-videos" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shrink-0"
              >
                <ExternalLink size={14} />
                <span>View Home Videos</span>
              </a>
              <button
                id="btn-add-outreach-video"
                onClick={openNewVideoModal}
                className="px-5 py-2.5 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#d9561a] transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#F26522]/20 cursor-pointer"
              >
                <Plus size={16} />
                <span>Add Outreach Video</span>
              </button>
            </>
          )}

          {activeSubTab === 'projects' && (
            <>
              <a 
                href="/outreach" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shrink-0"
              >
                <ExternalLink size={14} />
                <span>View Outreach Page</span>
              </a>
              <button
                id="btn-add-outreach-project"
                onClick={openNewProjectModal}
                className="px-5 py-2.5 bg-[#1A1F3C] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#283058] transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#1A1F3C]/20 cursor-pointer"
              >
                <Plus size={16} />
                <span>Add Campaign Project</span>
              </button>
            </>
          )}

          {activeSubTab === 'home_story' && (
            <>
              <a 
                href="/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shrink-0"
              >
                <ExternalLink size={14} />
                <span>Preview Home Story</span>
              </a>
              <button
                id="btn-add-home-story-photo"
                onClick={openNewStoryPicModal}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <ImagePlus size={16} />
                <span>Add Story Photo</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subtab Navigation Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-100/90 p-2 rounded-2xl">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            id="subtab-outreach-videos"
            onClick={() => setActiveSubTab('videos')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'videos'
                ? 'bg-white text-[#F26522] shadow-sm font-black'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Video size={15} className={activeSubTab === 'videos' ? 'text-[#F26522]' : ''} />
            <span>Outreach Videos & Documentaries</span>
            <span className="px-2 py-0.5 bg-[#F26522]/10 text-[#F26522] rounded-full text-[10px] font-black">
              {videoList.length}
            </span>
          </button>

          <button
            id="subtab-ngo-projects"
            onClick={() => setActiveSubTab('projects')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'projects'
                ? 'bg-white text-[#1A1F3C] shadow-sm font-black'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <HandHeart size={15} className={activeSubTab === 'projects' ? 'text-[#F26522]' : ''} />
            <span>Missions & Donation Campaigns</span>
            <span className="px-2 py-0.5 bg-gray-200 rounded-full text-[10px] font-bold text-gray-700">
              {outreachList.length}
            </span>
          </button>

          <button
            id="subtab-home-story-photos"
            onClick={() => setActiveSubTab('home_story')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'home_story'
                ? 'bg-white text-emerald-700 shadow-sm font-black'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ImagePlus size={15} className={activeSubTab === 'home_story' ? 'text-emerald-600' : ''} />
            <span>Home Story Photos ("Our Full Story")</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
              {storyPicturesList.length}
            </span>
          </button>
        </div>

        {/* Quick Search & Category Filter */}
        {activeSubTab !== 'home_story' && (
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white rounded-xl text-xs font-medium border border-gray-200 outline-none focus:ring-1 focus:ring-[#F26522]"
              />
            </div>
            {allCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white rounded-xl text-xs font-medium border border-gray-200 outline-none focus:ring-1 focus:ring-[#F26522]"
              >
                <option value="all">All Categories</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* GLOBAL SUCCESS NOTIFICATION */}
      {outreachSuccessMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{outreachSuccessMsg}</span>
          </div>
          <button onClick={() => setOutreachSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 1: OUTREACH VIDEOS & DOCUMENTARIES */}
      {/* ========================================================================= */}
      {activeSubTab === 'videos' && (
        <div className="space-y-6">
          {/* Informational Guidance Banner for Videos */}
          <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-white border border-orange-200/70 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start space-x-4">
              <div className="w-11 h-11 rounded-2xl bg-[#F26522] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#F26522]/20">
                <Video size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#1A1F3C] flex items-center space-x-2">
                  <span>Outreach Videos & Impact In Motion</span>
                  <span className="px-2 py-0.5 bg-[#F26522]/10 text-[#F26522] rounded-md text-[10px] font-black uppercase">
                    Live Broadcast Manager
                  </span>
                </h4>
                <p className="text-xs text-gray-600 font-medium mt-1 max-w-2xl leading-relaxed">
                  Add YouTube, Vimeo, or MP4 video recordings of food distributions, hospital visits, and mission crusades.
                  These videos are featured in the <strong>"Outreach Videos & Impact In Motion"</strong> player section on the Home page and on the Outreach page.
                </p>
              </div>
            </div>
            <button
              onClick={openNewVideoModal}
              className="px-5 py-3 bg-[#F26522] hover:bg-[#d9561a] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 shrink-0 transition-all shadow-lg shadow-[#F26522]/20 cursor-pointer"
            >
              <Plus size={16} />
              <span>Add New Video</span>
            </button>
          </div>

          {/* Videos Grid */}
          {loadingOutreach ? (
            <div className="py-16 text-center text-gray-400 text-xs font-bold space-y-2">
              <RefreshCw size={24} className="mx-auto animate-spin text-[#F26522]" />
              <p>Loading outreach field videos...</p>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 space-y-4 shadow-sm">
              <Video size={48} className="mx-auto text-gray-300" />
              <h4 className="text-lg font-black text-[#1A1F3C]">No Outreach Videos Found</h4>
              <p className="text-gray-400 text-xs max-w-md mx-auto">
                {searchQuery || categoryFilter !== 'all' 
                  ? 'No videos match your search or filter. Try clearing filters or add a new video.' 
                  : 'You have not added any field videos or documentary recordings yet. Click "+ Add New Video" above to publish your first video.'}
              </p>
              <button
                onClick={openNewVideoModal}
                className="px-6 py-3 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#d9561a] transition-all shadow-md shadow-[#F26522]/20 cursor-pointer"
              >
                Add First Outreach Video
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((item) => {
                const isLiveOnHome = item.showOnHome !== false;
                const videoParsed = parseVideoUrl(item.videoUrl);

                return (
                  <div 
                    key={item.id}
                    className={`bg-white rounded-3xl p-5 border shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                      isLiveOnHome ? 'border-gray-200' : 'border-gray-200 opacity-75 bg-gray-50/50'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Video Thumbnail with Play Button */}
                      <div 
                        onClick={() => setSelectedVideoForPreview(item)}
                        className="aspect-video relative rounded-2xl overflow-hidden bg-gray-900 border border-gray-100 group cursor-pointer"
                      >
                        <img 
                          src={item.image || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80'} 
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80'; }}
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors"></div>

                        {/* Central Play Badge */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-[#F26522] text-white flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
                            <Play size={18} className="fill-current ml-0.5" />
                          </div>
                        </div>

                        {/* Category Badge */}
                        <div className="absolute top-2 left-2 px-2.5 py-0.5 bg-black/80 backdrop-blur rounded text-[9px] font-black uppercase tracking-wider text-[#F26522]">
                          {item.category}
                        </div>

                        {/* Home Screen Live Status */}
                        <div className="absolute top-2 right-2">
                          {isLiveOnHome ? (
                            <span className="px-2 py-0.5 bg-emerald-600/90 backdrop-blur text-white text-[9px] font-bold rounded flex items-center space-x-1 shadow">
                              <Eye size={10} />
                              <span>Live on Home</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-800/90 backdrop-blur text-gray-300 text-[9px] font-bold rounded flex items-center space-x-1">
                              <EyeOff size={10} />
                              <span>Hidden on Home</span>
                            </span>
                          )}
                        </div>

                        {/* Video Platform Indicator */}
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/80 backdrop-blur rounded text-[9px] font-bold text-gray-200 flex items-center space-x-1">
                          <Video size={10} className="text-[#F26522]" />
                          <span>
                            {videoParsed.isYouTube ? 'YouTube' : videoParsed.isVimeo ? 'Vimeo' : 'Direct Video'}
                          </span>
                        </div>
                      </div>

                      {/* Video Title & Meta */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
                          <span className="flex items-center space-x-1">
                            <MapPin size={10} className="text-[#F26522]" />
                            <span>{item.location || 'Field Mission'}</span>
                          </span>
                          <span>{item.date || 'August 2026'}</span>
                        </div>
                        <h4 className="font-black text-[#1A1F3C] text-base leading-snug mt-1 line-clamp-2">
                          {item.title}
                        </h4>
                      </div>

                      {/* Video URL snippet */}
                      <div className="p-2 bg-gray-50 rounded-xl border border-gray-100 text-[11px] font-mono text-gray-500 truncate flex items-center space-x-1.5">
                        <Video size={12} className="text-[#F26522] shrink-0" />
                        <span className="truncate">{item.videoUrl}</span>
                      </div>

                      {/* Description preview */}
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Beneficiaries / Metric */}
                      {item.beneficiariesCount && (
                        <div className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg w-fit">
                          ✨ {item.beneficiariesCount}
                        </div>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedVideoForPreview(item)}
                          className="px-3 py-1.5 bg-[#F26522]/10 hover:bg-[#F26522]/20 text-[#F26522] text-[11px] font-black uppercase rounded-xl transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <Play size={12} className="fill-current" />
                          <span>Watch</span>
                        </button>
                        <button
                          onClick={() => handleToggleOutreachVisibility(item)}
                          className={`text-[11px] font-bold flex items-center space-x-1 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                            isLiveOnHome 
                              ? 'text-orange-700 bg-orange-50 hover:bg-orange-100' 
                              : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                          }`}
                          title={isLiveOnHome ? "Hide from Home screen" : "Show on Home screen"}
                        >
                          {isLiveOnHome ? <EyeOff size={13} /> : <Eye size={13} />}
                          <span>{isLiveOnHome ? 'Hide' : 'Show'}</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openEditOutreachModal(item, true)}
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="Edit Outreach Video"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingItem({ id: item.id, title: item.title, type: 'video' })}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="Delete Outreach Video"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: NGO PROJECTS & CAMPAIGNS */}
      {/* ========================================================================= */}
      {activeSubTab === 'projects' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h4 className="text-sm font-black text-[#1A1F3C]">Outreach Foundation Missions & Field Projects</h4>
              <p className="text-xs text-gray-500 font-medium mt-0.5 max-w-xl leading-relaxed">
                Publish humanitarian missions, manage field stories, track beneficiary metrics, and attach video documentary footage.
              </p>
            </div>
            <button
              onClick={openNewProjectModal}
              className="px-5 py-2.5 bg-[#1A1F3C] text-white hover:bg-[#283058] rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 shrink-0 transition-colors shadow-md cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Mission Project</span>
            </button>
          </div>

          {/* Outreach Projects Grid */}
          {loadingOutreach ? (
            <div className="py-12 text-center text-gray-400 text-xs font-bold">
              Loading outreach missions...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 space-y-4">
              <HandHeart size={40} className="mx-auto text-gray-300" />
              <h4 className="font-black text-[#1A1F3C]">No Projects in Outreach Foundation</h4>
              <p className="text-gray-400 text-xs max-w-sm mx-auto">
                Click "+ Add Campaign Project" above to publish your first humanitarian mission.
              </p>
              <button
                onClick={openNewProjectModal}
                className="px-5 py-2.5 bg-[#F26522] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Add Project Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((proj) => {
                const progress = proj.goal > 0 ? Math.min(100, Math.round((proj.raised / proj.goal) * 100)) : 100;
                const isLiveOnHome = proj.showOnHome !== false;

                return (
                  <div 
                    key={proj.id}
                    className={`bg-white rounded-3xl p-5 border shadow-sm space-y-4 flex flex-col justify-between transition-all ${
                      isLiveOnHome ? 'border-gray-200' : 'border-gray-200 opacity-70 bg-gray-50/50'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="aspect-video relative rounded-2xl overflow-hidden bg-gray-900 border">
                        <img 
                          src={proj.image} 
                          alt={proj.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80'; }}
                        />
                        <div className="absolute top-2 left-2 px-2.5 py-0.5 bg-white/90 backdrop-blur rounded text-[9px] font-black uppercase tracking-widest text-[#F26522]">
                          {proj.category}
                        </div>
                        
                        <div className="absolute top-2 right-2">
                          {isLiveOnHome ? (
                            <span className="px-2 py-0.5 bg-emerald-600/90 backdrop-blur text-white text-[9px] font-bold rounded flex items-center space-x-1 shadow">
                              <Eye size={10} />
                              <span>Live on Home</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-700/90 backdrop-blur text-gray-300 text-[9px] font-bold rounded flex items-center space-x-1">
                              <EyeOff size={10} />
                              <span>Hidden on Home</span>
                            </span>
                          )}
                        </div>

                        {proj.videoUrl && (
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur rounded text-[9px] font-bold text-white flex items-center space-x-1">
                            <Video size={10} className="text-[#F26522]" />
                            <span>Video Attached</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
                          <span>{proj.location}</span>
                          <span>{proj.date}</span>
                        </div>
                        <h4 className="font-black text-[#1A1F3C] text-base leading-snug mt-1 line-clamp-2">{proj.title}</h4>
                      </div>

                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed bg-gray-50 p-2.5 rounded-xl">
                        {proj.description}
                      </p>

                      {proj.beneficiariesCount && (
                        <div className="pt-1">
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg inline-block">
                            Impact: {proj.beneficiariesCount}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => handleToggleOutreachVisibility(proj)}
                        className={`text-[11px] font-bold flex items-center space-x-1 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                          isLiveOnHome 
                            ? 'text-orange-700 bg-orange-50 hover:bg-orange-100' 
                            : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                        }`}
                        title={isLiveOnHome ? "Hide from Home Screen" : "Show on Home Screen"}
                      >
                        {isLiveOnHome ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{isLiveOnHome ? 'Hide' : 'Show on Home'}</span>
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openEditOutreachModal(proj, false)}
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="Edit Campaign Details"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingItem({ id: proj.id, title: proj.title, type: 'project' })}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="Delete Campaign"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: HOME STORY PHOTOS ("OUR FULL STORY") */}
      {/* ========================================================================= */}
      {activeSubTab === 'home_story' && (
        <div className="space-y-6">
          {/* Informational Guidance Banner */}
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                <ImagePlus size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-emerald-950">Home Page "Our Full Story" Gallery Manager</h4>
                <p className="text-xs text-emerald-800 font-medium mt-0.5 max-w-xl leading-relaxed">
                  Every photograph added here is displayed directly on the Home page under <strong>"Our Full Story"</strong>. 
                  Visitors can click any picture to open high-resolution photography with full captions and field notes.
                </p>
              </div>
            </div>
            <button
              onClick={openNewStoryPicModal}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 shrink-0 transition-colors shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Story Photo</span>
            </button>
          </div>

          {storyPicSuccessMsg && (
            <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center space-x-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{storyPicSuccessMsg}</span>
            </div>
          )}

          {/* Story Photos Grid */}
          {loadingStoryPics ? (
            <div className="py-12 text-center text-gray-400 text-xs font-bold">
              Loading story photographs...
            </div>
          ) : storyPicturesList.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 space-y-4">
              <ImagePlus size={40} className="mx-auto text-gray-300" />
              <h4 className="font-black text-[#1A1F3C]">No Story Photos Added Yet</h4>
              <p className="text-gray-400 text-xs max-w-sm mx-auto">
                Click "+ Add Story Photo" above to upload photos from outreach missions and show them under "Our Full Story" on the Home page.
              </p>
              <button
                onClick={openNewStoryPicModal}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Add First Photo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {storyPicturesList.map((pic) => {
                const isLive = pic.showOnHomeStory !== false;
                return (
                  <div 
                    key={pic.id}
                    className={`bg-white rounded-3xl p-4 border transition-all flex flex-col justify-between shadow-sm ${
                      isLive ? 'border-gray-100' : 'border-gray-200 opacity-70 bg-gray-50/50'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Thumbnail Container */}
                      <div className="aspect-[4/3] relative rounded-2xl overflow-hidden bg-gray-900 border border-gray-100">
                        <img 
                          src={pic.imageUrl} 
                          alt={pic.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80'; }}
                        />
                        
                        {/* Category & Status Badges */}
                        <div className="absolute top-2 left-2 flex items-center space-x-1.5">
                          <span className="px-2.5 py-0.5 bg-black/80 backdrop-blur rounded text-[9px] font-black uppercase tracking-wider text-emerald-400">
                            {pic.category || 'Outreach'}
                          </span>
                        </div>

                        <div className="absolute top-2 right-2">
                          {isLive ? (
                            <span className="px-2 py-0.5 bg-emerald-500/90 backdrop-blur text-white text-[9px] font-bold rounded flex items-center space-x-1">
                              <Eye size={10} />
                              <span>Live on Home</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-700/90 backdrop-blur text-gray-300 text-[9px] font-bold rounded flex items-center space-x-1">
                              <EyeOff size={10} />
                              <span>Hidden</span>
                            </span>
                          )}
                        </div>

                        {pic.location && (
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur rounded text-[9px] font-bold text-white flex items-center space-x-1">
                            <MapPin size={10} className="text-emerald-400" />
                            <span>{pic.location}</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
                          <span>{pic.date || 'Outreach Mission'}</span>
                          <span>Order: #{pic.order ?? 0}</span>
                        </div>
                        <h4 className="font-black text-[#1A1F3C] text-sm leading-snug mt-1 line-clamp-2">
                          {pic.title}
                        </h4>
                      </div>

                      {pic.caption && (
                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                          {pic.caption}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => handleToggleStoryPicVisibility(pic)}
                        className={`text-[11px] font-bold flex items-center space-x-1 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                          isLive 
                            ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' 
                            : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                        }`}
                        title={isLive ? "Hide from Home Story" : "Show on Home Story"}
                      >
                        {isLive ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{isLive ? 'Hide' : 'Show on Home'}</span>
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openEditStoryPicModal(pic)}
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="Edit Photo Details"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingItem({ id: pic.id, title: pic.title, type: 'photo' })}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="Remove Photo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT OUTREACH VIDEO & PROJECT MODAL */}
      {/* ========================================================================= */}
      {showOutreachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-gray-100 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <div>
                <h4 className="text-xl font-black text-[#1A1F3C] flex items-center space-x-2">
                  {isEditingVideoMode ? <Video className="text-[#F26522]" size={20} /> : <HandHeart className="text-[#1A1F3C]" size={20} />}
                  <span>
                    {editingOutreachId 
                      ? (isEditingVideoMode ? 'Edit Outreach Video' : 'Edit Outreach Project') 
                      : (isEditingVideoMode ? 'Add New Outreach Video' : 'Add New Outreach Project')}
                  </span>
                </h4>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  {isEditingVideoMode 
                    ? 'Publish video footage and link YouTube/Vimeo recordings for visitors to watch.' 
                    : 'Publish humanitarian campaigns and funding drives for the outreach foundation.'}
                </p>
              </div>
              <button 
                onClick={() => setShowOutreachModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {outreachErrorMsg && (
              <div className="p-3.5 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200 flex items-center space-x-2">
                <AlertTriangle size={16} className="shrink-0 text-red-600" />
                <span>{outreachErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveOutreach} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                  {isEditingVideoMode ? 'Video Title / Documentary Headline *' : 'Project Title *'}
                </label>
                <input 
                  type="text" 
                  required
                  placeholder={isEditingVideoMode ? "e.g. Lagos Slum Food Relief Drive 2026 - Field Recording" : "e.g. Feeding the 5,000 in Lagos, Medical Aid Mission"}
                  value={outreachTitle}
                  onChange={(e) => setOutreachTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              {/* Video URL Field */}
              <div className="space-y-1.5 p-3.5 bg-orange-50/60 rounded-2xl border border-orange-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase text-orange-900 flex items-center space-x-1.5">
                    <Video size={14} className="text-[#F26522]" />
                    <span>Video Recording / YouTube / Vimeo Link {isEditingVideoMode ? '*' : '(Optional)'}</span>
                  </label>
                  {outreachVideoUrl && (
                    <button
                      type="button"
                      onClick={handleAutoFetchThumbnail}
                      className="text-[10px] font-black uppercase text-[#F26522] hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <Sparkles size={11} />
                      <span>Auto-Fetch YouTube Thumbnail</span>
                    </button>
                  )}
                </div>
                <input 
                  type="text" 
                  required={isEditingVideoMode}
                  placeholder="e.g. https://www.youtube.com/watch?v=kXYiU_JCYtU or Vimeo / MP4 link"
                  value={outreachVideoUrl}
                  onChange={(e) => setOutreachVideoUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white rounded-xl text-xs font-mono border border-orange-200 outline-none focus:ring-2 focus:ring-[#F26522]"
                />
                
                {/* Live Video Embed Preview */}
                {outreachVideoUrl && (() => {
                  const parsed = parseVideoUrl(outreachVideoUrl);
                  return (
                    <div className="pt-2">
                      <div className="text-[10px] font-bold text-gray-500 mb-1 flex items-center space-x-1">
                        <Check size={12} className="text-emerald-600" />
                        <span>Video Stream Detected ({parsed.isYouTube ? 'YouTube' : parsed.isVimeo ? 'Vimeo' : 'Direct'})</span>
                      </div>
                      {parsed.embedUrl ? (
                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-gray-300">
                          <iframe
                            src={parsed.embedUrl}
                            title="Video Preview"
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : parsed.directVideoUrl ? (
                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-gray-300">
                          <video 
                            src={parsed.directVideoUrl} 
                            controls 
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">Mission Category</label>
                  <select
                    value={outreachCategory}
                    onChange={(e) => setOutreachCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                  >
                    <option value="Hunger Relief">Hunger Relief / Food Aid</option>
                    <option value="Medical Aid">Medical & Hospital Aid</option>
                    <option value="Education">Education & School Supplies</option>
                    <option value="Widows Support">Widows & Orphan Support</option>
                    <option value="Prison Ministry">Prison Ministry</option>
                    <option value="Evangelism">Crusades & Rural Missions</option>
                    <option value="Community Development">Community Development</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">Mission Status</label>
                  <select
                    value={outreachStatus}
                    onChange={(e) => setOutreachStatus(e.target.value as any)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                  >
                    <option value="active">Active (Currently Raising Funds / In Progress)</option>
                    <option value="completed">Completed (Mission Accomplished)</option>
                    <option value="upcoming">Upcoming Mission</option>
                  </select>
                </div>
              </div>

              {/* Location & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">Location</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Lagos, Nigeria or Benin City"
                    value={outreachLocation}
                    onChange={(e) => setOutreachLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">Date / Month</label>
                  <input 
                    type="text" 
                    placeholder="e.g. August 2026"
                    value={outreachDate}
                    onChange={(e) => setOutreachDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                  />
                </div>
              </div>

              {/* Beneficiaries & Impact Metric */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Beneficiaries Reached / Impact Metric</label>
                <input 
                  type="text" 
                  placeholder="e.g. 850+ Families Helped or 200 Children Fed"
                  value={outreachBeneficiaries}
                  onChange={(e) => setOutreachBeneficiaries(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              {/* Priority Order & Show on Home */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">Display Priority Order</label>
                  <input 
                    type="number" 
                    placeholder="1"
                    value={outreachOrder}
                    onChange={(e) => setOutreachOrder(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                  />
                  <span className="text-[10px] text-gray-400 font-medium">Lower numbers appear first on the Home page.</span>
                </div>

                <div className="p-3 bg-orange-50/70 rounded-2xl border border-orange-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-[#1A1F3C]">Show on Home Screen</div>
                    <div className="text-[10px] text-gray-400 font-medium">
                      Display under "Outreach Videos & Impact In Motion"
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={outreachShowOnHome}
                      onChange={(e) => setOutreachShowOnHome(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F26522]"></div>
                  </label>
                </div>
              </div>

              {/* Cover Photo / Thumbnail Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-gray-400">
                  Cover Photo / Thumbnail Image *
                </label>
                
                <div className="flex items-center space-x-3">
                  <label className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer border border-dashed border-gray-300 transition-colors">
                    <Upload size={14} className="text-[#F26522]" />
                    <span>Upload Custom Photo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleOutreachImageUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <div className="flex items-center space-x-3 pt-1">
                  <div className="w-20 h-14 rounded-xl bg-gray-900 overflow-hidden shrink-0 border border-gray-200 shadow-sm">
                    <img 
                      src={outreachImage} 
                      alt="Cover Preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80'; }}
                    />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Image URL (https://...)"
                    value={outreachImage}
                    onChange={(e) => setOutreachImage(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-xs font-mono border outline-none focus:ring-2 focus:ring-[#F26522]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                  {isEditingVideoMode ? 'Video Description / Field Report *' : 'Project Description *'}
                </label>
                <textarea 
                  rows={3}
                  required
                  placeholder="Describe what took place during this mission, the impact on families, and testimonies..."
                  value={outreachDescription}
                  onChange={(e) => setOutreachDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowOutreachModal(false)}
                  className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOutreach}
                  className="px-6 py-3 bg-[#F26522] text-white rounded-xl font-black uppercase text-xs hover:bg-[#d9561a] shadow-lg shadow-[#F26522]/20 disabled:opacity-50 cursor-pointer flex items-center space-x-2"
                >
                  {savingOutreach ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>
                      {editingOutreachId 
                        ? (isEditingVideoMode ? 'Update Video' : 'Update Campaign') 
                        : (isEditingVideoMode ? 'Publish Outreach Video' : 'Publish Project')}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT STORY PHOTO MODAL */}
      {/* ========================================================================= */}
      {showStoryPicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <div>
                <h4 className="text-xl font-black text-[#1A1F3C]">
                  {editingStoryPicId ? 'Edit Home Story Photo' : 'Add Outreach Photo to Home Story'}
                </h4>
                <p className="text-xs text-gray-400 font-medium">
                  Publish outreach field photography to the Home page "Our Full Story" gallery.
                </p>
              </div>
              <button 
                onClick={() => setShowStoryPicModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {storyPicErrorMsg && (
              <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200">
                {storyPicErrorMsg}
              </div>
            )}

            <form onSubmit={handleSaveStoryPic} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                  Photo Title / Mission Headline *
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Lagos City Food Drive & Widows Support"
                  value={storyPicTitle}
                  onChange={(e) => setStoryPicTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">Category / Tag</label>
                  <select
                    value={storyPicCategory}
                    onChange={(e) => setStoryPicCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Hunger Relief">Hunger Relief</option>
                    <option value="Medical Outreach">Medical Outreach</option>
                    <option value="Orphan Care">Orphan & Children Care</option>
                    <option value="Education">Education & School Supplies</option>
                    <option value="Widows Support">Widows Support</option>
                    <option value="Crusade & Missions">Crusades & Rural Missions</option>
                    <option value="Hospital Aid">Hospital Ministry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">Location</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Lagos, Nigeria or Benin City"
                    value={storyPicLocation}
                    onChange={(e) => setStoryPicLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">Date / Period</label>
                  <input 
                    type="text" 
                    placeholder="e.g. August 2026"
                    value={storyPicDate}
                    onChange={(e) => setStoryPicDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">Display Priority Order</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={storyPicOrder}
                    onChange={(e) => setStoryPicOrder(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-gray-400 font-medium">Lower numbers appear first on the Home page.</span>
                </div>
              </div>

              {/* Photo Upload & Preview */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-gray-400">
                  Outreach Photograph *
                </label>
                
                <div className="flex items-center space-x-3">
                  <label className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer border border-dashed border-gray-300 transition-colors">
                    <Upload size={14} className="text-emerald-600" />
                    <span>Upload Photo File</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleStoryPicFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <div className="flex items-center space-x-3 pt-1">
                  <div className="w-20 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200 shadow-sm flex items-center justify-center text-gray-400">
                    {storyPicImageUrl ? (
                      <img 
                        src={storyPicImageUrl} 
                        alt="Story Photo Preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImagePlus size={20} className="text-gray-400" />
                    )}
                  </div>
                  <input 
                    type="text" 
                    placeholder="Or enter image URL (https://...)"
                    value={storyPicImageUrl}
                    onChange={(e) => setStoryPicImageUrl(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-xs font-mono border outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                  Caption & Field Notes
                </label>
                <textarea 
                  rows={3}
                  placeholder="Describe what took place, beneficiaries touched, or testimonies from this mission..."
                  value={storyPicCaption}
                  onChange={(e) => setStoryPicCaption(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Show on Home Page Toggle */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-[#1A1F3C]">Display in Home Story Gallery</div>
                  <div className="text-[11px] text-gray-400 font-medium">
                    When enabled, this photo is immediately visible to all visitors under "Our Full Story".
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={storyPicShowOnHome}
                    onChange={(e) => setStoryPicShowOnHome(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowStoryPicModal(false)}
                  className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStoryPic}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {savingStoryPic ? 'Saving...' : (editingStoryPicId ? 'Update Photo' : 'Publish to Home Story')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIDEO PREVIEW MODAL / LIGHTBOX */}
      {/* ========================================================================= */}
      {selectedVideoForPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#1A1F3C] text-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 bg-[#F26522] rounded text-[10px] font-black uppercase">
                  {selectedVideoForPreview.category}
                </span>
                <span className="text-xs text-gray-300 font-medium">
                  {selectedVideoForPreview.location} • {selectedVideoForPreview.date}
                </span>
              </div>
              <button 
                onClick={() => setSelectedVideoForPreview(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <h3 className="text-xl font-black text-white">{selectedVideoForPreview.title}</h3>

            {/* Video Player */}
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner">
              {(() => {
                const parsed = parseVideoUrl(selectedVideoForPreview.videoUrl);
                if (parsed.embedUrl) {
                  return (
                    <iframe
                      src={parsed.embedUrl}
                      title={selectedVideoForPreview.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                }
                if (parsed.directVideoUrl) {
                  return (
                    <video
                      src={parsed.directVideoUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  );
                }
                return (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-3 p-6 text-center">
                    <Video size={48} className="text-[#F26522]" />
                    <p className="text-sm font-bold text-gray-300">Could not embed direct video stream.</p>
                    <a
                      href={selectedVideoForPreview.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#F26522] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
                    >
                      <ExternalLink size={14} />
                      <span>Open Video Link</span>
                    </a>
                  </div>
                );
              })()}
            </div>

            <p className="text-xs text-gray-300 font-medium leading-relaxed bg-white/5 p-3.5 rounded-2xl">
              {selectedVideoForPreview.description}
            </p>

            <div className="flex justify-between items-center pt-2">
              <div className="text-xs font-bold text-emerald-400">
                {selectedVideoForPreview.beneficiariesCount && `Impact: ${selectedVideoForPreview.beneficiariesCount}`}
              </div>
              <button
                onClick={() => setSelectedVideoForPreview(null)}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-red-100 text-center">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={26} />
            </div>
            
            <div>
              <h4 className="text-lg font-black text-[#1A1F3C]">
                Delete {deletingItem.type === 'video' ? 'Outreach Video' : deletingItem.type === 'photo' ? 'Story Photo' : 'Outreach Project'}?
              </h4>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Are you sure you want to permanently delete <strong>"{deletingItem.title}"</strong>? This will remove it from the Home screen and outreach galleries.
              </p>
            </div>

            <div className="pt-3 flex justify-center space-x-3">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 shadow-md shadow-red-600/20 disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
