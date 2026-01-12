'use client';
import { useMemo } from 'react';
import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { ArrowRight, Loader2, Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

function TradeListPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    const tradesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'trades'), where('buyerId', '==', user.uid));
    }, [firestore, user]);

    const { data: trades, isLoading: isLoadingTrades } = useCollection<any>(tradesQuery);

    // Fetch supplier names from users collection
    const supplierIds = useMemo(() => {
        if (!trades) return [];
        return [...new Set(trades.map(t => t.supplierId).filter(Boolean))];
    }, [trades]);

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

    const isLoading = isLoadingTrades || isLoadingSuppliers;


    return (
        <DashboardLayout>
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                </Button>
                <h1 className="text-lg font-semibold md:text-2xl">Ongoing Trades</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>My Trades</CardTitle>
                    <CardDescription>
                        A list of all your finalized trades and their current status.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : trades && trades.length > 0 ? (
                        <div className="divide-y divide-border">
                            {trades.map((trade) => {
                                const supplierName = supplierMap.get(trade.supplierId) ||
                                    (trade.supplierName !== 'Supplier' ? trade.supplierName : null) ||
                                    `Supplier #${trade.supplierId?.substring(0, 8).toUpperCase() || 'Unknown'}`;

                                return (
                                    <Link key={trade.id} href={`/buyer/trade/${trade.id}`} className="block hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center justify-between p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-primary/10 p-3 rounded-full">
                                                    <Package className="h-6 w-6 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{supplierName}</p>
                                                    <p className="text-sm text-muted-foreground">Status: <span className="font-medium text-foreground">{trade.status}</span></p>
                                                </div>
                                            </div>
                                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">No Active Trades</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Once you finalize a deal with a supplier, it will appear here.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}

export default withAuth(TradeListPage, 'buyer');
