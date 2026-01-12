
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, orderBy, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Loader2, Eye, Tags, Package, DollarSign, Search, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  useUser,
  setDocumentNonBlocking,
} from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { createNotification } from '@/lib/notifications';

function MarketplacePage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user: supplierUser } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [interestId, setInterestId] = useState<string | null>(null);

  const requirementsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'requirements'),
      where('status', '==', 'submitted')
    );
  }, [firestore]);

  const { data: requirements, isLoading } = useCollection(requirementsQuery);

  const filteredRequirements = useMemo(() => {
    if (!requirements) return [];
    if (!searchTerm) return requirements;

    return requirements.filter(req =>
      req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.productCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, requirements]);

  const handleExpressInterest = async (requirement: any) => {
    if (!supplierUser || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not identify supplier information.' });
      return;
    }
    setInterestId(requirement.id);

    try {
      const supplierDocRef = doc(firestore, 'users', supplierUser.uid);
      const supplierDoc = await getDoc(supplierDocRef);
      const supplierName = supplierDoc.exists() ? supplierDoc.data().companyName : supplierUser.email;

      if (!supplierName) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not identify your company name or email. Please update your profile.' });
        setInterestId(null);
        return;
      }

      await setDocumentNonBlocking(buyerRequestsRef, {
        requirementId: requirement.id,
        requirementTitle: requirement.title,
        supplierId: supplierUser.uid,
        supplierName: supplierName,
        status: 'pending',
        createdAt: serverTimestamp(),
      }, {});

      // Notify the buyer
      await createNotification(requirement.buyerId, {
        type: 'request',
        title: 'New Interest Request',
        message: `${supplierName} is interested in your requirement: ${requirement.title}`,
        relatedId: requirement.id,
      });

      toast({
        title: 'Interest Expressed!',
        description: `The buyer has been notified of your interest.`,
      });

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to Express Interest',
        description: error.message || 'An unknown error occurred. Please try again.',
      });
    } finally {
      setInterestId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-lg font-semibold md:text-2xl">Marketplace</h1>
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search requirements..."
            className="pl-8 sm:w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Active Opportunities</CardTitle>
          <CardDescription>
            A list of active product requirements from German buyers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredRequirements && filteredRequirements.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredRequirements.map((req) => (
                <Card key={req.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg">{req.title}</CardTitle>
                    <CardDescription>
                      Posted {req.createdAt?.toDate ? formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true }) : 'N/A'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-4">
                    <div className="flex items-center gap-2">
                      <Tags className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="secondary">{req.productCategory}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Quantity: {req.quantity.toLocaleString()} units</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Target Price: €{req.targetPrice.toFixed(2)} / unit</span>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-wrap justify-end gap-2">
                    <Button asChild variant="outline">
                      <Link href={`/supplier/requirements/view/${req.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Link>
                    </Button>
                    <Button onClick={() => handleExpressInterest(req)} disabled={interestId === req.id}>
                      {interestId === req.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Express Interest
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                {searchTerm ? 'No requirements match your search.' : 'No active buyer requests at the moment.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export default withAuth(MarketplacePage, 'supplier');
