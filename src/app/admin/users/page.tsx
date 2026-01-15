
'use client';

import { useState, useMemo } from 'react';
import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ban, Loader2, Search, CheckCircle, Clock, Eye, X, User, Briefcase, DollarSign, FileText, Repeat } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

// Define the User type based on the expected Firestore document structure
type User = {
    id: string;
    companyName: string;
    email: string;
    role: 'buyer' | 'supplier' | 'admin';
    country: string;
    verificationStatus: 'verified' | 'pending' | 'unverified';
    hrbNumber?: string;
    fullName?: string;
    contactNumber?: string;
    trades: number;
    tradeVolume: number;
    gstNumber?: string;
    panNumber?: string;
    udyamNumber?: string;
    isoCertificate?: string;
    isoDocumentUrl?: string;
    tuvCertificate?: string;
    tuvDocumentUrl?: string;
    companyDescription?: string;
    specializedCategories?: string[];
};

type Category = {
    id: string;
    name: string;
    label: string;
    active: boolean;
};

function AdminUsersPage() {
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { toast } = useToast();

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);

    const { data: users, isLoading: isLoadingUsers } = useCollection<User>(usersQuery);

    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'categories');
    }, [firestore]);

    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

    const buyers = useMemo(() => (users || []).filter(u => u.role === 'buyer'), [users]);
    const suppliers = useMemo(() => (users || []).filter(u => u.role === 'supplier'), [users]);

    const handleBlockUser = async (userId: string, userName: string) => {
        setProcessingId(userId);
        await new Promise(resolve => setTimeout(resolve, 1000)); // simulate async action

        console.log(`Blocking user ${userId}`);

        toast({
            title: 'User Blocked',
            description: `${userName} has been blocked from accessing the platform.`,
        });
        setProcessingId(null);
    };

    const handleViewDocument = (docType: string, docUrl: string) => {
        if (docUrl && docUrl.startsWith('http')) {
            window.open(docUrl, '_blank');
        } else if (docUrl) {
            toast({
                title: `Viewing Document`,
                description: `Document identifier: ${docUrl}`,
            });
        }
    };

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'verified':
                return <Badge className="bg-green-500/20 text-green-300 border-green-500/50 hover:bg-green-500/30"><CheckCircle className="mr-1 h-3 w-3" />Verified</Badge>;
            case 'pending':
                return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
            case 'unverified':
            default:
                return <Badge variant="outline">Unverified</Badge>;
        }
    };

    const UserDetailsSheet = ({ user, allCategories }: { user: User; allCategories: Category[] | null }) => {

        const getCategoryLabel = (categoryId: string) => {
            return allCategories?.find(c => c.id === categoryId)?.label || categoryId;
        };

        return (
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                    </Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-lg w-[90vw] overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>{user.companyName}</SheetTitle>
                        <SheetDescription>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)} from {user.country}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 py-6">
                        {/* Personal Info */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-foreground">Contact Information</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Full Name</p>
                                    <p className="font-medium">{user.fullName || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Email</p>
                                    <p className="font-medium break-words">{user.email}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Contact Number</p>
                                    <p className="font-medium">{user.contactNumber || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        <Separator />
                        {/* Trade Info */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-foreground">Trade Statistics</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm items-center">
                                <div>
                                    <p className="text-muted-foreground">Total Trades</p>
                                    <p className="font-medium flex items-center gap-2"><Briefcase className="h-4 w-4" /> {user.trades || 0}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Total Trade Volume</p>
                                    <p className="font-medium flex items-center gap-2"><DollarSign className="h-4 w-4" /> €{(user.tradeVolume || 0).toLocaleString()}</p>
                                </div>
                                <div className="col-span-2">
                                    <Button asChild variant="outline" className="w-full">
                                        <Link href="/admin/trades">
                                            <Repeat className="mr-2 h-4 w-4" />
                                            View All Trades for this User
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <Separator />
                        {/* Verification/Company Info */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-foreground">Verification & Company Details</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Verification Status</p>
                                    <div>{renderStatusBadge(user.verificationStatus)}</div>
                                </div>
                                {user.role === 'buyer' && user.hrbNumber && (
                                    <div>
                                        <p className="text-muted-foreground">HRA/HRB Number</p>
                                        <p className="font-medium">{user.hrbNumber}</p>
                                    </div>
                                )}
                                {user.role === 'supplier' && user.gstNumber && (
                                    <div>
                                        <p className="text-muted-foreground">GST Number</p>
                                        <p className="font-medium">{user.gstNumber}</p>
                                    </div>
                                )}
                                {user.role === 'supplier' && user.panNumber && (
                                    <div>
                                        <p className="text-muted-foreground">PAN Number</p>
                                        <p className="font-medium">{user.panNumber}</p>
                                    </div>
                                )}
                                {user.role === 'supplier' && user.udyamNumber && (
                                    <div>
                                        <p className="text-muted-foreground">Udyam Number</p>
                                        <p className="font-medium">{user.udyamNumber}</p>
                                    </div>
                                )}
                                {user.role === 'supplier' && (user.isoDocumentUrl || user.isoCertificate) && (
                                    <div>
                                        <p className="text-muted-foreground">ISO Certificate</p>
                                        <Button variant="link" className="p-0 h-auto font-medium" onClick={() => handleViewDocument('ISO Certificate', user.isoDocumentUrl || user.isoCertificate || '')}>
                                            <Eye className="mr-2 h-4 w-4" /> View Document
                                        </Button>
                                    </div>
                                )}
                                {user.role === 'supplier' && (user.tuvDocumentUrl || user.tuvCertificate) && (
                                    <div>
                                        <p className="text-muted-foreground">TUV Certificate</p>
                                        <Button variant="link" className="p-0 h-auto font-medium" onClick={() => handleViewDocument('TUV Certificate', user.tuvDocumentUrl || user.tuvCertificate || '')}>
                                            <Eye className="mr-2 h-4 w-4" /> View Document
                                        </Button>
                                    </div>
                                )}
                            </div>
                            {user.role === 'supplier' && (
                                <div className="space-y-4 pt-2">
                                    {user.companyDescription && (
                                        <div>
                                            <p className="text-muted-foreground">Company Description</p>
                                            <p className="font-medium">{user.companyDescription}</p>
                                        </div>
                                    )}
                                    {user.specializedCategories && user.specializedCategories.length > 0 && (
                                        <div>
                                            <p className="text-muted-foreground">Specialized Categories</p>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {user.specializedCategories.map(catId => <Badge key={catId} variant="secondary">{getCategoryLabel(catId)}</Badge>)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <SheetClose asChild>
                        <Button type="submit" variant="outline" className="w-full">Close</Button>
                    </SheetClose>
                </SheetContent>
            </Sheet>
        );
    }

    const renderTable = (data: User[], allCategories: Category[] | null) => {
        const filteredData = data.filter(u => {
            const companyMatch = (u.companyName || '').toLowerCase().includes(searchTerm.toLowerCase());
            const emailMatch = (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
            return companyMatch || emailMatch;
        });

        const isLoading = isLoadingUsers || isLoadingCategories;

        if (isLoading) {
            return (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            );
        }

        if (filteredData.length === 0) {
            return <p className="text-center text-muted-foreground p-4">No users match your search.</p>
        }

        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.map(user => (
                        <TableRow key={user.id}>
                            <TableCell>{user.companyName || 'N/A'}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.country}</TableCell>
                            <TableCell>{renderStatusBadge(user.verificationStatus)}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end items-center gap-2">
                                    <UserDetailsSheet user={user} allCategories={allCategories} />
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="icon" disabled={processingId === user.id}>
                                                {processingId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will block {user.companyName} from accessing the platform. Are you sure you want to continue?
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleBlockUser(user.id, user.companyName)}>Block User</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
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
                <h1 className="text-lg font-semibold md:text-2xl">User Management</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Registered Users</CardTitle>
                    <CardDescription>View and manage all buyers and suppliers on the platform.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end mb-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by company or email..."
                                className="pl-8 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <Tabs defaultValue="buyers">
                        <TabsList className="grid w-full grid-cols-2 max-w-sm">
                            <TabsTrigger value="buyers">Buyers ({buyers.length})</TabsTrigger>
                            <TabsTrigger value="suppliers">Suppliers ({suppliers.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="buyers" className="mt-4">
                            {renderTable(buyers, categories)}
                        </TabsContent>
                        <TabsContent value="suppliers" className="mt-4">
                            {renderTable(suppliers, categories)}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}

export default withAuth(AdminUsersPage, 'admin');

