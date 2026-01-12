
'use client';
import { useState, useMemo } from 'react';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, X, ShieldQuestion, Building, Factory, Loader2, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, updateDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';

function VerifyDocumentsContent() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const pendingUsersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('verificationStatus', '==', 'pending'));
    }, [firestore]);

    const { data: pendingUsers, isLoading, refetch } = useCollection(pendingUsersQuery);

    const buyers = useMemo(() => (pendingUsers || []).filter(u => u.role === 'buyer'), [pendingUsers]);
    const suppliers = useMemo(() => (pendingUsers || []).filter(u => u.role === 'supplier'), [pendingUsers]);

    const handleAction = async (userId: string, companyName: string, action: 'verified' | 'unverified') => {
        if (!firestore) return;
        setUpdatingId(userId);

        const userDocRef = doc(firestore, 'users', userId);
        await updateDocumentNonBlocking(userDocRef, { verificationStatus: action });

        toast({
            title: `Request ${action === 'verified' ? 'Approved' : 'Rejected'}`,
            description: `The verification for ${companyName} has been processed.`,
        });
        setUpdatingId(null);
    };

    const handleViewDocument = (docType: string, docUrl: string) => {
        if (docUrl.startsWith('http')) {
            window.open(docUrl, '_blank');
        } else {
            toast({
                title: `Viewing Document`,
                description: `Document identifier: ${docUrl}`,
            });
        }
    };

    return (
        <DashboardLayout>
            <div className="flex items-center">
                <h1 className="text-lg font-semibold md:text-2xl">Verify Documents</h1>
            </div>
            <Tabs defaultValue="buyers">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="buyers">
                        <Building className="mr-2" />
                        Buyer Requests ({buyers.length})
                    </TabsTrigger>
                    <TabsTrigger value="suppliers">
                        <Factory className="mr-2" />
                        Supplier Requests ({suppliers.length})
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="buyers">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Buyer Verifications</CardTitle>
                            <CardDescription>Review and approve or reject German buyer HRA/HRB number submissions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                            ) : buyers.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Company Name</TableHead>
                                            <TableHead>HRA/HRB Number</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {buyers.map(user => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">{user.companyName}</TableCell>
                                                <TableCell>{user.hrbNumber}</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600"
                                                        onClick={() => handleAction(user.id, user.companyName, 'unverified')}
                                                        disabled={updatingId === user.id}
                                                    >
                                                        {updatingId === user.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700"
                                                        onClick={() => handleAction(user.id, user.companyName, 'verified')}
                                                        disabled={updatingId === user.id}
                                                    >
                                                        {updatingId === user.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                        Approve
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="text-center py-10">
                                    <ShieldQuestion className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-semibold">No Pending Buyer Requests</h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        All buyer verification requests have been processed.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="suppliers">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Supplier Verifications</CardTitle>
                            <CardDescription>Review and approve or reject individual Indian supplier document submissions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                            ) : suppliers.length > 0 ? (
                                <div className="space-y-6">
                                    {suppliers.map(user => {
                                        const documents = [
                                            { label: 'GST Number', value: user.gstNumber, type: 'text' },
                                            { label: 'PAN Number', value: user.panNumber, type: 'text' },
                                            { label: 'Udyam Number', value: user.udyamNumber, type: 'text' },
                                            { label: 'ISO Certificate', value: user.isoDocumentUrl || user.isoCertificate, type: user.isoDocumentUrl ? 'document' : 'text' },
                                            { label: 'TUV Certificate', value: user.tuvDocumentUrl || user.tuvCertificate, type: user.tuvDocumentUrl ? 'document' : 'text' },
                                        ].filter(doc => doc.value);

                                        return (
                                            <Card key={user.id} className="overflow-hidden">
                                                <CardHeader className="bg-muted/50">
                                                    <CardTitle className="text-base">{user.companyName}</CardTitle>
                                                    <CardDescription>{user.email}</CardDescription>
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[200px]">Document Type</TableHead>
                                                                <TableHead>Identifier / Document</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {documents.map(doc => (
                                                                <TableRow key={doc.label}>
                                                                    <TableCell className="font-medium">{doc.label}</TableCell>
                                                                    <TableCell>
                                                                        {doc.type === 'document' ? (
                                                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleViewDocument(doc.label, doc.value as string)}>
                                                                                <Eye className="mr-2 h-4 w-4" />
                                                                                View Document
                                                                            </Button>
                                                                        ) : (
                                                                            doc.value
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </CardContent>
                                                <CardFooter className="bg-muted/50 p-4 flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600"
                                                        onClick={() => handleAction(user.id, user.companyName, 'unverified')}
                                                        disabled={updatingId === user.id}
                                                    >
                                                        {updatingId === user.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                                                        Reject All
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700"
                                                        onClick={() => handleAction(user.id, user.companyName, 'verified')}
                                                        disabled={updatingId === user.id}
                                                    >
                                                        {updatingId === user.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                        Approve All
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-10">
                                    <ShieldQuestion className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-semibold">No Pending Supplier Requests</h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        When suppliers submit documents for verification, they will appear here.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </DashboardLayout>
    );
}

// Wrapper component to handle auth
function VerifyDocumentsPage() {
    const { userRole, loading: isAuthLoading } = useAuth();

    if (isAuthLoading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    if (userRole !== 'admin') {
        return <DashboardLayout><div>Unauthorized</div></DashboardLayout>;
    }

    return <VerifyDocumentsContent />;
}

export default withAuth(VerifyDocumentsPage, 'admin');
