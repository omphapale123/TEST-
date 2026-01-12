
'use client';

import { useState, useRef, useMemo } from 'react';
import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileUp, CircleCheck, Ship, Clock, Lock, Loader2, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { createNotification } from '@/lib/notifications';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDoc, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';

interface SupplierTradeClientPageProps {
    tradeId: string;
}

type Trade = {
    id: string;
    status: 'Ongoing' | 'Pending' | 'Finished' | 'Dispatched' | 'Delivered';
    invoiceStatus?: 'pending' | 'submitted' | 'approved';
    shippingDocsStatus?: 'pending' | 'submitted';
    shippingInfo?: {
        trackingId: string;
        carrier: string;
    };
    buyerId: string;
    supplierName?: string;
    requirementTitle?: string;
};

function SupplierTradeClientPage({ tradeId }: SupplierTradeClientPageProps) {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();

    const tradeRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'trades', tradeId);
    }, [firestore, tradeId]);

    const { data: trade, isLoading: isLoadingTrade } = useDoc<Trade>(tradeRef);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [trackingId, setTrackingId] = useState('');

    const invoiceInputRef = useRef<HTMLInputElement>(null);
    const shippingInputRef = useRef<HTMLInputElement>(null);

    const invoiceVerified = trade?.invoiceStatus === 'approved';
    const invoiceSubmitted = trade?.invoiceStatus === 'submitted' || trade?.invoiceStatus === 'approved';

    const handleFileUpload = (step: 'invoice' | 'shipping') => {
        if (step === 'invoice') {
            invoiceInputRef.current?.click();
        }
        if (step === 'shipping' && invoiceVerified) {
            shippingInputRef.current?.click();
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, step: 'invoice' | 'shipping') => {
        const file = event.target.files?.[0];
        if (!file) return;

        toast({
            title: `${step === 'invoice' ? 'Invoice' : 'Shipping Docs'} Ready for Upload`,
            description: `${file.name} has been selected.`,
        });
        // In a real app, you would upload the file here and store the URL.
        // For this prototype, we'll just enable the submit button.
        if (step === 'invoice') {
            // A way to track if a file is selected without storing the file itself
            (invoiceInputRef.current as any)._hasFile = true;
        }
        if (step === 'shipping') {
            (shippingInputRef.current as any)._hasFile = true;
        }
    };

    const handleSubmitForVerification = async (step: 'invoice' | 'shipping') => {
        if (!tradeRef) return;
        setIsSubmitting(true);
        try {
            if (step === 'invoice') {
                await updateDocumentNonBlocking(tradeRef, { invoiceStatus: 'submitted' });

                // Notify the buyer
                if (trade?.buyerId) {
                    await createNotification(trade.buyerId, {
                        type: 'trade',
                        title: 'New Invoice Submitted',
                        message: `${trade.supplierName || 'Supplier'} has submitted an invoice for ${trade.requirementTitle || 'your trade'}. Please review and approve.`,
                        relatedId: tradeId,
                    });
                }

                toast({
                    title: 'Invoice Submitted!',
                    description: 'The buyer has been notified to approve the invoice.'
                });
            }
            if (step === 'shipping') {
                await updateDocumentNonBlocking(tradeRef, { shippingDocsStatus: 'submitted' });

                // Notify the buyer
                if (trade?.buyerId) {
                    await createNotification(trade.buyerId, {
                        type: 'trade',
                        title: 'Shipping Documents Received',
                        message: `${trade.supplierName || 'Supplier'} has uploaded shipping documents for ${trade.requirementTitle || 'your trade'}.`,
                        relatedId: tradeId,
                    });
                }

                toast({
                    title: 'Shipping Docs Submitted!',
                    description: 'The buyer has been notified of the shipping documents.'
                });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not submit documents.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveTracking = async () => {
        if (!tradeRef || !trackingId) return;
        setIsSubmitting(true);
        try {
            // In a real app, carrier might also be an input
            await updateDocumentNonBlocking(tradeRef, {
                shippingInfo: { trackingId: trackingId, carrier: 'DB Schenker' },
                status: 'Dispatched'
            });

            // Notify the buyer
            if (trade?.buyerId) {
                await createNotification(trade.buyerId, {
                    type: 'trade',
                    title: 'Shipment Dispatched',
                    message: `Your order for ${trade.requirementTitle || 'the product'} has been dispatched. Tracking ID: ${trackingId}`,
                    relatedId: tradeId,
                });
            }

            toast({
                title: 'Shipment Dispatched!',
                description: 'Tracking ID has been saved and the buyer notified.'
            });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save tracking ID.' });
        } finally {
            setIsSubmitting(false);
        }
    }

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

    return (
        <DashboardLayout>
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                </Button>
                <h1 className="text-lg font-semibold md:text-2xl">Manage Trade</h1>
                <div className="ml-auto">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/supplier/chats/${tradeId.replace('trade_', '')}`)}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Go to Chat
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Proforma Invoice</CardTitle>
                        <CardDescription>Upload the invoice for the buyer to verify and approve.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className={cn("flex items-center justify-between p-4 rounded-md border", invoiceVerified ? "bg-green-500/10 border-green-500/30" : "bg-muted/50")}>
                            <div className="flex items-center gap-3">
                                {invoiceVerified ? <CircleCheck className="h-6 w-6 text-green-600" /> : <Clock className="h-6 w-6 text-muted-foreground" />}
                                <div>
                                    <p className="font-semibold">
                                        {invoiceVerified ? 'Invoice Approved' : (invoiceSubmitted ? 'Awaiting Approval' : 'Pending Upload')}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {invoiceVerified ? 'You can now upload shipping docs.' : 'Buyer must approve to proceed.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-4">
                        <Input type="file" ref={invoiceInputRef} className="hidden" onChange={(e) => handleFileChange(e, 'invoice')} />
                        <Button onClick={() => handleFileUpload('invoice')} variant="outline" disabled={invoiceSubmitted}>
                            <FileUp className="mr-2 h-4 w-4" />
                            Select Invoice PDF
                        </Button>
                        <Button onClick={() => handleSubmitForVerification('invoice')} disabled={invoiceSubmitted || isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit for Verification
                        </Button>
                    </CardFooter>
                </Card>

                <TooltipProvider>
                    <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                            <div className={cn(!invoiceVerified && "opacity-50 pointer-events-none")}>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Shipping Documents</CardTitle>
                                        <CardDescription>Upload the Bill of Lading and other shipping documents.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between p-4 rounded-md border bg-muted/50">
                                            <div className="flex items-center gap-3">
                                                <Ship className="h-6 w-6 text-muted-foreground" />
                                                <div>
                                                    <p className="font-semibold">{trade.shippingDocsStatus === 'submitted' ? 'Documents Submitted' : 'Awaiting Documents'}</p>
                                                    <p className="text-sm text-muted-foreground">Upload after invoice approval.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex-col items-start gap-4">
                                        <Input type="file" ref={shippingInputRef} className="hidden" onChange={(e) => handleFileChange(e, 'shipping')} />
                                        <Button onClick={() => handleFileUpload('shipping')} variant="outline" disabled={!invoiceVerified || trade.shippingDocsStatus === 'submitted'}>
                                            <FileUp className="mr-2 h-4 w-4" />
                                            Select Shipping Docs
                                        </Button>
                                        <Button onClick={() => handleSubmitForVerification('shipping')} disabled={!invoiceVerified || trade.shippingDocsStatus === 'submitted' || isSubmitting}>
                                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Submit Documents
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </div>
                        </TooltipTrigger>
                        {!invoiceVerified && (
                            <TooltipContent side="top">
                                <p className="flex items-center gap-2"><Lock className="h-4 w-4" />This section is locked until the buyer approves the invoice.</p>
                            </TooltipContent>
                        )}
                    </Tooltip>
                </TooltipProvider>

                <Card className={cn("md:col-span-2", !invoiceVerified && "opacity-50 pointer-events-none")}>
                    <CardHeader>
                        <CardTitle>Shipment Tracking</CardTitle>
                        <CardDescription>Provide the tracking ID for the shipment once it's dispatched.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Input
                            placeholder="Enter tracking ID..."
                            value={trackingId || trade.shippingInfo?.trackingId || ''}
                            onChange={(e) => setTrackingId(e.target.value)}
                            disabled={!invoiceVerified || isSubmitting}
                        />
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSaveTracking} disabled={!invoiceVerified || !trackingId || isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save & Mark as Dispatched
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </DashboardLayout>
    );
}

export default withAuth(SupplierTradeClientPage, 'supplier');
