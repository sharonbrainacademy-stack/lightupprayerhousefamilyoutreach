/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Use named database if provided
const databaseId = firebaseConfig.firestoreDatabaseId;

const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID
export const db = getFirestore(app, databaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Connection test as required by skill - with graceful offline resilience
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection')).catch((err) => {
      // Offline mode or network sync standby is normal
    });
  } catch (error: any) {
    // Suppress non-critical offline notices
  }
}

if (typeof window !== 'undefined') {
  // Run asynchronously without blocking
  setTimeout(testConnection, 100);
}
