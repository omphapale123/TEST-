'use server';
import { getFirebaseAdmin } from '@/firebase/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { uid, role } = await req.json();

    if (!uid || !role) {
      return NextResponse.json({ error: 'UID and role are required' }, { status: 400 });
    }

    const adminApp = getFirebaseAdmin();
    const auth = getAuth(adminApp);

    await auth.setCustomUserClaims(uid, { role });

    return NextResponse.json({ message: `Success! User ${uid} has been given the role of ${role}.` });
  } catch (error: any) {
    console.error('Error setting custom claim:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
