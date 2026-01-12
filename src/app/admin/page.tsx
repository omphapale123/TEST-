
'use client';
import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { DollarSign, Repeat, Users, CheckSquare, BarChart3, Users2, Loader2 } from 'lucide-react';
import AdminRevenueChart from '@/components/charts/admin-revenue-chart';
import AdminUserGrowthChart from '@/components/charts/admin-user-growth-chart';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';

type Trade = {
    id: string;
    value: number;
    status: string;
};

// This component contains the data-fetching logic and will only be rendered if the user is an admin.
function AdminDashboardContent() {
  const firestore = useFirestore();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection(usersQuery);

  const pendingUsersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('verificationStatus', '==', 'pending'));
  }, [firestore]);
  const { data: pendingUsers, isLoading: isLoadingPending } = useCollection(pendingUsersQuery);
  
  const tradesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'trades');
  }, [firestore]);
  const { data: trades, isLoading: isLoadingTrades } = useCollection<Trade>(tradesQuery);


  const totalUsers = useMemo(() => users?.length || 0, [users]);
  const pendingVerifications = useMemo(() => pendingUsers?.length || 0, [pendingUsers]);
  const totalTrades = useMemo(() => trades?.length || 0, [trades]);
  const totalRevenue = useMemo(() => {
    if (!trades) return 0;
    const completedTradesValue = trades
        .filter(t => t.status === 'Finished')
        .reduce((acc, trade) => acc + trade.value, 0);
    return completedTradesValue * 0.02; // 2% commission
  }, [trades]);

  const isLoading = isLoadingUsers || isLoadingPending || isLoadingTrades;

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Admin Dashboard</h1>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">€{totalRevenue.toLocaleString()}</div>}
              <p className="text-xs text-muted-foreground">Commission from finished trades</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
              <Repeat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{totalTrades}</div>}
              <p className="text-xs text-muted-foreground">Finished trades on the platform</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{totalUsers}</div>}
              <p className="text-xs text-muted-foreground">Buyers and Suppliers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
               {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{pendingVerifications}</div>}
              <p className="text-xs text-muted-foreground">
                <Link href="/admin/verify-documents" className="hover:underline">Review now</Link>
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'><BarChart3/> Monthly Revenue</CardTitle>
                    <CardDescription>Commission revenue over the past 6 months.</CardDescription>
                </CardHeader>
                <CardContent className='pl-2'>
                    <AdminRevenueChart />
                </CardContent>
            </Card>
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'><Users2/> Monthly User Growth</CardTitle>
                    <CardDescription>New buyer and supplier sign-ups over time.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    <AdminUserGrowthChart />
                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}


function AdminPage() {
  const { userRole, loading: isAuthLoading } = useAuth();

  // This wrapper ensures that we don't even try to render the dashboard content
  // (and its data fetches) until we've confirmed the user is an admin.
  if (isAuthLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  // If the user is not an admin, we can show an unauthorized message or just a loader
  // while the `withAuth` HOC handles redirection.
  if (userRole !== 'admin') {
    return (
        <DashboardLayout>
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
      </DashboardLayout>
    );
  }

  // Only render the content if the user is an admin
  return (
    <DashboardLayout>
        <AdminDashboardContent />
    </DashboardLayout>
  );
}

export default withAuth(AdminPage, 'admin');
