
'use client';
import { useState } from 'react';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Loader2, Trash2, Inbox, Mail, User, Calendar, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import {
  useFirestore,
  useCollection,
  deleteDocumentNonBlocking,
  useMemoFirebase,
} from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from '@/components/ui/accordion';
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
import { useAuth } from '@/hooks/use-auth';

function AdminInboxPage() {
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

  return <AdminInboxContent />;
}

// The actual content is moved to a separate component
function AdminInboxContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'contactSubmissions'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: submissions, isLoading } = useCollection(submissionsQuery);

  const handleDelete = async (submissionId: string) => {
    if (!firestore) return;
    setDeletingId(submissionId);
    
    const docRef = doc(firestore, 'contactSubmissions', submissionId);
    await deleteDocumentNonBlocking(docRef);

    toast({
        title: 'Message Deleted',
        description: 'The contact submission has been removed.',
    });
    setDeletingId(null);
  };

  return (
    <DashboardLayout>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Inbox</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Contact Form Submissions</CardTitle>
          <CardDescription>Messages from users via the contact form.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : submissions && submissions.length > 0 ? (
            <Accordion type="multiple" className="w-full">
                {submissions.map((submission) => (
                    <AccordionItem value={submission.id} key={submission.id}>
                        <div className="flex items-center justify-between py-4">
                            <AccordionTrigger className="flex-1 hover:no-underline">
                                <div className="flex items-center gap-4">
                                    <Mail className="h-5 w-5 text-muted-foreground" />
                                    <div className="text-left">
                                        <p className="font-semibold">{submission.subject}</p>
                                        <p className="text-sm text-muted-foreground">
                                            From: {submission.name} ({submission.email})
                                        </p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                             <div className="flex items-center gap-4 ml-4">
                                <span className="text-sm text-muted-foreground">
                                    {submission.createdAt ? formatDistanceToNow(submission.createdAt.toDate(), { addSuffix: true }) : 'N/A'}
                                </span>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={deletingId === submission.id}>
                                            {deletingId === submission.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive" />}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete this message. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(submission.id)}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                        <AccordionContent>
                           <div className="prose prose-sm dark:prose-invert max-w-none pl-10 pb-4">
                             <p>{submission.message}</p>
                             <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground not-prose mt-4 pt-4 border-t">
                                <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /><span>{submission.name}</span></div>
                                <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /><span>{submission.email}</span></div>
                                {submission.contactNumber && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /><span>{submission.contactNumber}</span></div>}
                                <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /><span>{submission.createdAt ? submission.createdAt.toDate().toLocaleString() : ''}</span></div>
                             </div>
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
          ) : (
            <div className="text-center py-10">
              <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Inbox is Empty</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                No contact form submissions yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}


export default withAuth(AdminInboxPage, 'admin');
