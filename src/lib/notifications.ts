import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';

export type NotificationType = 'request' | 'message' | 'trade' | 'system';

export interface NotificationData {
    type: NotificationType;
    title: string;
    message: string;
    relatedId?: string;
    relatedData?: any;
    read: boolean;
    createdAt: any;
}

/**
 * Creates a notification for a specific user in Firestore
 */
export async function createNotification(
    userId: string,
    data: {
        type: NotificationType;
        title: string;
        message: string;
        relatedId?: string;
        relatedData?: any;
    }
) {
    try {
        const notificationsRef = collection(db, 'users', userId, 'notifications');
        await addDoc(notificationsRef, {
            ...data,
            read: false,
            createdAt: serverTimestamp(),
        });
        console.log(`Notification created for user ${userId}: ${data.title}`);
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}
