
'use client';
import { useState, useMemo } from 'react';
import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Loader2, User, Building, Mail, Phone, DollarSign } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';

type Trade = {
    id: string;
    requirementTitle: string;
    buyerId: string;
    buyerName: string;
    supplierId: string;
    supplierName: string;
    value: number;
    status: 'Ongoing' | 'Pending' | 'Finished';
    processedForCommission?: boolean;
};

// Fetching user details is a future enhancement. For now, we use names from the trade doc.

function CompletedTradesPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const tradesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // We only want to process trades that are 'Finished' but not yet processed.
        return query(collection(firestore, 'trades'), where('status', '==', 'Finished'), where('processedForCommission', '!=', true));
    }, [firestore]);

    const { data: trades, isLoading, refetch } = useCollection<Trade>(tradesQuery);

    const handleProcessTrade = async (tradeId: string) => {
        if (!firestore) return;
        setProcessingId(tradeId);
        
        const tradeRef = doc(firestore, 'trades', tradeId);
        await updateDocumentNonBlocking(tradeRef, { processedForCommission: true });
        
        toast({
            title: 'Trade Processed',
            description: `Trade ${tradeId} has been marked as processed and archived.`,
        });
        setProcessingId(null);
        refetch(); // Refetch to remove the processed trade from the list
    };

    return (
        <DashboardLayout>
            <div className="flex items-center">
                <h1 className="text-lg font-semibold md:text-2xl">Process Completed Trades</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Completed Trades Log</CardTitle>
                    <CardDescription>Review finalized trades and mark them as processed for commission tracking and archiving.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading ? (
                         <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : trades && trades.length > 0 ? (
                        trades.map(trade => (
                            <Card key={trade.id} className={trade.processedForCommission ? 'bg-muted/50 border-dashed' : ''}>
                                <CardHeader>
                                    <CardTitle className="text-xl">Requirement: {trade.requirementTitle || 'N/A'}</CardTitle>
                                    <CardDescription>Trade ID: {trade.id}</CardDescription>
                                </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-base">Buyer Details</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground" /> <span>{trade.buyerName}</span></div>
                                            {/* Contact details would require fetching the user doc, future enhancement */}
                                            {/* <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> <span>...</span></div> */}
                                            {/* <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> <span>...</span></div> */}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-base">Supplier Details</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground" /> <span>{trade.supplierName}</span></div>
                                            {/* Contact details would require fetching the user doc, future enhancement */}
                                        </div>
                                    </div>
                                </CardContent>
                                <Separator />
                                <CardFooter className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-6 gap-4">
                                     <div className="flex flex-wrap gap-x-6 gap-y-2">
                                        <div className="flex items-baseline gap-2">
                                            <p className="text-muted-foreground text-sm">Trade Value:</p>
                                            <p className="text-2xl font-bold flex items-center"><DollarSign className="h-6 w-6"/>{trade.value.toLocaleString()}</p>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <p className="text-muted-foreground text-sm">Commission (2%):</p>
                                            <p className="text-2xl font-bold flex items-center text-primary"><DollarSign className="h-6 w-6"/>{(trade.value * 0.02).toLocaleString()}</p>
                                        </div>
                                     </div>
                                    {trade.processedForCommission ? (
                                        <Button variant="outline" disabled>
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                            Processed
                                        </Button>
                                    ) : (
                                        <Button onClick={() => handleProcessTrade(trade.id)} disabled={processingId === trade.id}>
                                            {processingId === trade.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                            Mark as Processed
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No unprocessed completed trades found.</p>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}

export default withAuth(CompletedTradesPage, 'admin');
