
'use client';

import { withAuth } from '@/components/with-auth';
import { useState, useMemo, use } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileDown, Ship, PackageCheck, CircleCheck, Loader2, PartyPopper, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDoc, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { createNotification } from '@/lib/notifications';

type Trade = {
    id: string;
    status: 'Ongoing' | 'Pending' | 'Finished' | 'Delivered' | 'Dispatched';
    initiated: { toDate: () => Date };
    invoiceStatus?: 'pending' | 'submitted' | 'approved';
    shippingDocsStatus?: 'pending' | 'submitted';
    shippingInfo?: {
        trackingId: string;
        carrier: string;
    };
    supplierId: string;
    buyerName?: string;
    requirementTitle?: string;
};

const getTimelineSteps = (trade?: Trade | null) => {
    return [
        { status: 'Order Confirmed', date: trade?.initiated ? trade.initiated.toDate().toLocaleDateString('en-CA') : null, icon: CircleCheck, isCompleted: true },
        { status: 'Goods Dispatched', date: null, icon: Ship, isCompleted: ['Dispatched', 'Delivered', 'Finished'].includes(trade?.status || '') },
        { status: 'Delivered', date: null, icon: PackageCheck, isCompleted: ['Delivered', 'Finished'].includes(trade?.status || '') },
    ];
};

function TradePage({ params }: { params: Promise<{ tradeId: string }> }) {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { tradeId } = use(params);

    const tradeRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'trades', tradeId);
    }, [firestore, tradeId]);

    const { data: trade, isLoading: isLoadingTrade } = useDoc<Trade>(tradeRef);

    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isCongratsDialogOpen, setIsCongratsDialogOpen] = useState(false);

    const timelineSteps = useMemo(() => getTimelineSteps(trade), [trade]);

    const handleDownloadDocument = (docType: string) => {
        toast({
            title: `Downloading ${docType}...`,
            description: 'This is a prototype action. No file will be downloaded.',
        });
    };

    const handleVerifyDocument = async (docType: 'invoice') => {
        if (!tradeRef) return;
        setIsUpdatingStatus(true);
        try {
            await updateDocumentNonBlocking(tradeRef, { [`${docType}Status`]: 'approved' });

            // Notify the supplier
            if (trade?.supplierId) {
                await createNotification(trade.supplierId, {
                    type: 'trade',
                    title: 'Invoice Approved',
                    message: `${trade.buyerName || 'The buyer'} has approved your invoice for ${trade.requirementTitle || 'the trade'}.`,
                    relatedId: tradeId,
                });
            }

            toast({
                title: 'Document Approved!',
                description: `You have approved the ${docType}.`,
            });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not approve the document.' });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleMarkAsDelivered = async () => {
        if (!tradeRef) return;
        setIsUpdatingStatus(true);
        try {
            await updateDocumentNonBlocking(tradeRef, { status: 'Finished' });

            // Notify the supplier
            if (trade?.supplierId) {
                await createNotification(trade.supplierId, {
                    type: 'trade',
                    title: 'Order Delivered',
                    message: `${trade.buyerName || 'The buyer'} has marked the order for ${trade.requirementTitle || 'the product'} as delivered.`,
                    relatedId: tradeId,
                });
            }

            toast({
                title: 'Order Delivered!',
                description: 'You have confirmed the delivery of your goods.',
            });
            setIsCongratsDialogOpen(true);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update trade status.' });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    if (isLoadingTrade) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </DashboardLayout>
        );
    }

    if (!trade) {
        return (
            <DashboardLayout>
                <Card>
                    <CardHeader><CardTitle className="text-destructive">Trade Not Found</CardTitle></CardHeader>
                </Card>
            </DashboardLayout>
        );
    }

    const isDelivered = trade.status === 'Delivered' || trade.status === 'Finished';

    return (
        <DashboardLayout>
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                </Button>
                <h1 className="text-lg font-semibold md:text-2xl">Trade Details</h1>
                <div className="ml-auto">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/buyer/chats/${tradeId.replace('trade_', '')}`)}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Go to Chat
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Shipment Timeline</CardTitle>
                            <CardDescription>Tracking the progress of your order.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative pl-6">
                                <div className="absolute left-[35px] top-0 h-full w-0.5 bg-border -translate-x-1/2"></div>
                                {timelineSteps.map((step, index) => (
                                    <div key={index} className="relative flex items-start gap-6 mb-8 last:mb-0">
                                        <div className={`z-10 flex h-8 w-8 items-center justify-center rounded-full ${step.isCompleted ? 'bg-primary' : 'bg-muted border'}`}>
                                            <step.icon className={`h-5 w-5 ${step.isCompleted ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                                        </div>
                                        <div className="pt-1">
                                            <p className={`font-semibold ${step.isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>{step.status}</p>
                                            <p className="text-sm text-muted-foreground">{step.date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        {!isDelivered && (
                            <CardFooter>
                                <Button onClick={handleMarkAsDelivered} disabled={isUpdatingStatus}>
                                    {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                                    Mark as Delivered
                                </Button>
                            </CardFooter>
                        )}
                    </Card>
                </div>
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Shipping Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tracking #</span>
                                <Link href="#" className="font-semibold text-primary hover:underline">
                                    {trade.shippingInfo?.trackingId || 'Not available'}
                                </Link>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Carrier</span>
                                <span className="font-medium">{trade.shippingInfo?.carrier || 'Not available'}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Documents</CardTitle>
                            <CardDescription>Download and verify trade documents from the supplier.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <Button className="flex-grow" variant="outline" onClick={() => handleDownloadDocument('Proforma Invoice')} disabled={trade.invoiceStatus !== 'submitted'}>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Proforma Invoice
                                </Button>
                                <Button variant="secondary" onClick={() => handleVerifyDocument('invoice')} disabled={trade.invoiceStatus !== 'submitted' || isUpdatingStatus}>
                                    {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="mr-2 h-4 w-4" />}
                                    Approve
                                </Button>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <Button className="flex-grow" variant="outline" onClick={() => handleDownloadDocument('Shipping Docs')} disabled={trade.shippingDocsStatus !== 'submitted'}>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Shipping Docs
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <AlertDialog open={isCongratsDialogOpen} onOpenChange={setIsCongratsDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                            <PartyPopper className="h-6 w-6 text-green-600" />
                        </div>
                        <AlertDialogTitle className="text-center">Congratulations!</AlertDialogTitle>
                        <AlertDialogDescription className="text-center">
                            You've successfully completed the trade. The supplier has now been added to your partners list.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex justify-center gap-4">
                        <Button variant="outline" onClick={() => setIsCongratsDialogOpen(false)}>
                            Close
                        </Button>
                        <AlertDialogAction asChild>
                            <Link href="/buyer/partners">View Partners</Link>
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
}

export default withAuth(TradePage, 'buyer');
