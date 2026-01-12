'use client';

import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { Loader2, Calendar, Tags, Package, DollarSign, Globe, FileText, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import React from 'react';

interface ViewRequirementPageProps {
    requirementId: string;
}

function ViewRequirementPage({ requirementId }: ViewRequirementPageProps) {
  const firestore = useFirestore();
  const router = useRouter();

  const requirementRef = useMemoFirebase(() => {
    if (!firestore || !requirementId) return null;
    return doc(firestore, 'requirements', requirementId);
  }, [firestore, requirementId]);

  const { data: requirement, isLoading } = useDoc(requirementRef);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
            </Button>
            <h1 className="text-lg font-semibold md:text-2xl">Requirement Details</h1>
        </div>
         {requirement?.status === 'submitted' && (
            <Button asChild>
                <Link href={`/buyer/requirements/${requirementId}/find-suppliers`}>
                    Find Suppliers
                </Link>
            </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : requirement ? (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-2xl">{requirement.title}</CardTitle>
                    <CardDescription>
                        {requirement.createdAt?.toDate ? format(requirement.createdAt.toDate(), 'PPP') : 'Date not available'}
                    </CardDescription>
                </div>
                 <Badge
                    variant={
                        requirement.status === 'submitted' ? 'secondary' : 'outline'
                    }
                    className="capitalize text-sm"
                    >
                    {requirement.status}
                </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose max-w-none text-card-foreground dark:prose-invert">
                <p>{requirement.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                <div className="flex items-start gap-3">
                    <Tags className="h-5 w-5 mt-1 text-primary" />
                    <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="font-medium">{requirement.productCategory}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 mt-1 text-primary" />
                    <div>
                        <p className="text-muted-foreground">Quantity</p>
                        <p className="font-medium">{requirement.quantity.toLocaleString()}</p>
                    </div>
                </div>
                 <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 mt-1 text-primary" />
                    <div>
                        <p className="text-muted-foreground">Target Price</p>
                        <p className="font-medium">${requirement.targetPrice.toFixed(2)} / item</p>
                    </div>
                </div>
                 <div className="flex items-start gap-3">
                    <Globe className="h-5 w-5 mt-1 text-primary" />
                    <div>
                        <p className="text-muted-foreground">Destination</p>
                        <p className="font-medium">{requirement.destinationCountry}</p>
                    </div>
                </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Requirement Not Found</CardTitle>
            <CardDescription>The requirement you are looking for could not be found or you do not have permission to view it.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </DashboardLayout>
  );
}

const AuthenticatedViewRequirementPage = withAuth(ViewRequirementPage, 'buyer');

export default AuthenticatedViewRequirementPage;
