'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'

interface FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userRole: string | null;
  verificationStatus: string | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
    const [user, setUser] = useState<User | null>(null);
    const [isUserLoading, setIsUserLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [verificationStatus, setVerificationStatus] = useState<string | null>(null);


  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => { 
        setUser(firebaseUser);
        setIsUserLoading(false);
        if (!firebaseUser) {
          // Clear role and status if user logs out
          setUserRole(null);
          setVerificationStatus(null);
        }
      },
      (error) => { 
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUser(null);
        setIsUserLoading(false);
        setUserRole(null);
        setVerificationStatus(null);
      }
    );
    return () => unsubscribe(); 
  }, [auth]); 

  // Effect to subscribe to the user's document in Firestore for role and status
  useEffect(() => {
    if (user) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserRole(data.role || null);
                setVerificationStatus(data.verificationStatus || null);
            } else {
                setUserRole(null);
                setVerificationStatus(null);
            }
        }, (error) => {
            console.error("Error fetching user document:", error);
            setUserRole(null);
            setVerificationStatus(null);
        });
        return () => unsubscribeUser();
    }
  }, [user, firestore]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => ({
      firebaseApp,
      firestore,
      auth,
      user,
      isUserLoading,
      userRole,
      verificationStatus,
    }), [firebaseApp, firestore, auth, user, isUserLoading, userRole, verificationStatus]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};


/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if used outside provider.
 */
const useFirebaseContext = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebaseContext must be used within a FirebaseProvider.');
  }
  return context;
};


/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebaseContext();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebaseContext();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebaseContext();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object and loading status.
 * @returns {UserHookResult} Object with user, isUserLoading.
 */
export const useUser = (): UserHookResult => {
  const { user, isUserLoading } = useFirebaseContext(); 
  return { user, isUserLoading };
};

export const useUserRole = () => {
    const { userRole, verificationStatus, isUserLoading } = useFirebaseContext();
    return { userRole, verificationStatus, loading: isUserLoading };
}
