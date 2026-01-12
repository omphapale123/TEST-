import { getFirebaseAdmin } from '@/firebase/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { FALLBACK_CATEGORIES } from '@/constants/categories';

export interface Category {
    id: string;
    label: string;
}

/**
 * Shared utility to fetch active categories from Firestore with a fallback.
 */
export async function getActiveCategories(): Promise<Category[]> {
    try {
        const adminApp = getFirebaseAdmin();
        const adminDb = getFirestore(adminApp);
        const snapshot = await adminDb.collection('categories')
            .where('active', '==', true)
            .get();

        if (snapshot.empty) {
            console.log('No active categories found in Firestore, using fallbacks.');
            return FALLBACK_CATEGORIES;
        }

        return snapshot.docs.map(doc => ({
            id: doc.id,
            label: doc.data().label,
        }));
    } catch (e) {
        console.error('Error fetching categories from Firestore, using fallback:', e);
        return FALLBACK_CATEGORIES;
    }
}
