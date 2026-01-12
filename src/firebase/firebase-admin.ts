'use server';
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';

function getFirebaseAdmin(): App {
  if (getApps().some(app => app.name === 'admin')) {
    return getApp('admin');
  }

  let adminConfig = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;

  if (!adminConfig) {
    throw new Error('FIREBASE_ADMIN_SERVICE_ACCOUNT environment variable is not set.');
  }

  let serviceAccountJson;
  try {
    // Attempt to parse. If it fails, try to clean it up (remove extra newlines or whitespace)
    serviceAccountJson = JSON.parse(adminConfig);
  } catch (e) {
    try {
      // Common fix: if it was pasted as a multiline string without proper quoting, 
      // replace actual newlines with spaces or try to handle literal \n
      const cleanedConfig = adminConfig.trim().replace(/\n/g, '');
      serviceAccountJson = JSON.parse(cleanedConfig);
    } catch (e2) {
      console.error('[FirebaseAdmin] Failed to parse service account JSON:', e2);
      console.error('[FirebaseAdmin] Raw string start:', adminConfig.substring(0, 50) + '...');
      throw new Error(`Could not parse FIREBASE_ADMIN_SERVICE_ACCOUNT. Expected a valid JSON string. Check your .env.local formatting. Error: ${e2}`);
    }
  }

  return initializeApp({
    credential: cert(serviceAccountJson)
  }, 'admin');
}

export { getFirebaseAdmin };
