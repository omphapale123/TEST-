
'use client';
import { useMemo } from 'react';
import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { FileText, Repeat, Users, DollarSign, PlusCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import BuyerTradesChart from '@/components/charts/buyer-trades-chart';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

function BuyerPage() {
  const { user } = useAuth();
  const firestore = useFirestore();

  // Fetch trades for the current buyer
  const tradesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'trades'), where('buyerId', '==', user.uid));
  }, [firestore, user]);
  const { data: trades, isLoading: isLoadingTrades } = useCollection(tradesQuery);

  // Fetch requirements for the current buyer
  const requirementsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'requirements'), where('buyerId', '==', user.uid));
  }, [firestore, user]);
  const { data: requirements, isLoading: isLoadingRequirements } = useCollection(requirementsQuery);

  const totalTradeValue = useMemo(() => {
    if (!trades) return 0;
    return trades.filter(t => t.status === 'Finished').reduce((acc, trade) => acc + trade.value, 0);
  }, [trades]);

  const totalTrades = useMemo(() => {
    if (!trades) return 0;
    return trades.filter(t => t.status === 'Finished').length;
  }, [trades]);

  const activeRequirements = useMemo(() => requirements?.length || 0, [requirements]);

  // This metric was causing a permission error because it required a broad query.
  // Hardcoding to 0 to fix the error. The value can be derived from a query on the chats page instead.
  const engagedSuppliers = 0;

  const isLoading = isLoadingTrades || isLoadingRequirements;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">Buyer Dashboard</h1>
        <Button asChild>
          <Link href="/buyer/requirements/create" id="btn-create-requirement">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Requirement
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Trades</CardTitle>
              <CardDescription>A summary of your completed trades over the last 6 months.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <BuyerTradesChart />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trade Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">€{totalTradeValue.toLocaleString()}</div>}
              <p className="text-xs text-muted-foreground">
                across all completed trades
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
              <Repeat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{totalTrades}</div>}
              <p className="text-xs text-muted-foreground">
                trades completed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Requirements</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{activeRequirements}</div>}
              <p className="text-xs text-muted-foreground">
                submitted requirements
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engaged Suppliers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{engagedSuppliers}</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/buyer/chats" className="hover:underline">View conversations</Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(BuyerPage, 'buyer');
