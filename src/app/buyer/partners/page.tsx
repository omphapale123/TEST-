
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
import { Users, Loader2, Building, Mail, CheckCircle, ArrowLeft } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Trade = {
    id: string;
    supplierId: string;
    supplierName: string;
};

type UserDoc = {
    id: string;
    email: string;
    companyName: string;
}

function PartnersPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    const tradesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        // Get all finished trades for the current buyer
        return query(collection(firestore, 'trades'), where('buyerId', '==', user.uid), where('status', '==', 'Finished'));
    }, [firestore, user]);

    const { data: trades, isLoading: isLoadingTrades } = useCollection<Trade>(tradesQuery);
    
    // Get a unique list of supplier IDs from the finished trades
    const partnerIds = useMemo(() => {
        if (!trades) return [];
        const ids = trades.map(trade => trade.supplierId);
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
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                </Button>
                <h1 className="text-lg font-semibold md:text-2xl">My Partners</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Verified Partners</CardTitle>
                    <CardDescription>
                        A list of all suppliers you have successfully completed a trade with.
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
                                            <Link href={`/buyer/marketplace`}>
                                                Send New Inquiry
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
                                Complete a trade with a supplier to add them to your partner list.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}

export default withAuth(PartnersPage, 'buyer');
