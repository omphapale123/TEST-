
'use client';

import { useState, useMemo } from 'react';
import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Search, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';

type Trade = {
    id: string;
    buyerName: string;
    supplierName: string;
    value: number;
    status: 'Ongoing' | 'Pending' | 'Finished' | 'Awaiting Admin Confirmation' | 'Rejected';
    initiated: { toDate: () => Date };
};

function AdminTradesPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const tradesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'trades');
    }, [firestore]);
    const { data: trades, isLoading } = useCollection<Trade>(tradesQuery);

    const filteredTrades = useMemo(() => {
        if (!trades) return { ongoing: [], pending: [], awaitingConfirmation: [], finished: [], rejected: [] };

        const allTrades = trades.filter(trade => {
            if (!searchTerm) return true;
            const lowercasedFilter = searchTerm.toLowerCase();
            return trade.buyerName.toLowerCase().includes(lowercasedFilter) ||
                trade.supplierName.toLowerCase().includes(lowercasedFilter);
        });

        return {
            ongoing: allTrades.filter(t => t.status === 'Ongoing'),
            pending: allTrades.filter(t => t.status === 'Pending'),
            awaitingConfirmation: allTrades.filter(t => t.status === 'Awaiting Admin Confirmation'),
            finished: allTrades.filter(t => t.status === 'Finished'),
            rejected: allTrades.filter(t => t.status === 'Rejected'),
        };
    }, [searchTerm, trades]);

    const handleViewDetails = (tradeId: string) => {
        toast({
            title: 'Prototype Action',
            description: `This would show documents for trade ${tradeId}.`
        });
    };

    const handleAction = async (tradeId: string, newStatus: 'Ongoing' | 'Rejected') => {
        if (!firestore) return;
        setProcessingId(tradeId);
        try {
            const tradeRef = doc(firestore, 'trades', tradeId);
            await updateDoc(tradeRef, { status: newStatus });
            toast({
                title: `Trade ${newStatus === 'Ongoing' ? 'Approved' : 'Rejected'}`,
                description: `The trade has been successfully ${newStatus.toLowerCase()}.`,
            });
        } catch (error) {
            console.error("Error updating trade status:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update trade status. Please try again.',
            });
        } finally {
            setProcessingId(null);
        }
    };

    const renderTable = (trades: Trade[], isAwaiting = false) => {
        if (trades.length === 0) {
            return <p className="text-center text-muted-foreground p-4">No trades in this category.</p>;
        }
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Trade ID</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Value (€)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Initiated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {trades.map(trade => (
                        <TableRow key={trade.id}>
                            <TableCell className="font-mono">{trade.id.substring(0, 8)}...</TableCell>
                            <TableCell>{trade.buyerName}</TableCell>
                            <TableCell>{trade.supplierName}</TableCell>
                            <TableCell>{trade.value.toLocaleString()}</TableCell>
                            <TableCell><Badge variant="secondary">{trade.status}</Badge></TableCell>
                            <TableCell>{trade.initiated ? format(trade.initiated.toDate(), 'PPP') : 'N/A'}</TableCell>
                            <TableCell className="text-right flex gap-2 justify-end">
                                {isAwaiting && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleAction(trade.id, 'Rejected')}
                                            disabled={processingId === trade.id}
                                        >
                                            {processingId === trade.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700"
                                            onClick={() => handleAction(trade.id, 'Ongoing')}
                                            disabled={processingId === trade.id}
                                        >
                                            {processingId === trade.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                                        </Button>
                                    </>
                                )}
                                <Button variant="outline" size="icon" onClick={() => handleViewDetails(trade.id)}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    }

    return (
        <DashboardLayout>
            <div className="flex items-center">
                <h1 className="text-lg font-semibold md:text-2xl">Platform Trades</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Trade Overview</CardTitle>
                    <CardDescription>A summary of all trades across the platform.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end mb-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by buyer or supplier..."
                                className="pl-8 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Tabs defaultValue="ongoing">
                            <TabsList>
                                <TabsTrigger value="ongoing">Ongoing ({filteredTrades.ongoing.length})</TabsTrigger>
                                <TabsTrigger value="awaiting_confirmation">Awaiting Confirmation ({filteredTrades.awaitingConfirmation.length})</TabsTrigger>
                                <TabsTrigger value="pending">Pending ({filteredTrades.pending.length})</TabsTrigger>
                                <TabsTrigger value="finished">Finished ({filteredTrades.finished.length})</TabsTrigger>
                                <TabsTrigger value="rejected">Rejected ({filteredTrades.rejected.length})</TabsTrigger>
                            </TabsList>
                            <TabsContent value="ongoing" className="mt-4">
                                {renderTable(filteredTrades.ongoing)}
                            </TabsContent>
                            <TabsContent value="awaiting_confirmation" className="mt-4">
                                {renderTable(filteredTrades.awaitingConfirmation, true)}
                            </TabsContent>
                            <TabsContent value="pending" className="mt-4">
                                {renderTable(filteredTrades.pending)}
                            </TabsContent>
                            <TabsContent value="finished" className="mt-4">
                                {renderTable(filteredTrades.finished)}
                            </TabsContent>
                            <TabsContent value="rejected" className="mt-4">
                                {renderTable(filteredTrades.rejected)}
                            </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}

export default withAuth(AdminTradesPage, 'admin');
