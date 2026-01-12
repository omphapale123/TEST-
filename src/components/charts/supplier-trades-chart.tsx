
'use client';
import { useMemo } from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { subMonths, format, getMonth, getYear } from 'date-fns';
import { Loader2 } from 'lucide-react';

type Trade = {
    id: string;
    value: number;
    status: 'Finished';
    initiated: { toDate: () => Date };
};

const chartConfig = {
  value: {
    label: 'Revenue (€)',
    color: 'hsl(var(--primary))',
  },
};

export default function SupplierTradesChart() {
    const firestore = useFirestore();
    const { user } = useUser();
    
    const tradesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'trades'), where('supplierId', '==', user.uid), where('status', '==', 'Finished'));
    }, [firestore, user]);

    const { data: trades, isLoading } = useCollection<Trade>(tradesQuery);

    const chartData = useMemo(() => {
        const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), i)).reverse();
        
        const data = months.map(monthDate => {
            const monthName = format(monthDate, 'MMMM');
            const month = getMonth(monthDate);
            const year = getYear(monthDate);

            const monthlyValue = (trades || [])
                .filter(trade => {
                    if (!trade.initiated?.toDate) return false;
                    const tradeDate = trade.initiated.toDate();
                    return getMonth(tradeDate) === month && getYear(tradeDate) === year;
                })
                .reduce((acc, trade) => acc + trade.value, 0);

            return { month: monthName, value: monthlyValue };
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
      <LineChart
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
                    if (name === 'value') {
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
        <Line
            dataKey="value"
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={{
                fill: "var(--color-value)",
                r: 4,
            }}
        />
      </LineChart>
    </ChartContainer>
  );
}
