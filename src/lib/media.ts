/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestore-errors';

export interface SermonItem {
  id: string;
  title: string;
  minister: string;
  date: string; // e.g. "July 19, 2026" or YYYY-MM-DD
  type: 'video' | 'audio';
  thumbnailUrl: string;
  mediaUrl?: string; // YouTube URL, MP3 audio link, Spotify, etc.
  description?: string;
  scripture?: string;
  duration?: string; // e.g. "45 mins"
  createdAt?: any;
}

export const DEFAULT_SERMONS: SermonItem[] = [
  {
    id: 'seed-sermon-gathering-champions',
    title: "Gathering of Champions — Breaking Limitations & Possessing the Land",
    date: "August 2026",
    minister: "Pastor Osaro Aghedo & Anointed Ministers",
    type: "video",
    thumbnailUrl: "/flyer_lagos.jpg",
    mediaUrl: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
    description: "The apostolic gathering of champions, revivalists, and prayer warriors lifting up prayer altars across the nations.",
    scripture: "Hebrews 11:32-34, 1 Samuel 22:1-2",
    duration: "1 hr 25 mins"
  },
  {
    id: 'seed-sermon-1',
    title: "The Fire That Never Goes Out",
    date: "July 19, 2026",
    minister: "Pastor Osaro Aghedo & Anointed Ministers",
    type: "video",
    thumbnailUrl: "https://images.unsplash.com/photo-1490161705155-d28c4210e9c1?auto=format&fit=crop&q=80",
    mediaUrl: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
    description: "A foundational apostolic teaching on sustaining spiritual fervor, midnight prayer momentum, and altar sanctification.",
    scripture: "Leviticus 6:13, Romans 12:11",
    duration: "1 hr 15 mins"
  },
  {
    id: 'seed-sermon-2',
    title: "Walking in Divine Purpose & Divine Assignment",
    date: "July 12, 2026",
    minister: "Pastor Osaro Aghedo",
    type: "audio",
    thumbnailUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80",
    mediaUrl: "",
    description: "Unlocking heavenly blueprints, overcoming destiny distractions, and stepping courageously into divine mandates.",
    scripture: "Jeremiah 1:5, Proverbs 3:5-6",
    duration: "52 mins"
  },
  {
    id: 'seed-sermon-3',
    title: "The Assignment of God in My Life",
    date: "July 05, 2026",
    minister: "Anointed Ministers of God",
    type: "video",
    thumbnailUrl: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&q=80",
    mediaUrl: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
    description: "Deep revelations into divine ordination, consecration for service, and bearing undeniable kingdom fruit.",
    scripture: "John 15:16",
    duration: "1 hr 04 mins"
  },
  {
    id: 'seed-sermon-4',
    title: "Chosen for Greatness & Unshakable Faith",
    date: "June 28, 2026",
    minister: "Pastor Osaro Aghedo",
    type: "audio",
    thumbnailUrl: "https://images.unsplash.com/photo-1464692805480-a69dfaafdb0d?auto=format&fit=crop&q=80",
    mediaUrl: "",
    description: "Breaking demonic limitations, rising above family covenants, and possessing kingdom inheritance through aggressive faith.",
    scripture: "Deuteronomy 7:6, Genesis 12:1-3",
    duration: "48 mins"
  }
];

const DELETED_SERMONS_STORAGE_KEY = 'luph_deleted_sermon_ids';

function getDeletedSermonIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_SERMONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function recordDeletedSermonId(id: string) {
  try {
    const list = getDeletedSermonIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DELETED_SERMONS_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.error('Error recording deleted sermon id:', e);
  }
}

function removeDeletedSermonId(id: string) {
  try {
    const list = getDeletedSermonIds().filter(item => item !== id);
    localStorage.setItem(DELETED_SERMONS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error removing deleted sermon id:', e);
  }
}

export function subscribeSermons(
  callback: (sermons: SermonItem[]) => void,
  onError?: (err: any) => void
) {
  const sermonsRef = collection(db, 'sermons');
  return onSnapshot(
    sermonsRef,
    async (snapshot) => {
      if (snapshot.empty) {
        // Return default sermons excluding any deleted ones
        const deletedIds = getDeletedSermonIds();
        const activeDefaults = DEFAULT_SERMONS.filter(s => !deletedIds.includes(s.id));
        callback(activeDefaults);
      } else {
        const deletedIds = getDeletedSermonIds();
        const list: SermonItem[] = snapshot.docs
          .filter(docSnap => !deletedIds.includes(docSnap.id))
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              title: data.title || 'Untitled Teaching',
              minister: data.minister || 'Anointed Minister of God',
              date: data.date || '',
              type: data.type === 'audio' ? 'audio' : 'video',
              thumbnailUrl: data.thumbnailUrl || data.thumbnail || 'https://images.unsplash.com/photo-1490161705155-d28c4210e9c1?auto=format&fit=crop&q=80',
              mediaUrl: data.mediaUrl || data.youtubeId || data.audioUrl || '',
              description: data.description || '',
              scripture: data.scripture || '',
              duration: data.duration || '',
              createdAt: data.createdAt
            };
          });
        
        // Sort newest first
        list.sort((a, b) => {
          if (a.createdAt?.seconds && b.createdAt?.seconds) {
            return b.createdAt.seconds - a.createdAt.seconds;
          }
          return 0;
        });

        callback(list);
      }
    },
    (error) => {
      console.error('Error fetching sermons from Firestore:', error);
      handleFirestoreError(error, OperationType.GET, 'sermons');
      if (onError) onError(error);
    }
  );
}

export async function addSermon(sermon: Omit<SermonItem, 'id' | 'createdAt'>) {
  const sermonsRef = collection(db, 'sermons');
  try {
    return await addDoc(sermonsRef, {
      ...sermon,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'sermons');
    throw error;
  }
}

export async function updateSermon(id: string, updates: Partial<Omit<SermonItem, 'id'>>) {
  const sermonRef = doc(db, 'sermons', id);
  try {
    // If it was a seed sermon, merge with original seed data so no field is lost
    const seedMatch = DEFAULT_SERMONS.find(s => s.id === id);
    const baseData = seedMatch ? { ...seedMatch } : {};
    
    // Unmark from deleted if it was previously marked
    removeDeletedSermonId(id);

    const payload: any = {
      ...baseData,
      ...updates,
      updatedAt: serverTimestamp()
    };
    delete payload.id;

    await setDoc(sermonRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sermons/${id}`);
    throw error;
  }
}

export async function deleteSermon(id: string) {
  recordDeletedSermonId(id);
  const sermonRef = doc(db, 'sermons', id);
  try {
    await deleteDoc(sermonRef);

    // If Firestore collection is empty, persist remaining defaults to Firestore
    try {
      const snap = await getDocs(collection(db, 'sermons'));
      if (snap.empty) {
        const deletedIds = getDeletedSermonIds();
        const remainingDefaults = DEFAULT_SERMONS.filter(s => s.id !== id && !deletedIds.includes(s.id));
        if (remainingDefaults.length > 0) {
          const batch = writeBatch(db);
          for (const item of remainingDefaults) {
            const { id: itemId, ...data } = item;
            batch.set(doc(db, 'sermons', itemId), {
              ...data,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          await batch.commit();
        }
      }
    } catch (seedErr) {
      console.warn('Note on default sermon sync during delete:', seedErr);
    }
  } catch (error: any) {
    if (id.startsWith('seed-')) {
      console.info('Seed sermon removed locally:', id);
      return;
    }
    console.warn('Firestore delete note for sermon:', id, error?.message || error);
  }
}

export async function seedInitialSermonsIfEmpty() {
  try {
    const sermonsRef = collection(db, 'sermons');
    const snap = await getDocs(sermonsRef);
    if (snap.empty) {
      const batch = writeBatch(db);
      for (const item of DEFAULT_SERMONS) {
        const newDocRef = doc(collection(db, 'sermons'));
        const { id, ...data } = item;
        batch.set(newDocRef, {
          ...data,
          createdAt: serverTimestamp()
        });
      }
      await batch.commit();
    }
  } catch (err) {
    console.error('Failed to seed default sermons:', err);
  }
}
