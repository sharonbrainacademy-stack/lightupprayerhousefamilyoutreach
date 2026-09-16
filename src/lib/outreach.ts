/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestore-errors';

export interface OutreachProject {
  id: string;
  title: string;
  category: string; // e.g. "Food Distribution", "Medical Aid", "Prison Ministry", "Widows Support"
  location: string;
  date: string;
  image: string;
  videoUrl?: string; // YouTube, Vimeo, MP4 link
  raised: number;
  goal: number;
  description: string;
  beneficiariesCount?: string; // e.g. "1,200 Families"
  status?: 'active' | 'completed' | 'upcoming';
  showOnHome?: boolean;
  order?: number;
  createdAt?: any;
  updatedAt?: any;
}

export const DEFAULT_OUTREACH_PROJECTS: OutreachProject[] = [
  {
    id: 'seed-outreach-1',
    title: "Community Food Relief Drive",
    category: "Hunger Relief",
    location: "Lagos & Environs, Nigeria",
    date: "July 2026",
    image: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80",
    videoUrl: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
    raised: 4500,
    goal: 10000,
    description: "Providing staple food baskets, grains, and emergency sustenance packages to vulnerable families and widows across rural communities.",
    beneficiariesCount: "850+ Families",
    status: 'active',
    showOnHome: true,
    order: 1
  },
  {
    id: 'seed-outreach-2',
    title: "Back to School & Child Education Mission",
    category: "Education",
    location: "Edo & Delta State, Nigeria",
    date: "August 2026",
    image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80",
    videoUrl: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
    raised: 2800,
    goal: 5000,
    description: "Equipping underprivileged children with school supplies, uniforms, textbooks, and tuition scholarships for the new academic session.",
    beneficiariesCount: "400+ Students",
    status: 'active',
    showOnHome: true,
    order: 2
  },
  {
    id: 'seed-outreach-3',
    title: "Hospital & Medical Emergency Compassion Outreach",
    category: "Healthcare",
    location: "General Hospitals & Health Centers",
    date: "June 2026",
    image: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80",
    videoUrl: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
    raised: 8200,
    goal: 8000,
    description: "Settling emergency hospital bills, providing free medical checks, and distributing hygiene kits to stranded patients and new mothers.",
    beneficiariesCount: "250+ Patients",
    status: 'completed',
    showOnHome: true,
    order: 3
  }
];

const DELETED_OUTREACH_STORAGE_KEY = 'luph_deleted_outreach_ids';
const DELETED_STORY_STORAGE_KEY = 'luph_deleted_story_pic_ids';

function getDeletedOutreachIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_OUTREACH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function recordDeletedOutreachId(id: string) {
  try {
    const list = getDeletedOutreachIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DELETED_OUTREACH_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.error('Error recording deleted outreach id:', e);
  }
}

function removeDeletedOutreachId(id: string) {
  try {
    const list = getDeletedOutreachIds().filter(item => item !== id);
    localStorage.setItem(DELETED_OUTREACH_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error removing deleted outreach id:', e);
  }
}

function getDeletedStoryPicIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_STORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function recordDeletedStoryPicId(id: string) {
  try {
    const list = getDeletedStoryPicIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DELETED_STORY_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.error('Error recording deleted story pic id:', e);
  }
}

function removeDeletedStoryPicId(id: string) {
  try {
    const list = getDeletedStoryPicIds().filter(item => item !== id);
    localStorage.setItem(DELETED_STORY_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error removing deleted story pic id:', e);
  }
}

/**
 * Auto-extracts YouTube thumbnail URL from a given video URL
 */
export function getYouTubeThumbnailUrl(videoUrl?: string): string | null {
  if (!videoUrl) return null;
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = videoUrl.match(ytRegex);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}

export function subscribeOutreach(
  callback: (projects: OutreachProject[]) => void,
  onError?: (err: any) => void
) {
  const outreachRef = collection(db, 'outreach_projects');
  return onSnapshot(
    outreachRef,
    (snapshot) => {
      const deletedIds = getDeletedOutreachIds();
      if (snapshot.empty) {
        const activeDefaults = DEFAULT_OUTREACH_PROJECTS.filter(p => !deletedIds.includes(p.id));
        callback(activeDefaults);
      } else {
        const list: OutreachProject[] = snapshot.docs
          .filter(docSnap => !deletedIds.includes(docSnap.id))
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              title: data.title || 'Untitled Project',
              category: data.category || 'Outreach',
              location: data.location || '',
              date: data.date || '',
              image: data.image || data.imageUrl || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80',
              videoUrl: data.videoUrl || data.youtubeUrl || '',
              raised: Number(data.raised) || 0,
              goal: Number(data.goal) || 0,
              description: data.description || '',
              beneficiariesCount: data.beneficiariesCount || '',
              status: data.status || 'active',
              showOnHome: data.showOnHome !== false,
              order: data.order !== undefined ? Number(data.order) : 0,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt
            };
          });

        // Sort by order first, then newest createdAt
        list.sort((a, b) => {
          if ((a.order ?? 0) !== (b.order ?? 0)) {
            return (a.order ?? 0) - (b.order ?? 0);
          }
          if (a.createdAt?.seconds && b.createdAt?.seconds) {
            return b.createdAt.seconds - a.createdAt.seconds;
          }
          return 0;
        });

        callback(list);
      }
    },
    (error) => {
      console.error('Error fetching outreach projects:', error);
      handleFirestoreError(error, OperationType.GET, 'outreach_projects');
      if (onError) onError(error);
    }
  );
}

export async function addOutreachProject(project: Omit<OutreachProject, 'id' | 'createdAt'>) {
  const outreachRef = collection(db, 'outreach_projects');
  try {
    return await addDoc(outreachRef, {
      ...project,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'outreach_projects');
    throw error;
  }
}

export async function updateOutreachProject(id: string, updates: Partial<Omit<OutreachProject, 'id'>>) {
  const projectRef = doc(db, 'outreach_projects', id);
  try {
    // Unmark from deleted if it was previously marked
    removeDeletedOutreachId(id);

    // If it was a seed item, preserve seed defaults so no field is omitted
    const seedMatch = DEFAULT_OUTREACH_PROJECTS.find(p => p.id === id);
    const baseData = seedMatch ? { ...seedMatch } : {};

    const payload: any = {
      ...baseData,
      ...updates,
      updatedAt: serverTimestamp()
    };
    delete payload.id;

    await setDoc(projectRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `outreach_projects/${id}`);
    throw error;
  }
}

export async function deleteOutreachProject(id: string) {
  recordDeletedOutreachId(id);
  const projectRef = doc(db, 'outreach_projects', id);
  try {
    await deleteDoc(projectRef);

    // If Firestore collection is empty, persist remaining defaults to Firestore
    try {
      const snap = await getDocs(collection(db, 'outreach_projects'));
      if (snap.empty) {
        const deletedIds = getDeletedOutreachIds();
        const remainingDefaults = DEFAULT_OUTREACH_PROJECTS.filter(p => p.id !== id && !deletedIds.includes(p.id));
        if (remainingDefaults.length > 0) {
          const batch = writeBatch(db);
          for (const item of remainingDefaults) {
            const { id: itemId, ...data } = item;
            batch.set(doc(db, 'outreach_projects', itemId), {
              ...data,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          await batch.commit();
        }
      }
    } catch (syncErr) {
      console.warn('Note on default outreach sync during delete:', syncErr);
    }
  } catch (error: any) {
    if (id.startsWith('seed-')) {
      console.info('Seed outreach removed locally:', id);
      return;
    }
    console.warn('Firestore delete note for outreach:', id, error?.message || error);
  }
}

// Aliases for Outreach Videos
export const addOutreachVideo = addOutreachProject;
export const updateOutreachVideo = updateOutreachProject;
export const deleteOutreachVideo = deleteOutreachProject;

export interface StoryPicture {
  id: string;
  imageUrl: string;
  title: string;
  caption?: string;
  location?: string;
  date?: string;
  category?: string;
  showOnHomeStory: boolean;
  order?: number;
  createdAt?: any;
  updatedAt?: any;
}

export const DEFAULT_STORY_PICTURES: StoryPicture[] = [];

export function subscribeStoryPictures(
  callback: (pics: StoryPicture[]) => void,
  onError?: (err: any) => void
) {
  const storyRef = collection(db, 'story_pictures');
  return onSnapshot(
    storyRef,
    (snapshot) => {
      const deletedIds = getDeletedStoryPicIds();
      if (snapshot.empty) {
        const activeDefaults = DEFAULT_STORY_PICTURES.filter(p => !deletedIds.includes(p.id));
        callback(activeDefaults);
      } else {
        const list: StoryPicture[] = snapshot.docs
          .filter(docSnap => !deletedIds.includes(docSnap.id))
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              title: data.title || 'Outreach Mission',
              caption: data.caption || '',
              location: data.location || '',
              date: data.date || '',
              category: data.category || 'Outreach',
              imageUrl: data.imageUrl || data.image || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80',
              showOnHomeStory: data.showOnHomeStory !== false,
              order: data.order || 0,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt
            };
          });

        // Sort by order then createdAt
        list.sort((a, b) => {
          if ((a.order || 0) !== (b.order || 0)) {
            return (a.order || 0) - (b.order || 0);
          }
          if (a.createdAt?.seconds && b.createdAt?.seconds) {
            return b.createdAt.seconds - a.createdAt.seconds;
          }
          return 0;
        });

        callback(list);
      }
    },
    (error) => {
      console.error('Error fetching story pictures:', error);
      handleFirestoreError(error, OperationType.GET, 'story_pictures');
      if (onError) onError(error);
    }
  );
}

export async function addStoryPicture(pic: Omit<StoryPicture, 'id' | 'createdAt'>) {
  const storyRef = collection(db, 'story_pictures');
  try {
    return await addDoc(storyRef, {
      ...pic,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'story_pictures');
    throw error;
  }
}

export async function updateStoryPicture(id: string, updates: Partial<Omit<StoryPicture, 'id'>>) {
  const picRef = doc(db, 'story_pictures', id);
  try {
    removeDeletedStoryPicId(id);
    await setDoc(picRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `story_pictures/${id}`);
    throw error;
  }
}

export async function deleteStoryPicture(id: string) {
  recordDeletedStoryPicId(id);
  const picRef = doc(db, 'story_pictures', id);
  try {
    await deleteDoc(picRef);
  } catch (error: any) {
    if (id.startsWith('seed-')) {
      console.info('Seed story picture removed locally:', id);
      return;
    }
    console.warn('Firestore delete note for story picture:', id, error?.message || error);
  }
}


