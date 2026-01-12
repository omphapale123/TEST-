'use client';

import { useState } from 'react';
import { Briefcase, ArrowRight, Check, X, Loader2, MessageSquare } from 'lucide-react';
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
import { useUser, useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, serverTimestamp, doc, writeBatch, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

function BuyerRequestsPage() {
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

                // Fetch buyer's company name for the chat
                const buyerDocRef = doc(firestore, 'users', user.uid);
                const buyerDoc = await getDoc(buyerDocRef);
                const buyerName = buyerDoc.exists() ? (buyerDoc.data().companyName || buyerDoc.data().displayName) : (user.displayName || 'Buyer');

                // 1. Create a new chat
                const newChatRef = doc(collection(firestore, 'chats'));
                const initialMessage = `Hello! I've accepted your interest in: ${request.requirementTitle}`;

                batch.set(newChatRef, {
                    requirementId: request.requirementId,
                    requirementTitle: request.requirementTitle,
                    buyerId: user.uid,
                    supplierId: request.supplierId,
                    participants: [user.uid, request.supplierId],
                    createdAt: serverTimestamp(),
                    lastUpdatedAt: serverTimestamp(),
                    lastMessage: initialMessage,
                    buyerName: buyerName,
                    supplierName: request.supplierName || 'Supplier'
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
                    description: `A new chat has been started with the supplier.`,
                });
                // Redirect to the new chat
                router.push(`/buyer/chats/${newChatRef.id}`);

            } else { // Rejected
                await deleteDocumentNonBlocking(requestDocRef);
                toast({
                    title: `Request Rejected`,
                    description: `the supplier's expression of interest has been removed.`,
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
                <h1 className="text-lg font-semibold md:text-2xl">Supplier Interests</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Incoming Supplier Interests</CardTitle>
                    <CardDescription>
                        Suppliers have expressed interest in fulfilling your requirements.
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
                                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                                        <div>
                                            <CardTitle className="text-base">
                                                {req.requirementTitle}
                                            </CardTitle>
                                            <CardDescription>
                                                Interest from <span className="font-medium text-foreground">{req.supplierName || 'a supplier'}</span>
                                            </CardDescription>
                                        </div>
                                        <div className="bg-muted px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            {req.status}
                                        </div>
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
                            <h3 className="mt-4 text-lg font-semibold">No Pending Interests</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                When suppliers express interest in your requirements, they will appear here.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}

export default withAuth(BuyerRequestsPage, 'buyer');
