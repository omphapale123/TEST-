'use client';

import { useState, useEffect } from 'react';
import { Bell, Check, MessageSquare, Briefcase, Repeat, Trash2, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    writeBatch
} from 'firebase/firestore';

import { useUser, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
    id: string;
    type: 'request' | 'message' | 'trade' | 'system';
    title: string;
    message: string;
    read: boolean;
    createdAt: any;
    relatedId?: string;
    relatedData?: any;
}

export function NotificationBell() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!user || !firestore) return;

        const notificationsRef = collection(firestore, 'users', user.uid, 'notifications');
        const q = query(
            notificationsRef,
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedNotifications: Notification[] = [];
            let unread = 0;

            snapshot.forEach((doc) => {
                const data = doc.data() as Notification;
                const notification = { ...data, id: doc.id };
                fetchedNotifications.push(notification);
                if (!data.read) unread++;
            });

            setNotifications(fetchedNotifications);
            setUnreadCount(unread);
        });

        return () => unsubscribe();
    }, [user, firestore]);

    const markAsRead = async (notificationId: string) => {
        if (!user || !firestore) return;
        const notificationRef = doc(firestore, 'users', user.uid, 'notifications', notificationId);
        await updateDoc(notificationRef, { read: true });
    };

    const markAllAsRead = async () => {
        if (!user || !firestore || unreadCount === 0) return;

        const batch = writeBatch(firestore);
        notifications.forEach((notif) => {
            if (!notif.read) {
                const ref = doc(firestore, 'users', user.uid, 'notifications', notif.id);
                batch.update(ref, { read: true });
            }
        });
        await batch.commit();
    };

    const deleteNotification = async (e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation();
        if (!user || !firestore) return;
        const notificationRef = doc(firestore, 'users', user.uid, 'notifications', notificationId);
        await deleteDoc(notificationRef);
    };

    const handleNotificationClick = async (notif: Notification) => {
        if (!notif.read) {
            await markAsRead(notif.id);
        }
        setIsOpen(false);

        // Navigation logic based on type
        if (notif.type === 'message' && notif.relatedId) {
            router.push(`/buyer/chats/${notif.relatedId}`);
        } else if (notif.type === 'request' && notif.relatedId) {
            router.push(`/buyer/requirements/${notif.relatedId}/requests`);
        } else if (notif.type === 'trade' && notif.relatedId) {
            router.push(`/buyer/trade/${notif.relatedId}`);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'message': return <MessageSquare className="h-4 w-4 text-blue-500" />;
            case 'request': return <Briefcase className="h-4 w-4 text-orange-500" />;
            case 'trade': return <Repeat className="h-4 w-4 text-green-500" />;
            default: return <Info className="h-4 w-4 text-slate-500" />;
        }
    };

    if (!user) return null;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative group">
                    <Bell className="h-5 w-5 transition-transform group-hover:rotate-12" />
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 hover:bg-red-600 border-2 border-background animate-in zoom-in duration-300"
                            variant="destructive"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 text-primary hover:text-primary/80"
                            onClick={markAllAsRead}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[400px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-4 text-center">
                            <Bell className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={cn(
                                        "flex gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors relative group",
                                        !notif.read && "bg-primary/5"
                                    )}
                                    onClick={() => handleNotificationClick(notif)}
                                >
                                    <div className="mt-1 shrink-0 p-2 rounded-full bg-background border shadow-sm">
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-6">
                                        <p className={cn("text-sm font-medium leading-none mb-1 truncate", !notif.read && "text-primary")}>
                                            {notif.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                            {notif.message}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                                            {notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                                        </p>
                                    </div>
                                    {!notif.read && (
                                        <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-primary" />
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-2 bottom-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => deleteNotification(e, notif.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
