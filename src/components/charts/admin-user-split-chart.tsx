// This file is no longer used and can be deleted.
// I am keeping it here to avoid breaking the build process.
'use client';
import { Pie, PieChart } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from '@/components/ui/chart';
import { useMemo } from 'react';

const chartData = [
  { userType: 'buyers', count: 2, fill: 'var(--color-buyers)' },
  { userType: 'suppliers', count: 3, fill: 'var(--color-suppliers)' },
];

const chartConfig = {
    count: {
        label: "Users"
    },
    buyers: {
        label: 'Buyers',
        color: 'hsl(var(--secondary))',
    },
    suppliers: {
        label: 'Suppliers',
        color: 'hsl(var(--primary))',
    },
};

export default function AdminUserSplitChart() {

  const totalUsers = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.count, 0)
  }, [])

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full max-w-xs mx-auto">
      <PieChart accessibilityLayer>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="userType"
          innerRadius={60}
          strokeWidth={5}
        >
        </Pie>
         <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-3xl font-bold"
        >
            {totalUsers.toLocaleString()}
        </text>
        <ChartLegend
          content={<ChartLegendContent nameKey="userType" />}
          className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
        />
      </PieChart>
    </ChartContainer>
  );
}
