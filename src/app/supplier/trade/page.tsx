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
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Package } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

function TradeListPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const tradesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'trades'), where('supplierId', '==', user.uid));
    }, [firestore, user]);

    const { data: trades, isLoading: isLoadingTrades } = useCollection<any>(tradesQuery);

    // Fetch buyer names from users collection
    const buyerIds = useMemo(() => {
        if (!trades) return [];
        return [...new Set(trades.map(t => t.buyerId).filter(Boolean))];
    }, [trades]);

    const buyersQuery = useMemoFirebase(() => {
        if (!firestore || buyerIds.length === 0) return null;
        return query(collection(firestore, 'users'), where('id', 'in', buyerIds));
    }, [firestore, buyerIds]);

    const { data: buyers, isLoading: isLoadingBuyers } = useCollection<any>(buyersQuery);

    const buyerMap = useMemo(() => {
        const map = new Map<string, string>();
        buyers?.forEach(b => {
            // In our app, buyers usually use displayName or we can check companyName if they have one
            const name = b.displayName || b.companyName || b.name;
            if (name && name !== 'Buyer') {
                map.set(b.id, name);
            }
        });
        return map;
    }, [buyers]);

    const isLoading = isLoadingTrades || isLoadingBuyers;

    return (
        <DashboardLayout>
            <div className="flex items-center">
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
                                const buyerName = buyerMap.get(trade.buyerId) ||
                                    (trade.buyerName !== 'Buyer' ? trade.buyerName : null) ||
                                    `Buyer #${trade.buyerId?.substring(0, 8).toUpperCase() || 'Unknown'}`;

                                return (
                                    <Link key={trade.id} href={`/supplier/trade/${trade.id}`} className="block hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center justify-between p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-primary/10 p-3 rounded-full">
                                                    <Package className="h-6 w-6 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{buyerName}</p>
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
                                Once you finalize a deal with a buyer, it will appear here.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}

export default withAuth(TradeListPage, 'supplier');
