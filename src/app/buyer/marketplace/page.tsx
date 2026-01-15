
'use client';

import { useState, useMemo } from 'react';
import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, CheckCircle, Shield, Send, Building, Tags, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, query, where, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Supplier = {
    id: string;
    companyName: string;
    companyDescription?: string;
    specializedCategories?: string[];
    verificationStatus: 'verified' | 'pending' | 'unverified';
};

type Category = {
    id: string;
    name: string;
    label: string;
};

type Requirement = {
    id: string;
    title: string;
    status: 'submitted' | 'draft';
}

function BuyerMarketplacePage() {
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const router = useRouter();
    const { user: buyerUser } = useUser();
    const firestore = useFirestore();
    const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);
    const [selectedRequirementId, setSelectedRequirementId] = useState<string>('');

    const suppliersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'supplier'), where('verificationStatus', '==', 'verified'));
    }, [firestore]);
    const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersQuery);

    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'categories');
    }, [firestore]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

    const requirementsQuery = useMemoFirebase(() => {
        if (!firestore || !buyerUser) return null;
        return query(collection(firestore, 'requirements'), where('buyerId', '==', buyerUser.uid), where('status', '==', 'submitted'));
    }, [firestore, buyerUser]);
    const { data: requirements, isLoading: isLoadingRequirements } = useCollection<Requirement>(requirementsQuery);

    const categoryMap = useMemo(() => {
        if (!categories) return new Map<string, string>();
        return new Map(categories.map(c => [c.id, c.label]));
    }, [categories]);

    const filteredSuppliers = useMemo(() => {
        if (!suppliers) return [];
        const lowercasedFilter = searchTerm.toLowerCase();

        if (!lowercasedFilter) return suppliers;

        return suppliers.filter(s =>
            (s.companyName && s.companyName.toLowerCase().includes(lowercasedFilter)) ||
            (s.companyDescription && s.companyDescription.toLowerCase().includes(lowercasedFilter)) ||
            (s.specializedCategories && s.specializedCategories.some(catId => categoryMap.get(catId)?.toLowerCase().includes(lowercasedFilter)))
        );
    }, [searchTerm, suppliers, categoryMap]);

    const maskName = (name: string) => {
        if (!name) return "";
        const parts = name.split(' ');
        return parts.map(part => {
            if (part.length <= 1) return part;
            return part[0] + '*'.repeat(part.length - 1);
        }).join(' ');
    };

    const getTrustScore = (supplierId: string) => {
        let hash = 0;
        for (let i = 0; i < supplierId.length; i++) {
            const char = supplierId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return (Math.abs(hash) % 15) + 85; // Verified suppliers have a high base score
    };

    const handleSendRequest = async (supplier: Supplier) => {
        if (!buyerUser || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not identify your user information.' });
            return;
        }
        setSendingRequestId(supplier.id);

        try {
            const buyerDocRef = doc(firestore, 'users', buyerUser.uid);
            const buyerDoc = await getDoc(buyerDocRef);
            const buyerName = buyerDoc.exists() ? buyerDoc.data().companyName : buyerUser.email;

            if (!buyerName) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not identify your company name or email. Please update your profile.' });
                setSendingRequestId(null);
                return;
            }

            const supplierRequestsRef = doc(firestore, 'users', supplier.id, 'requests', `${buyerUser.uid}_${Date.now()}`);

            const requirement = requirements?.find(r => r.id === selectedRequirementId);

            await setDocumentNonBlocking(supplierRequestsRef, {
                requirementId: selectedRequirementId || 'general_inquiry',
                requirementTitle: requirement?.title || 'General Inquiry from Marketplace',
                buyerId: buyerUser.uid,
                buyerName: buyerName,
                supplierId: supplier.id,
                supplierName: supplier.companyName,
                status: 'pending',
                createdAt: serverTimestamp(),
                isMockSupplier: supplier.id.startsWith('mock_'),
            }, {});

            toast({
                title: 'Request Sent!',
                description: `Your request has been sent to the supplier. They will be able to see your company name and can start a chat.`,
            });

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Failed to Send Request',
                description: error.message || 'An unknown error occurred. Please try again.',
            });
        } finally {
            setSendingRequestId(null);
        }
    };

    const handleFindSuppliersForRequirement = () => {
        if (!selectedRequirementId) {
            toast({
                variant: 'destructive',
                title: 'No Requirement Selected',
                description: 'Please select a requirement from the list.',
            });
            return;
        }
        router.push(`/buyer/requirements/${selectedRequirementId}/find-suppliers`);
    };

    const isLoading = isLoadingSuppliers || isLoadingCategories || isLoadingRequirements;


    return (
        <DashboardLayout>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-lg font-semibold md:text-2xl">Supplier Marketplace</h1>
                <div className="flex items-center gap-2">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Sparkles className="mr-2 h-4 w-4" />
                                Find Suppliers for Requirement
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Find Suppliers</DialogTitle>
                                <DialogDescription>
                                    Select one of your submitted requirements to find matching suppliers.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Select onValueChange={setSelectedRequirementId} value={selectedRequirementId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a requirement..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isLoadingRequirements ? (
                                            <div className="flex items-center justify-center p-4">
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            </div>
                                        ) : requirements && requirements.length > 0 ? (
                                            requirements.map(req => (
                                                <SelectItem key={req.id} value={req.id}>{req.title}</SelectItem>
                                            ))
                                        ) : (
                                            <div className="text-center text-sm text-muted-foreground p-4">
                                                You have no submitted requirements.
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleFindSuppliersForRequirement} disabled={!selectedRequirementId}>
                                    Find Suppliers
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <div className="relative sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search by company, skill..."
                            className="pl-8 sm:w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Verified Indian Suppliers</CardTitle>
                    <CardDescription>Browse our network of trusted and verified suppliers from India.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {isLoading ? (
                        <div className="col-span-full flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredSuppliers.length > 0 ? (
                        filteredSuppliers.map(supplier => {
                            const trustScore = getTrustScore(supplier.id);
                            const isSending = sendingRequestId === supplier.id;
                            return (
                                <Card key={supplier.id} className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="flex items-start justify-between">
                                            <span className="flex items-center gap-2">
                                                <Building className="h-5 w-5 text-primary" />
                                                {supplier.companyName ? maskName(supplier.companyName) : `Supplier #${supplier.id.substring(0, 4).toUpperCase()}`}
                                            </span>
                                            <Badge className="bg-accent hover:bg-accent/90 text-accent-foreground border-yellow-500/50">
                                                <CheckCircle className="mr-1 h-3 w-3" />
                                                Verified
                                            </Badge>
                                        </CardTitle>
                                        <CardDescription>Indian Supplier</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow space-y-4">
                                        <p className="text-sm text-muted-foreground line-clamp-2">{supplier.companyDescription || "No description provided."}</p>

                                        {supplier.specializedCategories && supplier.specializedCategories.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-medium flex items-center gap-2"><Tags className="h-4 w-4" />Specialized In</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {supplier.specializedCategories.map(catId => (
                                                        <Badge key={catId} variant="secondary">{categoryMap.get(catId) || catId}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <h3 className="text-sm font-medium flex items-center">
                                                    <Shield className="mr-2 h-4 w-4 text-primary" />
                                                    Trust Score
                                                </h3>
                                                <span className="text-sm font-semibold text-primary">{trustScore}%</span>
                                            </div>
                                            <Progress value={trustScore} className="h-2" />
                                        </div>

                                    </CardContent>
                                    <CardFooter>
                                        <Button className="w-full" onClick={() => handleSendRequest(supplier)} disabled={isSending}>
                                            {isSending ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Send className="mr-2 h-4 w-4" />
                                            )}
                                            Send Request
                                        </Button>
                                    </CardFooter>
                                </Card>
                            )
                        })
                    ) : (
                        <div className="text-center text-muted-foreground py-8 col-span-full">
                            <p>No suppliers match your search criteria or none are verified yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}

export default withAuth(BuyerMarketplacePage, 'buyer');

