
'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { DollarSign, CheckCircle, Repeat, MessageSquare, Percent, ShieldCheck, Loader2 } from 'lucide-react';
import SupplierTradesChart from '@/components/charts/supplier-trades-chart';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

function SupplierPage() {
  const { user, verificationStatus } = useAuth();
  const firestore = useFirestore();
  const [trustScore, setTrustScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);

  // Fetch trades for the current supplier
  const tradesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'trades'), where('supplierId', '==', user.uid));
  }, [firestore, user]);
  const { data: trades, isLoading: isLoadingTrades } = useCollection(tradesQuery);
  
  const { totalRevenue, completedTrades } = useMemo(() => {
    if (!trades) return { totalRevenue: 0, completedTrades: 0 };
    
    const finishedTrades = trades.filter(t => t.status === 'Finished');
    const revenue = finishedTrades.reduce((acc, trade) => acc + trade.value, 0);
    const tradeCount = finishedTrades.length;
    
    return { totalRevenue: revenue, completedTrades: tradeCount };
  }, [trades]);

  const activeInquiries = 0;
  const successRate = 0;
  
  const isLoading = isLoadingTrades;

  const isVerified = verificationStatus === 'verified';
  const chartConfig = {
    score: {
      label: 'Trust Score',
      color: 'hsl(var(--primary))',
    },
  };

  useEffect(() => {
    // Trust score calculation:
    // Base: 10
    // Verified: +40
    // Each completed trade: +20 (up to a max of 50 points from trades)
    let score = 10;
    if (isVerified) {
        score += 40;
    }
    if (completedTrades > 0) {
        score += Math.min(completedTrades * 20, 50);
    }
    const finalScore = Math.min(score, 100);
    setTrustScore(finalScore);

    const animationDuration = 1000; 
    const frameDuration = 1000 / 60; 
    const totalFrames = Math.round(animationDuration / frameDuration);
    let frame = 0;

    const counter = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      const currentScore = Math.round(finalScore * progress);
      setDisplayScore(currentScore);

      if (frame === totalFrames) {
        clearInterval(counter);
        setDisplayScore(finalScore);
      }
    }, frameDuration);

    return () => clearInterval(counter);

  }, [isVerified, completedTrades]);
  
  const chartData = [{ name: 'score', value: displayScore, fill: 'hsl(var(--primary))' }];
  
  return (
    <DashboardLayout>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Supplier Dashboard</h1>
      </div>
       <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-6">
            <Card className="relative overflow-hidden">
                <video 
                    src="https://storage.googleapis.com/firebase-studio-app-bucket/project-specific-assets/offshore-bridge/manufacturing.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute top-0 left-0 w-full h-full object-cover z-0"
                />
                <div className="absolute top-0 left-0 w-full h-full bg-black/60 z-10"></div>
                <div className="relative z-20 text-white">
                    <CardHeader>
                        <CardTitle>Trust Score</CardTitle>
                        <CardDescription className="text-white/80">Your score is based on verification and successful trade history.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center gap-2 text-center py-8">
                        <ChartContainer
                          config={chartConfig}
                          className="mx-auto aspect-square h-48"
                        >
                          <RadialBarChart
                            data={chartData}
                            startAngle={90}
                            endAngle={-270}
                            innerRadius="70%"
                            outerRadius="100%"
                            barSize={20}
                          >
                            <PolarAngleAxis
                              type="number"
                              domain={[0, 100]}
                              dataKey="value"
                              tick={false}
                            />
                            <RadialBar
                              dataKey="value"
                              background={{ fill: 'hsla(var(--foreground), 0.1)' }}
                              cornerRadius={10}
                              className="fill-primary drop-shadow-[0_4px_8px_hsl(var(--primary)/0.5)]"
                            />
                             <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-4xl font-bold">
                                {displayScore}%
                            </text>
                          </RadialBarChart>
                        </ChartContainer>
                         
                         {isVerified ? (
                            <Badge className="bg-green-500/20 text-green-300 border-green-500/50 hover:bg-green-500/30 text-base px-4 py-1">
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                Verified
                            </Badge>
                         ) : (
                            <Button asChild variant="secondary" className="mt-2">
                                <Link href="/profile">Verify Now</Link>
                            </Button>
                         )}
                         <p className="text-center text-sm text-white/80 max-w-xs mt-2">
                           Complete your profile and trades to increase your score and attract more buyers.
                         </p>
                    </CardContent>
                </div>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Monthly Performance</CardTitle>
                    <CardDescription>A summary of your trade value and volume over the last 6 months.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    <SupplierTradesChart />
                </CardContent>
            </Card>
        </div>
         <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">€{totalRevenue.toLocaleString()}</div>}
                    <p className="text-xs text-muted-foreground">
                    from {completedTrades} completed trades
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed Trades</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{completedTrades}</div>}
                    <p className="text-xs text-muted-foreground">
                    Successfully delivered
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Inquiries</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{activeInquiries}</div>
                    <p className="text-xs text-muted-foreground">
                      <Link href="/supplier/chats" className="hover:underline">View conversations</Link>
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                    <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{successRate.toFixed(0)}%</div>
                    <p className="text-xs text-muted-foreground">
                    Calculated from chats vs. trades
                    </p>
                </CardContent>
            </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(SupplierPage, 'supplier');

    