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
    console.log('[FirebaseAdmin] Initial parse failed, attempting cleanup...');
    try {
      // Stage 1: Trim whitespace
      let cleanedConfig = adminConfig.trim();
      console.log('[FirebaseAdmin] After trim, first 50 chars:', cleanedConfig.substring(0, 50));

      // Stage 2: Remove outer quotes if present
      if ((cleanedConfig.startsWith('"') && cleanedConfig.endsWith('"')) ||
        (cleanedConfig.startsWith("'") && cleanedConfig.endsWith("'"))) {
        cleanedConfig = cleanedConfig.slice(1, -1);
        console.log('[FirebaseAdmin] Removed outer quotes, first 50 chars:', cleanedConfig.substring(0, 50));
      }

      // Stage 3: Replace literal \n with nothing
      cleanedConfig = cleanedConfig.replace(/\\n/g, '');

      // Stage 4: Trim again after removing quotes (might have more whitespace)
      cleanedConfig = cleanedConfig.trim();
      console.log('[FirebaseAdmin] After second trim, first 50 chars:', cleanedConfig.substring(0, 50));

      // Stage 5: Check if missing opening brace and/or quote
      // Special case: if it starts with 'propertyName": ' (missing both { and opening ")
      if (cleanedConfig.match(/^[a-zA-Z_][a-zA-Z0-9_]*":\s*/)) {
        console.log('[FirebaseAdmin] Detected missing { and opening quote, adding both');
        cleanedConfig = '{"' + cleanedConfig;
      } else if (!cleanedConfig.startsWith('{')) {
        console.log('[FirebaseAdmin] Detected missing {, adding it');
        cleanedConfig = '{' + cleanedConfig;
      }

      // Stage 6: Check if missing closing brace
      if (!cleanedConfig.endsWith('}')) {
        console.log('[FirebaseAdmin] Detected missing }, adding it');
        cleanedConfig = cleanedConfig + '}';
      }

      console.log('[FirebaseAdmin] Final cleaned config, first 100 chars:', cleanedConfig.substring(0, 100));
      serviceAccountJson = JSON.parse(cleanedConfig);
      console.log('[FirebaseAdmin] ✅ Successfully parsed after cleanup');
    } catch (e2) {
      console.error('[FirebaseAdmin] ❌ Failed to parse service account JSON:', e2);
      console.error('[FirebaseAdmin] Raw string start:', adminConfig.substring(0, 100) + '...');
      console.error('[FirebaseAdmin] Raw string end:', '...' + adminConfig.substring(Math.max(0, adminConfig.length - 100)));
      throw new Error(`Could not parse FIREBASE_ADMIN_SERVICE_ACCOUNT. Expected a valid JSON string. Check your .env.local formatting. Error: ${e2}`);
    }
  }

  return initializeApp({
    credential: cert(serviceAccountJson)
  }, 'admin');
}

export { getFirebaseAdmin };
