/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { UserProfile, UserRole } from '../types';
import { handleFirestoreError, OperationType } from './firestore-errors';

export const SUPER_ADMIN_EMAILS = [
  'brainstormacademybsa@gmail.com',
  'imosesstephen@gmail.com'
];

export const MASTER_ADMIN_PASSCODES = [
  'LightUp2026!',
  'LIGHTUP2026',
  'lightup2026',
  '777777',
  'REVIVAL2026'
];

/**
 * Checks whether an email address is approved for Admin Dashboard access
 */
export async function checkIsEmailApprovedAdmin(email: string): Promise<{ approved: boolean; role: UserRole }> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return { approved: false, role: 'member' };

  // 1. Check Super Admin hardcoded whitelist
  const isSuper = SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail);
  if (isSuper) {
    return { approved: true, role: 'super_admin' };
  }

  // 2. Query Firestore users collection for pre-assigned or existing admin roles
  try {
    const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as UserProfile;
        if (data.role === 'super_admin' || data.role === 'admin_assistant') {
          return { approved: true, role: data.role };
        }
      }
    }
  } catch (err) {
    console.warn('Error checking approved admin email in Firestore:', err);
  }

  return { approved: false, role: 'member' };
}

/**
 * Retrieves an admin's custom password from Firestore or localStorage
 */
export async function getAdminCustomPassword(email: string): Promise<string | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;
  const docId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  try {
    const docRef = doc(db, 'admin_passwords', docId);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.password) {
      return snap.data().password as string;
    }
  } catch (err) {
    console.warn('Error reading custom admin password from Firestore:', err);
  }
  try {
    const localPass = localStorage.getItem('lightup_admin_pass_' + docId);
    if (localPass) return localPass;
  } catch (e) {}

  return null;
}

/**
 * Saves or updates an admin's custom password in Firestore and localStorage
 */
export async function setAdminCustomPassword(email: string, password: string): Promise<boolean> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  if (!cleanEmail || !cleanPass) return false;
  const docId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  try {
    await setDoc(doc(db, 'admin_passwords', docId), {
      email: cleanEmail,
      password: cleanPass,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving custom admin password to Firestore:', err);
  }
  try {
    localStorage.setItem('lightup_admin_pass_' + docId, cleanPass);
  } catch (e) {}

  return true;
}

const LOCAL_STORAGE_AUTH_KEY = 'lightup_admin_passcode_session';
const CACHED_PROFILE_KEY_PREFIX = 'lightup_user_profile_cache_';

interface AuthContextType {
  user: User | { uid: string; email: string; displayName: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  isLoggingIn: boolean;
  authError: string | null;
  login: () => Promise<boolean>;
  loginWithPasscode: (email: string, pass: string) => Promise<boolean>;
  updateAdminPassword: (newPassword: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => setAuthError(null);

  useEffect(() => {
    // Check if there is an active local admin session first
    try {
      const savedAdminSession = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
      if (savedAdminSession) {
        const parsed = JSON.parse(savedAdminSession);
        if (parsed && parsed.email) {
          const isSuper = SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === (parsed.email || '').toLowerCase());
          const customUser = {
            uid: parsed.uid || 'admin-master-' + parsed.email.replace(/[^a-zA-Z0-9]/g, '_'),
            email: parsed.email,
            displayName: parsed.displayName || 'Super Administrator',
          };
          const customProfile: UserProfile = {
            uid: customUser.uid,
            email: parsed.email,
            displayName: parsed.displayName || 'Super Administrator',
            role: isSuper ? 'super_admin' : (parsed.role || 'super_admin'),
            attendanceCount: 100,
            joinedAt: parsed.joinedAt || new Date().toISOString(),
          };
          setUser(customUser);
          setProfile(customProfile);
          setLoading(false);
          // Prime Firebase Auth in background if not already connected
          if (!auth.currentUser) {
            signInAnonymously(auth).catch(() => {});
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Could not parse local admin session:', e);
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Don't overwrite if local admin session is active
      if (localStorage.getItem(LOCAL_STORAGE_AUTH_KEY)) {
        return;
      }

      setUser(firebaseUser);
      if (firebaseUser) {
        const userEmail = (firebaseUser.email || '').toLowerCase().trim();
        const isSuperAdminEmail = SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail);

        // 1. Check if cached profile exists for fast offline startup
        let initialProfile: UserProfile | null = null;
        try {
          const cachedStr = localStorage.getItem(CACHED_PROFILE_KEY_PREFIX + firebaseUser.uid);
          if (cachedStr) {
            initialProfile = JSON.parse(cachedStr);
            if (initialProfile) {
              setProfile(initialProfile);
            }
          }
        } catch (e) {
          // ignore cache read error
        }

        const fallbackProfile: UserProfile = initialProfile || {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Member',
          role: isSuperAdminEmail ? 'super_admin' : 'member',
          attendanceCount: 0,
          joinedAt: new Date().toISOString(),
        };

        // If no cached profile, set fallback immediately so UI is not blocked
        if (!initialProfile) {
          setProfile(fallbackProfile);
        }

        // 2. Fetch or synchronize profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            if (isSuperAdminEmail && data.role !== 'super_admin') {
              data.role = 'super_admin';
              updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'super_admin' }).catch(() => {});
            }
            setProfile(data);
            try {
              localStorage.setItem(CACHED_PROFILE_KEY_PREFIX + firebaseUser.uid, JSON.stringify(data));
            } catch (e) {}
          } else {
            // Check if super admin pre-assigned an admin role for this email
            let preAssignedRole: UserRole = isSuperAdminEmail ? 'super_admin' : 'member';
            try {
              if (firebaseUser.email) {
                const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
                const preSnap = await getDocs(q);
                if (!preSnap.empty) {
                  const existingDocData = preSnap.docs[0].data() as UserProfile;
                  if (existingDocData.role && existingDocData.role !== 'member') {
                    preAssignedRole = existingDocData.role;
                  }
                }
              }
            } catch (queryErr) {
              console.info('Pre-assigned role check note:', queryErr);
            }

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Member',
              role: preAssignedRole,
              attendanceCount: 0,
              joinedAt: new Date().toISOString(),
            };
            setDoc(doc(db, 'users', firebaseUser.uid), newProfile).catch(() => {});
            setProfile(newProfile);
            try {
              localStorage.setItem(CACHED_PROFILE_KEY_PREFIX + firebaseUser.uid, JSON.stringify(newProfile));
            } catch (e) {}
          }
        } catch (error: any) {
          if (error instanceof Error && error.message.includes('permission')) {
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          }
          // In offline mode, keep the resilient fallback/cached profile
          setProfile((current) => current || fallbackProfile);
          console.info('Auth operating with cached/resilient profile.');
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (): Promise<boolean> => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      return true;
    } catch (error: any) {
      const code = error?.code || '';
      const message = error?.message || '';

      // User closed popup or cancelled auth flow — normal user action, not an application error
      if (
        code === 'auth/user-cancelled' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        message.includes('user-cancelled') ||
        message.includes('popup-closed-by-user')
      ) {
        console.info('Google sign-in was cancelled or dismissed by user.');
        return false;
      }

      // Handle other non-cancellation errors gracefully
      let userFriendlyMessage = 'Sign in was not completed. Please try again.';
      if (code === 'auth/api-key-not-found' || message.includes('api-key-not-found')) {
        userFriendlyMessage = 'Google Sign-In API key is not provisioned for this environment. Please use the Admin Master Passcode below to sign in instantly!';
      } else if (code === 'auth/popup-blocked') {
        userFriendlyMessage = 'The sign-in popup was blocked by your browser. Please allow popups for this site or use the Admin Master Passcode below.';
      } else if (code === 'auth/network-request-failed') {
        userFriendlyMessage = 'Network connection failed during sign-in. Please check your internet connection.';
      } else if (code === 'auth/unauthorized-domain') {
        userFriendlyMessage = 'This domain is not authorized for Google Sign-In in Firebase configuration.';
      } else if (message) {
        userFriendlyMessage = message;
      }

      console.warn('Sign-in notification:', code, message);
      setAuthError(userFriendlyMessage);
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loginWithPasscode = async (email: string, pass: string): Promise<boolean> => {
    setIsLoggingIn(true);
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanEmail) {
      setAuthError('Please enter your administrator email address.');
      setIsLoggingIn(false);
      return false;
    }

    if (!cleanPass) {
      setAuthError('Please enter your password.');
      setIsLoggingIn(false);
      return false;
    }

    // STRICT CHECK 1: Only approved administrator email addresses are permitted
    const approval = await checkIsEmailApprovedAdmin(cleanEmail);
    if (!approval.approved) {
      setAuthError('Unauthorized account. This email address has not been granted administrator permissions.');
      setIsLoggingIn(false);
      return false;
    }

    // Check if this admin already has a personal custom password registered
    const existingCustomPass = await getAdminCustomPassword(cleanEmail);

    if (existingCustomPass) {
      // Admin HAS a custom password set up
      const isCustomPassValid = (cleanPass === existingCustomPass);
      const isMasterPassValid = MASTER_ADMIN_PASSCODES.includes(cleanPass);

      if (!isCustomPassValid && !isMasterPassValid) {
        setAuthError('Incorrect password. Please enter the personal password you created for your admin account.');
        setIsLoggingIn(false);
        return false;
      }
    } else {
      // FIRST TIME ENTRY: Automatically register their personal custom password!
      if (cleanPass.length < 4) {
        setAuthError('First-time entry setup: Please choose a password at least 4 characters long.');
        setIsLoggingIn(false);
        return false;
      }

      await setAdminCustomPassword(cleanEmail, cleanPass);
    }

    try {
      const isSuper = approval.role === 'super_admin' || SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail);
      const uid = 'admin-master-' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const customUser = {
        uid,
        email: cleanEmail,
        displayName: isSuper ? 'Master Super Admin' : 'Church Administrator',
      };

      const customProfile: UserProfile = {
        uid,
        email: cleanEmail,
        displayName: isSuper ? 'Master Super Admin' : 'Church Administrator',
        role: isSuper ? 'super_admin' : (approval.role || 'admin_assistant'),
        attendanceCount: 100,
        joinedAt: new Date().toISOString(),
      };

      // Save to Firestore if available
      try {
        await setDoc(doc(db, 'users', uid), customProfile, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore user profile sync note:', fsErr);
      }

      // Persist to local storage
      localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify({
        uid,
        email: cleanEmail,
        displayName: customUser.displayName,
        role: customProfile.role,
        joinedAt: customProfile.joinedAt
      }));

      setUser(customUser);
      setProfile(customProfile);

      // Prime Firebase Auth in background if not already connected
      if (!auth.currentUser) {
        signInAnonymously(auth).catch(() => {});
      }

      return true;
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to authenticate.');
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const updateAdminPassword = async (newPassword: string): Promise<boolean> => {
    if (!profile?.email) {
      setAuthError('No active administrator session found.');
      return false;
    }
    const cleanPass = newPassword.trim();
    if (cleanPass.length < 4) {
      setAuthError('New password must be at least 4 characters long.');
      return false;
    }

    const success = await setAdminCustomPassword(profile.email, cleanPass);
    if (success) {
      setAuthError(null);
    } else {
      setAuthError('Failed to update admin password.');
    }
    return success;
  };

  const logout = async () => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
      await signOut(auth);
    } catch (error) {
      console.warn('Sign-out warning:', error);
    } finally {
      setUser(null);
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isLoggingIn, authError, login, loginWithPasscode, updateAdminPassword, logout, clearAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

