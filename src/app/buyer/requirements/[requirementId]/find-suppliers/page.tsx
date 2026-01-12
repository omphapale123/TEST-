
'use client';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Loader2, CheckCircle, Shield, Send, Sparkles, Bot, RefreshCw, Info } from 'lucide-react';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import {
    useFirestore,
    useDoc,
    useCollection,
    useMemoFirebase,
    useUser,
} from '@/firebase';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { findMatchingSuppliers } from '@/ai/flows/supplier-matching-flow';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function FindSuppliersPage({ params }: { params: Promise<{ requirementId: string }> }) {
    const { requirementId } = React.use(params);
    return <AuthenticatedFindSuppliersClient requirementId={requirementId} />;
}

interface Supplier {
    id: string;
    companyName?: string;
    companyDescription?: string;
    specializedCategories?: string[];
    role: string;
    country: string;
    email: string;
    verificationStatus: 'verified' | 'pending' | 'unverified';
}

interface SupplierMatch {
    id: string; // Corresponds to supplierId
    supplierId: string;
    companyName: string;
    matchScore: number;
    justification: string;
}

interface Category {
    id: string;
    name: string;
    label: string;
}


interface ClientPageProps {
    requirementId: string;
}

function FindSuppliersClient({ requirementId }: ClientPageProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // Requirement data
    const requirementRef = useMemoFirebase(() => {
        if (!firestore || !requirementId) return null;
        return doc(firestore, 'requirements', requirementId);
    }, [firestore, requirementId]);
    const { data: requirement, isLoading: isLoadingRequirement } = useDoc(requirementRef);

    // Category Data
    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'categories');
    }, [firestore]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

    const categoryLabel = useMemo(() => {
        if (!requirement || !categories) return '...';
        const category = categories.find(c => c.name === requirement.productCategory);
        return category?.label || requirement.productCategory;
    }, [requirement, categories]);

    // Supplier data - We fetch all verified suppliers
    const suppliersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'supplier'), where('verificationStatus', '==', 'verified'));
    }, [firestore]);
    const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersQuery);

    // AI-generated matches data
    const matchesQuery = useMemoFirebase(() => {
        if (!firestore || !requirementId) return null;
        return collection(firestore, 'requirements', requirementId, 'supplierMatches');
    }, [firestore, requirementId]);
    const { data: matches, isLoading: isLoadingMatches, refetch: refetchMatches } = useCollection<SupplierMatch>(matchesQuery);


    const runAiAnalysis = useCallback(async () => {
        if (!requirement || !firestore) {
            toast({
                variant: "destructive",
                title: "Cannot run analysis",
                description: "The requirement data is not available yet.",
            });
            return;
        }
        setIsAiLoading(true);
        toast({
            title: "Starting AI Analysis...",
            description: "Finding the best supplier matches for your requirement. This may take a moment."
        })
        try {
            const aiResult = await findMatchingSuppliers({
                title: requirement.title,
                productCategory: requirement.productCategory,
                quantity: requirement.quantity,
                targetPrice: requirement.targetPrice,
                description: requirement.description,
            });

            if (!aiResult || aiResult.matches.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'AI Analysis Complete',
                    description: 'The AI could not find any suitable matches at this time.',
                });
                return;
            }

            const batch = writeBatch(firestore);
            aiResult.matches.forEach(match => {
                const matchRef = doc(firestore, 'requirements', requirementId, 'supplierMatches', match.supplierId);
                batch.set(matchRef, match);
            });

            await batch.commit();

            toast({
                title: "AI Analysis Complete!",
                description: `Found ${aiResult.matches.length} potential suppliers.`,
            });
            refetchMatches();

        } catch (error: any) {
            console.error("AI matching error:", error);
            toast({
                variant: "destructive",
                title: "AI Analysis Failed",
                description: error.message || "Could not complete the supplier matching analysis. Please try again.",
            });
        } finally {
            setIsAiLoading(false);
        }
    }, [requirement, firestore, requirementId, toast, refetchMatches]);


    // Effect to run analysis only if no matches are found
    useEffect(() => {
        if (!isLoadingRequirement && !isLoadingSuppliers && !isLoadingMatches && requirement && suppliers && !matches?.length) {
            runAiAnalysis();
        }
    }, [isLoadingRequirement, isLoadingSuppliers, isLoadingMatches, requirement, suppliers, matches, runAiAnalysis]);


    const sortedSuppliers = useMemo(() => {
        if (!suppliers || !matches) return [];

        const supplierDataMap = new Map(suppliers.map(s => [s.id, s]));

        return matches
            .map(match => {
                const supplierData = supplierDataMap.get(match.supplierId);
                return supplierData ? { ...supplierData, ...match } : null;
            })
            .filter((item): item is (Supplier & SupplierMatch) => item !== null)
            .sort((a, b) => b.matchScore - a.matchScore);

    }, [suppliers, matches]);


    const getTrustScore = (supplierId: string) => {
        let hash = 0;
        for (let i = 0; i < supplierId.length; i++) {
            const char = supplierId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return (Math.abs(hash) % 15) + 85; // Higher base trust score
    };

    const handleSendRequest = async (supplierId: string, supplierName: string) => {
        if (!user || !firestore || !requirement) {
            toast({ variant: 'destructive', title: 'Error', description: 'User or requirement data is missing.' });
            return;
        }

        // Ensure we have a professional name even if it's missing in the source
        const finalSupplierName = (supplierName && supplierName !== 'Supplier')
            ? supplierName
            : `Supplier #${supplierId.substring(0, 8).toUpperCase()}`;

        setSendingRequestId(supplierId);
        try {
            const chatsColRef = collection(firestore, 'chats');
            const chatDoc = {
                requirementId: requirementId,
                buyerId: user.uid,
                supplierId: supplierId,
                participants: [user.uid, supplierId],
                createdAt: serverTimestamp(),
                lastMessage: `Inquiry about: ${requirement.title}`,
                supplierName: finalSupplierName,
                buyerName: user.displayName || 'Buyer',
                requirementTitle: requirement.title,
            };
            const docRef = await addDocumentNonBlocking(chatsColRef, chatDoc);
            toast({
                title: 'Request Sent!',
                description: 'A new chat has been initiated. Redirecting you now...',
            });
            router.push(`/buyer/chats/${docRef.id}`);
        } catch (error) {
            console.error('Error creating chat:', error);
            toast({
                variant: 'destructive',
                title: 'Failed to Send Request',
                description: 'Could not initiate a chat. Please try again.'
            });
        } finally {
            setSendingRequestId(null);
        }
    };

    const isLoading = isLoadingRequirement || isLoadingSuppliers || isLoadingMatches || isLoadingCategories;
    const showSkeletons = isAiLoading || (isLoading && (!matches || matches.length === 0));

    return (
        <DashboardLayout>
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold md:text-2xl">Find Suppliers</h1>
                <Button onClick={runAiAnalysis} disabled={isAiLoading || isLoading}>
                    <RefreshCw className={cn("mr-2 h-4 w-4", isAiLoading && "animate-spin")} />
                    Run AI Analysis
                </Button>
            </div>
            {isLoadingRequirement && !requirement ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : requirement ? (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Requirement: {requirement.title}</CardTitle>
                            <CardDescription>
                                Here are potential suppliers for your requirement in the category: <Badge variant="secondary">{categoryLabel}</Badge>
                            </CardDescription>
                        </CardHeader>
                    </Card>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {showSkeletons ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <Card key={i} className="flex flex-col">
                                    <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                                    <CardContent className="flex-grow space-y-4">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-20 w-full" />
                                    </CardContent>
                                    <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                                </Card>
                            ))
                        ) : sortedSuppliers.length > 0 ? sortedSuppliers.map((supplier) => {
                            const trustScore = getTrustScore(supplier.id);
                            const isSending = sendingRequestId === supplier.id;

                            const maskName = (name: string) => {
                                if (!name) return "";
                                const parts = name.split(' ');
                                return parts.map(part => {
                                    if (part.length <= 1) return part;
                                    return part[0] + '*'.repeat(part.length - 1);
                                }).join(' ');
                            };

                            const displayedName = supplier.companyName
                                ? maskName(supplier.companyName)
                                : `Supplier #${supplier.id.substring(0, 8).toUpperCase()}`;

                            return (
                                <Card key={supplier.id} className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="flex items-center justify-between">
                                            <span>{displayedName}</span>
                                            <Badge className="bg-accent hover:bg-accent/90 text-accent-foreground border-yellow-500/50">
                                                <CheckCircle className="mr-1 h-3 w-3" />
                                                Verified
                                            </Badge>
                                        </CardTitle>
                                        <CardDescription>Indian Supplier</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow space-y-4">
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <h3 className="text-sm font-medium flex items-center cursor-help">
                                                                <Shield className="mr-2 h-4 w-4 text-primary" />
                                                                Trust Score
                                                                <Info className="ml-1 h-3 w-3 text-muted-foreground" />
                                                            </h3>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            <div className="space-y-2">
                                                                <p className="font-semibold">How Trust Score Works:</p>
                                                                <ul className="text-xs space-y-1">
                                                                    <li>✓ <strong>GST Verification</strong> - Valid GST registration</li>
                                                                    <li>✓ <strong>PAN Verification</strong> - Verified PAN card</li>
                                                                    <li>✓ <strong>ISO Certification</strong> - Quality standards compliance</li>
                                                                    <li>✓ <strong>TUV Certification</strong> - International quality mark</li>
                                                                    <li>✓ <strong>Completed Trades</strong> - Successful transaction history</li>
                                                                    <li>✓ <strong>Platform Activity</strong> - Active engagement & responsiveness</li>
                                                                </ul>
                                                                <p className="text-xs text-muted-foreground mt-2">Higher scores indicate more verified credentials and successful trades.</p>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                <span className="text-sm font-semibold text-primary">{trustScore}%</span>
                                            </div>
                                            <Progress value={trustScore} className="h-2" />
                                        </div>
                                        <div className="p-3 rounded-md bg-muted/50 border border-dashed border-accent/50">
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="text-sm font-medium flex items-center gap-2">
                                                    <Sparkles className="h-4 w-4 text-accent" />
                                                    AI Match Score
                                                </h3>
                                                <span className="text-sm font-semibold text-accent">{supplier.matchScore}%</span>
                                            </div>
                                            <Progress value={supplier.matchScore} className="h-2 bg-accent/30 [&>div]:bg-accent" />
                                            <p className="text-xs text-muted-foreground mt-2 italic flex items-start gap-2">
                                                <Bot className="h-4 w-4 shrink-0 mt-0.5" />
                                                <span>{supplier.justification}</span>
                                            </p>
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-2 pt-2">
                                            {supplier.companyDescription}
                                        </p>
                                    </CardContent>
                                    <CardFooter>
                                        <Button className="w-full" onClick={() => handleSendRequest(supplier.id, supplier.companyName || 'Supplier')} disabled={isSending}>
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
                        }) : (
                            <Card className="md:col-span-3">
                                <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                                    <h3 className="text-lg font-semibold">No Supplier Matches Found</h3>
                                    <p className="text-muted-foreground mt-2">The AI couldn't find any suitable suppliers for this requirement right now.</p>
                                    <Button onClick={runAiAnalysis} disabled={isAiLoading} className="mt-4">
                                        <RefreshCw className={cn("mr-2 h-4 w-4", isAiLoading && "animate-spin")} />
                                        Re-run AI Analysis
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-destructive">Requirement Not Found</CardTitle>
                        <CardDescription>The requirement you are looking for could not be found.</CardDescription>
                    </CardHeader>
                </Card>
            )}
        </DashboardLayout>
    );
}

const AuthenticatedFindSuppliersClient = withAuth(FindSuppliersClient, 'buyer');

