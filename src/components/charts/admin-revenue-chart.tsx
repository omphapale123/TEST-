
'use client';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { subMonths, format, getMonth, getYear } from 'date-fns';
import { Loader2 } from 'lucide-react';

type Trade = {
    id: string;
    value: number;
    status: 'Finished';
    initiated: { toDate: () => Date };
};

const chartConfig = {
  revenue: {
    label: 'Revenue (€)',
    color: 'hsl(var(--primary))',
  },
};

export default function AdminRevenueChart() {
    const firestore = useFirestore();
    
    const tradesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'trades');
    }, [firestore]);

    const { data: trades, isLoading } = useCollection<Trade>(tradesQuery);

    const chartData = useMemo(() => {
        const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), i)).reverse();
        
        const data = months.map(monthDate => {
            const monthName = format(monthDate, 'MMMM');
            const month = getMonth(monthDate);
            const year = getYear(monthDate);

            const monthlyRevenue = (trades || [])
                .filter(trade => {
                    if (trade.status !== 'Finished' || !trade.initiated?.toDate) return false;
                    const tradeDate = trade.initiated.toDate();
                    return getMonth(tradeDate) === month && getYear(tradeDate) === year;
                })
                .reduce((acc, trade) => acc + (trade.value * 0.02), 0); // 2% commission

            return { month: monthName, revenue: monthlyRevenue };
        });

        return data;
    }, [trades]);

  if (isLoading) {
    return (
        <div className="flex justify-center items-center min-h-[200px] w-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart
        accessibilityLayer
        data={chartData}
        margin={{
          top: 5,
          right: 10,
          left: 10,
          bottom: 5,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <YAxis
          stroke="hsl(var(--primary))"
          tickFormatter={(value) => `€${value >= 1000 ? `${value / 1000}k` : value}`}
        />
        <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent
                labelFormatter={(value) => value}
                formatter={(value, name) => {
                    if (name === 'revenue') {
                        return (
                            <span>
                                {new Intl.NumberFormat('de-DE', {
                                    style: 'currency',
                                    currency: 'EUR',
                                }).format(value as number)}
                            </span>
                        )
                    }
                    return value;
                }}
            />}
        />
        <Bar
            dataKey="revenue"
            fill="var(--color-revenue)"
            radius={4}
        />
      </BarChart>
    </ChartContainer>
  );
}
