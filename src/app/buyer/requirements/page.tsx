
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { collection, query, where, doc, deleteDoc } from 'firebase/firestore';
import { PlusCircle, Loader2, Eye, Pencil, Trash2, Sparkles, Users, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
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
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { useToast } from '@/hooks/use-toast';
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

function RequirementsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  const requirementsQuery = useMemoFirebase(() => {
    // FIX: Ensure user and firestore are not null before creating the query.
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'requirements'),
      where('buyerId', '==', user.uid)
    );
  }, [firestore, user]);

  const { data: requirements, isLoading, refetch: refetchRequirements } = useCollection(requirementsQuery);

  const handleDeleteRequirement = async (requirementId: string) => {
    if (!firestore) return;
    setDeletingId(requirementId);
    
    try {
        const docRef = doc(firestore, 'requirements', requirementId);
        await deleteDocumentNonBlocking(docRef);
        toast({
        title: 'Requirement Deleted',
        description: 'The requirement has been removed from the list.',
        });
        refetchRequirements(); // Re-fetch the data to update the UI
    } catch(error) {
        toast({
            variant: "destructive",
            title: 'Error',
            description: 'Could not delete the requirement.',
        });
        console.error("Error deleting requirement:", error);
    } finally {
        setDeletingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
            </Button>
            <h1 className="text-lg font-semibold md:text-2xl">Your Requirements</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/buyer/requirements/create-with-ai">
              <Sparkles className="mr-2 h-4 w-4" />
              Create with AI
            </Link>
          </Button>
          <Button asChild>
            <Link href="/buyer/requirements/create">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Requirement
            </Link>
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My Requirements</CardTitle>
          <CardDescription>
            A list of all the product requirements you have created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : requirements && requirements.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.title}</TableCell>
                    <TableCell>{req.productCategory}</TableCell>
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
                      {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'PPP') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex gap-2 justify-end">
                          <Button asChild variant="outline" size="icon">
                            <Link href={`/buyer/requirements/${req.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="icon" className="relative">
                              <Link href={`/buyer/requirements/${req.id}/requests`}>
                                <Users className="h-4 w-4" />
                              </Link>
                          </Button>
                          <Button asChild variant="secondary" size="icon" disabled={req.status === 'submitted'}>
                            <Link href={`/buyer/requirements/edit/${req.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                           <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" disabled={deletingId === req.id}>
                                    {deletingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the requirement.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteRequirement(req.id)}>
                                    Continue
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">You haven't created any requirements yet.</p>
              <Button variant="link" asChild className="mt-2">
                <Link href="/buyer/requirements/create">Get started by creating one</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export default withAuth(RequirementsPage, 'buyer');
