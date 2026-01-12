'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { Loader2, MessageSquare, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { collection, query, where, orderBy } from 'firebase/firestore';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';


function BuyerChatsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const chatsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'chats'), where('participants', 'array-contains', user.uid), orderBy('lastUpdatedAt', 'desc'));
  }, [firestore, user]);

  const { data: chats, isLoading: isLoadingChats } = useCollection<any>(chatsQuery);

  // Fetch supplier names from users collection
  const supplierIds = useMemo(() => {
    if (!chats) return [];
    return [...new Set(chats.map(c => c.supplierId).filter(Boolean))];
  }, [chats]);

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore || supplierIds.length === 0) return null;
    return query(collection(firestore, 'users'), where('id', 'in', supplierIds));
  }, [firestore, supplierIds]);

  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<any>(suppliersQuery);

  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliers?.forEach(s => {
      if (s.companyName && s.companyName !== 'Supplier') {
        map.set(s.id, s.companyName);
      }
    });
    return map;
  }, [suppliers]);

  const isLoading = isLoadingChats || isLoadingSuppliers;


  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">My Chats</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
          <CardDescription>
            A list of all your active conversations with suppliers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : chats && chats.length > 0 ? (
            <div className="divide-y divide-border">
              {chats.map((chat) => {
                const supplierName = supplierMap.get(chat.supplierId) ||
                  (chat.supplierName !== 'Supplier' ? chat.supplierName : null) ||
                  `Supplier #${chat.supplierId?.substring(0, 8).toUpperCase() || 'Unknown'}`;

                return (
                  <Link key={chat.id} href={`/buyer/chats/${chat.id}`} className="block hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4 p-4">
                      <Avatar className="h-12 w-12 border">
                        <AvatarFallback>{supplierName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 grid gap-1">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold">{supplierName}</p>
                          <p className="text-xs text-muted-foreground">
                            {chat.lastUpdatedAt?.toDate ? formatDistanceToNow(chat.lastUpdatedAt.toDate(), { addSuffix: true }) : 'N/A'}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {chat.lastMessage || 'No messages yet.'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requirement: {chat.requirementTitle || 'General Inquiry'}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Conversations Yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                When a supplier responds to your requirement, the chat will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export default withAuth(BuyerChatsPage, 'buyer');
