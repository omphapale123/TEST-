'use client';
import { useMemo, type ReactNode } from 'react';
import { FirebaseProvider, initializeFirebase } from '@/firebase';

// This is the main provider that will be used in the layout.
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
};
