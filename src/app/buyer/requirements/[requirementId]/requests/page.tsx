'use client';
import { useState, useMemo } from 'react';
import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Check,
  X,
  Briefcase,
  ArrowLeft
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, doc, writeBatch, serverTimestamp, where } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import React from 'react';

function RequirementRequestsPage({ params }: { params: Promise<{ requirementId: string }> }) {
  const { requirementId } = React.use(params);
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const requirementRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'requirements', requirementId);
  }, [firestore, requirementId]);
  const { data: requirement, isLoading: isLoadingRequirement } = useDoc(requirementRef);

  const requestsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'requests'), where('requirementId', '==', requirementId));
  }, [user, firestore, requirementId]);

  const { data: requests, isLoading: isLoadingRequests, refetch } = useCollection(requestsQuery);

  const handleResponse = async (request: any, response: 'accepted' | 'rejected') => {
    if (!user || !firestore || !requirement) return;

    setProcessingId(request.id);

    try {
      const requestDocRef = doc(firestore, 'users', user.uid, 'requests', request.id);
      const batch = writeBatch(firestore);

      if (response === 'accepted') {
        const newChatRef = doc(collection(firestore, 'chats'));
        batch.set(newChatRef, {
          requirementId: request.requirementId,
          buyerId: user.uid,
          supplierId: request.supplierId,
          participants: [user.uid, request.supplierId],
          createdAt: serverTimestamp(),
          lastMessage: `Request accepted for: ${request.requirementTitle}`,
          supplierName: request.supplierName,
          buyerName: user.displayName || 'Buyer',
        });
        batch.delete(requestDocRef);
        await batch.commit();

        toast({
          title: 'Request Accepted!',
          description: `A new chat has been started with ${request.supplierName}.`,
        });
        router.push(`/buyer/chats/${newChatRef.id}`);
      } else { // Rejected
        batch.delete(requestDocRef);
        await batch.commit();
        toast({
          title: 'Request Rejected',
          description: `The supplier's request has been rejected.`,
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

  const isLoading = isLoadingRequests || isLoadingRequirement;

  return (
    <DashboardLayout>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="text-lg font-semibold md:text-2xl">Supplier Interest</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Interest for: {isLoadingRequirement ? <Loader2 className="inline h-5 w-5 animate-spin" /> : requirement?.title}</CardTitle>
          <CardDescription>
            Suppliers have expressed interest in this requirement.
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
                      {req.supplierName}
                    </CardTitle>
                    <CardDescription>
                      Expressed interest in your requirement.
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
              <h3 className="mt-4 text-lg font-semibold">No Interest Yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                When suppliers express interest in this requirement, you will see them here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export default withAuth(RequirementRequestsPage, 'buyer');
