
'use client';
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
import { Users, Loader2, Building, Mail, CheckCircle } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type Trade = {
    id: string;
    buyerId: string;
    buyerName: string;
};

type UserDoc = {
    id: string;
    email: string;
    companyName: string;
}

function PartnersPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const tradesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        // Get all finished trades for the current supplier
        return query(collection(firestore, 'trades'), where('supplierId', '==', user.uid), where('status', '==', 'Finished'));
    }, [firestore, user]);

    const { data: trades, isLoading: isLoadingTrades } = useCollection<Trade>(tradesQuery);
    
    // Get a unique list of buyer IDs from the finished trades
    const partnerIds = useMemo(() => {
        if (!trades) return [];
        const ids = trades.map(trade => trade.buyerId);
        return [...new Set(ids)];
    }, [trades]);

    const partnersQuery = useMemoFirebase(() => {
        if (!firestore || partnerIds.length === 0) return null;
        // Fetch the user documents for all unique partners
        return query(collection(firestore, 'users'), where('id', 'in', partnerIds));
    }, [firestore, partnerIds]);
    
    const { data: partners, isLoading: isLoadingPartners } = useCollection<UserDoc>(partnersQuery);
    
    const isLoading = isLoadingTrades || isLoadingPartners;

    return (
        <DashboardLayout>
            <div className="flex items-center">
                <h1 className="text-lg font-semibold md:text-2xl">My Partners</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Verified Partners</CardTitle>
                    <CardDescription>
                        A list of all buyers you have successfully completed a trade with.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : partners && partners.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                           {partners.map(partner => (
                               <Card key={partner.id}>
                                   <CardHeader>
                                       <CardTitle className="flex items-center gap-2">
                                           <Building className="h-5 w-5 text-primary" />
                                           {partner.companyName}
                                       </CardTitle>
                                       <CardDescription className="flex items-center gap-2 pt-1">
                                           <Mail className="h-4 w-4" />
                                            {partner.email}
                                       </CardDescription>
                                   </CardHeader>
                                   <CardContent>
                                        <div className="flex items-center text-sm text-green-500">
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                            You've completed trades with this partner.
                                        </div>
                                   </CardContent>
                                   <CardFooter>
                                        <Button variant="outline" asChild className="w-full">
                                            {/* This would ideally open a chat, but for now links to marketplace */}
                                            <Link href={`/supplier/marketplace`}>
                                                View New Opportunities
                                            </Link>
                                        </Button>
                                   </CardFooter>
                               </Card>
                           ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">No Partners Yet</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Complete a trade with a buyer to add them to your partner list.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}

export default withAuth(PartnersPage, 'supplier');
