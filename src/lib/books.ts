/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  onSnapshot, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  getDocs, 
  writeBatch,
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestore-errors';
import { BookItem } from '../types';
export type { BookItem };

export const BOOK_CATEGORIES = [
  'Prayer & Intercession',
  'Spiritual Growth & Destiny',
  'Deliverance & Warfare',
  'Faith & Healing',
  'Holy Spirit & Fire',
  'Prophetic Decrees',
  'Kingdom Leadership',
  'Evangelism & Missions',
  'General Christian Living'
] as const;

export const BOOK_FORMATS = [
  'PDF E-Book (Free Download)',
  'Digital Study Guide',
  'Paperback Edition',
  'Hardcover Edition',
  'Audiobook',
  'Kindle / ePub'
] as const;

export const DEFAULT_BOOKS: BookItem[] = [
  {
    id: 'seed-book-1',
    title: 'The Fire on the Altar',
    subtitle: 'Secrets of Answered Midnight Prayers & Breaking Generational Altars',
    author: 'Pastor Osaro Aghedo',
    description: 'An explosive apostolic revelation into the mechanics of midnight warfare, the holy priesthood of prayer, and establishing continuous spiritual altars that command undeniable divine answers in your life, family, and destiny.',
    coverImageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80',
    category: 'Prayer & Intercession',
    format: 'PDF E-Book (Free Download)',
    pages: 184,
    publishedYear: '2026',
    isbn: '978-978-992-101-4',
    downloadUrl: '',
    previewUrl: '',
    purchaseUrl: '',
    isFree: true,
    price: 'Free Download',
    isFeatured: true,
    isPublished: true,
    order: 1
  },
  {
    id: 'seed-book-2',
    title: 'Walking in Divine Assignment',
    subtitle: 'Unlocking Heavenly Blueprints & Overcoming Destiny Distractions',
    author: 'Pastor Osaro Aghedo',
    description: 'A transformative spiritual guide for every believer seeking absolute clarity on God’s sovereign ordination, navigating divine seasons, conquering procrastination, and stepping courageously into kingdom assignments.',
    coverImageUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80',
    category: 'Spiritual Growth & Destiny',
    format: 'PDF E-Book (Free Download)',
    pages: 160,
    publishedYear: '2025',
    isbn: '978-978-992-102-1',
    downloadUrl: '',
    previewUrl: '',
    purchaseUrl: '',
    isFree: true,
    price: 'Free Download',
    isFeatured: true,
    isPublished: true,
    order: 2
  },
  {
    id: 'seed-book-3',
    title: 'Covenant Deliverance & Dominion',
    subtitle: 'Biblical Keys to Total Victory and Destroying Ancient Strongholds',
    author: 'Pastor Osaro Aghedo',
    description: 'A deep biblical treatise on total spiritual freedom, enforcing Christ’s finished work on the cross, canceling evil ordinances, and establishing impenetrable covenant protection over children, career, and household.',
    coverImageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80',
    category: 'Deliverance & Warfare',
    format: 'Digital Study Guide',
    pages: 210,
    publishedYear: '2025',
    isbn: '978-978-992-103-8',
    downloadUrl: '',
    previewUrl: '',
    purchaseUrl: '',
    isFree: true,
    price: 'Free Download',
    isFeatured: false,
    isPublished: true,
    order: 3
  }
];

const DELETED_BOOKS_STORAGE_KEY = 'luph_deleted_book_ids';

function getDeletedBookIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_BOOKS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function recordDeletedBookId(id: string) {
  try {
    const list = getDeletedBookIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DELETED_BOOKS_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.error('Error recording deleted book id:', e);
  }
}

function removeDeletedBookId(id: string) {
  try {
    const list = getDeletedBookIds().filter(item => item !== id);
    localStorage.setItem(DELETED_BOOKS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error removing deleted book id:', e);
  }
}

export function subscribeBooks(
  callback: (books: BookItem[]) => void,
  onError?: (err: any) => void
) {
  const booksRef = collection(db, 'books');
  return onSnapshot(
    booksRef,
    (snapshot) => {
      const deletedIds = getDeletedBookIds();
      if (snapshot.empty) {
        const activeDefaults = DEFAULT_BOOKS.filter(b => !deletedIds.includes(b.id));
        callback(activeDefaults);
      } else {
        const list: BookItem[] = snapshot.docs
          .filter(docSnap => !deletedIds.includes(docSnap.id))
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              title: data.title || 'Untitled Book',
              subtitle: data.subtitle || '',
              author: data.author || 'Pastor Osaro Aghedo',
              description: data.description || '',
              coverImageUrl: data.coverImageUrl || '',
              category: data.category || 'Prayer & Intercession',
              format: data.format || 'PDF E-Book',
              pages: data.pages || '',
              publishedYear: data.publishedYear || '',
              isbn: data.isbn || '',
              downloadUrl: data.downloadUrl || '',
              previewUrl: data.previewUrl || '',
              purchaseUrl: data.purchaseUrl || '',
              isFree: data.isFree !== undefined ? Boolean(data.isFree) : true,
              price: data.price || 'Free Download',
              isFeatured: Boolean(data.isFeatured),
              isPublished: data.isPublished !== undefined ? Boolean(data.isPublished) : true,
              order: Number(data.order) || 0,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt
            };
          });

        // Sort by order ascending, then title
        list.sort((a, b) => {
          if ((a.order ?? 999) !== (b.order ?? 999)) {
            return (a.order ?? 999) - (b.order ?? 999);
          }
          return a.title.localeCompare(b.title);
        });

        callback(list);
      }
    },
    (error) => {
      console.warn('Could not fetch books from Firestore, using local fallback:', error);
      const deletedIds = getDeletedBookIds();
      callback(DEFAULT_BOOKS.filter(b => !deletedIds.includes(b.id)));
      if (onError) onError(error);
    }
  );
}

export async function addBook(data: Omit<BookItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const path = 'books';
  try {
    const cleanPayload: any = {
      title: data.title.trim(),
      subtitle: (data.subtitle || '').trim(),
      author: (data.author || 'Pastor Osaro Aghedo').trim(),
      description: (data.description || '').trim(),
      coverImageUrl: (data.coverImageUrl || '').trim(),
      category: data.category || 'Prayer & Intercession',
      format: data.format || 'PDF E-Book (Free Download)',
      pages: data.pages ? String(data.pages).trim() : '',
      publishedYear: data.publishedYear ? String(data.publishedYear).trim() : '',
      isbn: (data.isbn || '').trim(),
      downloadUrl: (data.downloadUrl || '').trim(),
      previewUrl: (data.previewUrl || '').trim(),
      purchaseUrl: (data.purchaseUrl || '').trim(),
      isFree: data.isFree !== undefined ? Boolean(data.isFree) : true,
      price: (data.price || 'Free Download').trim(),
      isFeatured: Boolean(data.isFeatured),
      isPublished: data.isPublished !== undefined ? Boolean(data.isPublished) : true,
      order: Number(data.order) || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, path), cleanPayload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function updateBook(bookId: string, data: Partial<BookItem>): Promise<void> {
  const path = `books/${bookId}`;
  try {
    // Unmark from deleted if it was previously marked
    removeDeletedBookId(bookId);

    // If it was a seed book, merge with original seed data so no field is lost
    const seedMatch = DEFAULT_BOOKS.find(b => b.id === bookId);
    const baseData = seedMatch ? { ...seedMatch } : {};

    const updatePayload: any = {
      ...baseData,
      updatedAt: serverTimestamp()
    };

    if (data.title !== undefined) updatePayload.title = data.title.trim();
    if (data.subtitle !== undefined) updatePayload.subtitle = data.subtitle.trim();
    if (data.author !== undefined) updatePayload.author = data.author.trim();
    if (data.description !== undefined) updatePayload.description = data.description.trim();
    if (data.coverImageUrl !== undefined) updatePayload.coverImageUrl = data.coverImageUrl.trim();
    if (data.category !== undefined) updatePayload.category = data.category;
    if (data.format !== undefined) updatePayload.format = data.format;
    if (data.pages !== undefined) updatePayload.pages = String(data.pages).trim();
    if (data.publishedYear !== undefined) updatePayload.publishedYear = String(data.publishedYear).trim();
    if (data.isbn !== undefined) updatePayload.isbn = data.isbn.trim();
    if (data.downloadUrl !== undefined) updatePayload.downloadUrl = data.downloadUrl.trim();
    if (data.previewUrl !== undefined) updatePayload.previewUrl = data.previewUrl.trim();
    if (data.purchaseUrl !== undefined) updatePayload.purchaseUrl = data.purchaseUrl.trim();
    if (data.isFree !== undefined) updatePayload.isFree = Boolean(data.isFree);
    if (data.price !== undefined) updatePayload.price = data.price.trim();
    if (data.isFeatured !== undefined) updatePayload.isFeatured = Boolean(data.isFeatured);
    if (data.isPublished !== undefined) updatePayload.isPublished = Boolean(data.isPublished);
    if (data.order !== undefined) updatePayload.order = Number(data.order);

    delete updatePayload.id;

    const docRef = doc(db, 'books', bookId);
    await setDoc(docRef, updatePayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteBook(bookId: string): Promise<void> {
  // 1. Immediately record in local storage so UI updates instantly and optimistically
  recordDeletedBookId(bookId);
  const path = `books/${bookId}`;

  try {
    const docRef = doc(db, 'books', bookId);
    await deleteDoc(docRef);

    // If Firestore collection is empty, persist remaining defaults to Firestore
    try {
      const snap = await getDocs(collection(db, 'books'));
      if (snap.empty) {
        const deletedIds = getDeletedBookIds();
        const remainingDefaults = DEFAULT_BOOKS.filter(b => b.id !== bookId && !deletedIds.includes(b.id));
        if (remainingDefaults.length > 0) {
          const batch = writeBatch(db);
          for (const item of remainingDefaults) {
            const { id: itemId, ...data } = item;
            batch.set(doc(db, 'books', itemId), {
              ...data,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          await batch.commit();
        }
      }
    } catch (syncErr) {
      console.info('Default books sync note during delete:', syncErr);
    }
  } catch (error: any) {
    // If it's a seed book that was only locally initialized, the deletion has already succeeded locally
    if (bookId.startsWith('seed-')) {
      console.info('Seed book removed locally:', bookId);
      return;
    }
    console.warn('Firestore delete note for book:', bookId, error?.message || error);
  }
}

export async function toggleBookPublished(bookId: string, currentStatus?: boolean): Promise<void> {
  await updateBook(bookId, { isPublished: !currentStatus });
}

export async function toggleBookFeatured(bookId: string, currentStatus?: boolean): Promise<void> {
  await updateBook(bookId, { isFeatured: !currentStatus });
}

export async function importBooksBatch(items: Partial<BookItem>[]): Promise<{ successCount: number; errors: string[] }> {
  const errors: string[] = [];
  let successCount = 0;

  if (!items || items.length === 0) {
    return { successCount: 0, errors: ['No books provided for import.'] };
  }

  // Chunk items into batches of 400 (Firestore limit is 500)
  const chunkSize = 400;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const rawItem of chunk) {
      if (!rawItem.title || !rawItem.title.trim()) {
        errors.push(`Skipped record without title: ${JSON.stringify(rawItem).slice(0, 40)}...`);
        continue;
      }

      const docRef = doc(collection(db, 'books'));
      const cleanPayload: any = {
        title: rawItem.title.trim(),
        subtitle: (rawItem.subtitle || '').trim(),
        author: (rawItem.author || 'Pastor Osaro Aghedo').trim(),
        description: (rawItem.description || '').trim(),
        coverImageUrl: (rawItem.coverImageUrl || '').trim(),
        category: rawItem.category || 'Prayer & Intercession',
        format: rawItem.format || 'PDF E-Book (Free Download)',
        pages: rawItem.pages ? String(rawItem.pages).trim() : '',
        publishedYear: rawItem.publishedYear ? String(rawItem.publishedYear).trim() : new Date().getFullYear().toString(),
        isbn: (rawItem.isbn || '').trim(),
        downloadUrl: (rawItem.downloadUrl || '').trim(),
        previewUrl: (rawItem.previewUrl || '').trim(),
        purchaseUrl: (rawItem.purchaseUrl || '').trim(),
        isFree: rawItem.isFree !== undefined ? Boolean(rawItem.isFree) : true,
        price: (rawItem.price || 'Free Download').trim(),
        isFeatured: Boolean(rawItem.isFeatured),
        isPublished: rawItem.isPublished !== undefined ? Boolean(rawItem.isPublished) : true,
        order: Number(rawItem.order) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      batch.set(docRef, cleanPayload);
      successCount++;
    }

    try {
      await batch.commit();
    } catch (batchErr: any) {
      console.error('Failed to commit book batch:', batchErr);
      errors.push(`Batch write error: ${batchErr?.message || 'Unknown Firestore error'}`);
    }
  }

  return { successCount, errors };
}

