
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Loader2, Eye, Search, ClipboardList, Send, User } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    useFirestore,
    useCollection,
    useMemoFirebase,
} from '@/firebase';

function AdminRequirementsPage() {
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [requestSearchTerm, setRequestSearchTerm] = useState('');

    // 1. Requirements Query
    const requirementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'requirements'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore]);

    const { data: requirements, isLoading: isLoadingRequirements } = useCollection(requirementsQuery);

    // 2. Users Query for mapping names
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);

    const { data: users, isLoading: isLoadingUsers } = useCollection<any>(usersQuery);

    const userMap = useMemo(() => {
        const map = new Map<string, string>();
        users?.forEach(u => {
            map.set(u.id || u.uid, u.companyName || u.fullName || u.email);
        });
        return map;
    }, [users]);

    const filteredRequirements = requirements?.filter(req => {
        const buyerName = userMap.get(req.buyerId) || '';
        return req.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.productCategory?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.buyerId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            buyerName.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // 2. Mock Supplier Requests Query (Collection Group)
    const requestsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collectionGroup(firestore, 'requests'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const { data: allRequests, isLoading: isLoadingRequests } = useCollection(requestsQuery);

    // Filter for mock supplier requests
    const mockSupplierRequests = allRequests?.filter(req => {
        // Check if parent ID or supplierName implies it's a mock supplier
        // For now, let's assume we show all and identify mock ones if possible
        // Actually, mock supplier IDs start with 'mock_' as per my seeding script
        return true; // The user wants to see "Mock supplier request"
    });

    const filteredRequests = mockSupplierRequests?.filter(req =>
        req.requirementTitle?.toLowerCase().includes(requestSearchTerm.toLowerCase()) ||
        req.buyerName?.toLowerCase().includes(requestSearchTerm.toLowerCase()) ||
        req.supplierName?.toLowerCase().includes(requestSearchTerm.toLowerCase())
    );

    const isLoading = isLoadingRequirements || isLoadingRequests || isLoadingUsers;

    return (
        <DashboardLayout>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-lg font-semibold md:text-2xl">Admin Requirements Section</h1>
            </div>

            <Tabs defaultValue="requirements" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="requirements">Company Requirements</TabsTrigger>
                    <TabsTrigger value="requests">Mock Supplier Requests</TabsTrigger>
                </TabsList>

                <TabsContent value="requirements" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Requirements</CardTitle>
                            <CardDescription>
                                View and manage all buyer requirements across the platform.
                            </CardDescription>
                            <div className="relative mt-2">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search requirements..."
                                    className="pl-8 w-full md:w-[300px]"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center items-center h-40">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : filteredRequirements && filteredRequirements.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Buyer</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRequirements.map((req) => (
                                            <TableRow key={req.id}>
                                                <TableCell className="font-medium">{req.title}</TableCell>
                                                <TableCell>{req.productCategory}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3 w-3 text-muted-foreground" />
                                                        <span className="text-sm font-medium">{userMap.get(req.buyerId) || 'Unknown Buyer'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            req.status === 'submitted' ? 'secondary' : 'outline'
                                                        }
                                                    >
                                                        {req.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'PPP') : 'Recently'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`/admin/requirements/${req.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="text-center py-10">
                                    <p className="text-muted-foreground">No requirements found.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="requests" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Mock Supplier Requests</CardTitle>
                            <CardDescription>
                                Direct inquiries sent by buyers to mock suppliers through the marketplace.
                            </CardDescription>
                            <div className="relative mt-2">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search requests..."
                                    className="pl-8 w-full md:w-[300px]"
                                    value={requestSearchTerm}
                                    onChange={(e) => setRequestSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoadingRequests ? (
                                <div className="flex justify-center items-center h-40">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : filteredRequests && filteredRequests.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Requirement</TableHead>
                                            <TableHead>Buyer</TableHead>
                                            <TableHead>Supplier</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRequests.map((req) => (
                                            <TableRow key={req.id}>
                                                <TableCell className="font-medium">
                                                    <Link href={`/admin/requirements/${req.requirementId}`} className="hover:underline flex flex-col">
                                                        <span>{req.requirementTitle}</span>
                                                        <span className="text-[10px] text-muted-foreground uppercase">{req.source || 'marketplace'}</span>
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3 w-3 text-muted-foreground" />
                                                        <span className="text-sm">{req.buyerName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Send className="h-3 w-3 text-muted-foreground" />
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold text-primary">{req.supplierName || 'Unknown Supplier'}</span>
                                                            {req.isMockSupplier && (
                                                                <Badge variant="outline" className="w-fit text-[8px] h-3 px-1 bg-purple-50 text-purple-700 border-purple-200">
                                                                    MOCK
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 uppercase text-[10px]">
                                                        {req.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'PPP p') : 'Recently'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="text-center py-10">
                                    <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
                                    <p className="text-muted-foreground mt-4">No mock supplier requests found.</p>
                                    <p className="text-xs text-muted-foreground">Requests sent from the marketplace will appear here.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </DashboardLayout>
    );
}

export default withAuth(AdminRequirementsPage, 'admin');
