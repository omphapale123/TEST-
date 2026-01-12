
'use client';
import { useMemo } from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { subMonths, format, getMonth, getYear } from 'date-fns';
import { Loader2 } from 'lucide-react';


type User = {
    id: string;
    role: 'buyer' | 'supplier';
    createdAt: { toDate: () => Date };
};

const chartConfig = {
  buyers: {
    label: 'Buyers',
    color: 'hsl(var(--secondary))',
  },
  suppliers: {
    label: 'Suppliers',
    color: 'hsl(var(--primary))',
  },
};

export default function AdminUserGrowthChart() {
    const firestore = useFirestore();

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: users, isLoading } = useCollection<User>(usersQuery);

    const chartData = useMemo(() => {
        const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), i)).reverse();
        
        const data = months.map(monthDate => {
            const monthName = format(monthDate, 'MMM');
            const month = getMonth(monthDate);
            const year = getYear(monthDate);

            const monthlySignups = (users || []).filter(user => {
                if (!user.createdAt?.toDate) return false;
                const signupDate = user.createdAt.toDate();
                return getMonth(signupDate) === month && getYear(signupDate) === year;
            });
            
            return {
                month: monthName,
                buyers: monthlySignups.filter(u => u.role === 'buyer').length,
                suppliers: monthlySignups.filter(u => u.role === 'supplier').length,
            };
        });

        return data;
    }, [users]);
    
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
          top: 20,
          right: 10,
          left: 10,
          bottom: 0,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => value}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          allowDecimals={false}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="buyers"
          type="monotone"
          stroke="var(--color-buyers)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="suppliers"
          type="monotone"
          stroke="var(--color-suppliers)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
