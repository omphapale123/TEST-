'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { Loader2, MessageSquare, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { collection, query, where, orderBy } from 'firebase/firestore';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';

function SupplierChatsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const chatsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'chats'), where('participants', 'array-contains', user.uid), orderBy('lastUpdatedAt', 'desc'));
  }, [firestore, user]);

  const { data: chats, isLoading: isLoadingChats } = useCollection<any>(chatsQuery);

  // Fetch buyer names from users collection
  const buyerIds = useMemo(() => {
    if (!chats) return [];
    return [...new Set(chats.map(c => c.buyerId).filter(Boolean))];
  }, [chats]);

  const buyersQuery = useMemoFirebase(() => {
    if (!firestore || buyerIds.length === 0) return null;
    return query(collection(firestore, 'users'), where('id', 'in', buyerIds));
  }, [firestore, buyerIds]);

  const { data: buyers, isLoading: isLoadingBuyers } = useCollection<any>(buyersQuery);

  const buyerMap = useMemo(() => {
    const map = new Map<string, string>();
    buyers?.forEach(b => {
      const name = b.displayName || b.companyName || b.name;
      if (name && name !== 'Buyer') {
        map.set(b.id, name);
      }
    });
    return map;
  }, [buyers]);

  const isLoading = isLoadingChats || isLoadingBuyers;


  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">My Chats</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
          <CardDescription>
            A list of all your active conversations with buyers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : chats && chats.length > 0 ? (
            <div className="grid gap-4">
              {chats.map((chat) => {
                const buyerName = buyerMap.get(chat.buyerId) ||
                  (chat.buyerName !== 'Buyer' ? chat.buyerName : null) ||
                  `Buyer #${chat.buyerId?.substring(0, 8).toUpperCase() || 'Unknown'}`;

                return (
                  <Card key={chat.id}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        Chat with {buyerName}
                      </CardTitle>
                      <CardDescription>
                        Regarding: {chat.requirementTitle || 'General Inquiry'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground truncate italic">
                        "{chat.lastMessage || 'No messages yet.'}"
                      </p>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        {chat.lastUpdatedAt?.toDate ?
                          `${formatDistanceToNow(chat.lastUpdatedAt.toDate())} ago`
                          : 'N/A'}
                      </p>
                      <Button asChild size="sm">
                        <Link href={`/supplier/chats/${chat.id}`}>
                          Open Chat <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Active Chats</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You have no active conversations with buyers yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export default withAuth(SupplierChatsPage, 'supplier');
