'use client';

import { useState, useMemo } from 'react';
import { Briefcase, ArrowRight, Check, X, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, serverTimestamp, doc, writeBatch } from 'firebase/firestore';
import { useRouter } from 'next/navigation';


function SupplierRequestsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const requestsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'requests'));
  }, [user, firestore]);

  const { data: requests, isLoading, refetch } = useCollection(requestsQuery);

  const handleResponse = async (request: any, response: 'accepted' | 'rejected') => {
    if (!user || !firestore) return;

    setProcessingId(request.id);

    try {
      const requestDocRef = doc(firestore, 'users', user.uid, 'requests', request.id);

      if (response === 'accepted') {
        const batch = writeBatch(firestore);

        // 1. Create a new chat
        const newChatRef = doc(collection(firestore, 'chats'));
        const initialMessage = `Hello! I've accepted your request regarding: ${request.requirementTitle}`;

        batch.set(newChatRef, {
          requirementId: request.requirementId,
          requirementTitle: request.requirementTitle,
          buyerId: request.buyerId,
          supplierId: user.uid,
          participants: [request.buyerId, user.uid],
          createdAt: serverTimestamp(),
          lastUpdatedAt: serverTimestamp(),
          lastMessage: initialMessage,
          supplierName: user.displayName || 'Supplier', // Use displayName if available
          buyerName: request.buyerName || 'Buyer'
        });

        // 2. Create the first message doc
        const messageRef = doc(collection(newChatRef, 'messages'));
        batch.set(messageRef, {
          senderId: user.uid,
          text: initialMessage,
          createdAt: serverTimestamp()
        });

        // 3. Delete the request
        batch.delete(requestDocRef);

        await batch.commit();

        toast({
          title: `Request Accepted!`,
          description: `A new chat has been started with the buyer.`,
        });
        // Redirect to the new chat
        router.push(`/supplier/chats/${newChatRef.id}`);

      } else { // Rejected
        await deleteDocumentNonBlocking(requestDocRef);
        toast({
          title: `Request Rejected`,
          description: `The buyer's request has been rejected.`,
        });
      }
      refetch();

    } catch (error) {
      console.error("Error handling request:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not process the request. Please try again."
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Buyer Requests</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Incoming Buyer Requests</CardTitle>
          <CardDescription>
            Buyers have expressed direct interest in your profile for their requirements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : requests && requests.length > 0 ? (
            <div className="grid gap-6">
              {requests.map((req) => (
                <Card key={req.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {req.requirementTitle}
                    </CardTitle>
                    <CardDescription>
                      From {req.buyerName || 'a buyer'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Received {req.createdAt?.toDate ? formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true }) : 'Recently'}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleResponse(req, 'rejected')} disabled={!!processingId}>
                      {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => handleResponse(req, 'accepted')} disabled={!!processingId}>
                      {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Accept & Chat
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No New Requests</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Buyers will send you requests when they are interested in your profile.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export default withAuth(SupplierRequestsPage, 'supplier');
