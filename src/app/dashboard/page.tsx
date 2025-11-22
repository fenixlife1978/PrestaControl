"use client";

import {
  ArrowUpRight,
  DollarSign,
  Landmark,
  TrendingDown,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";


const chartData = [
  { month: "Ene", approved: 0, paid: 0 },
  { month: "Feb", approved: 0, paid: 0 },
  { month: "Mar", approved: 0, paid: 0 },
  { month: "Abr", approved: 0, paid: 0 },
  { month: "May", approved: 0, paid: 0 },
  { month: "Jun", approved: 0, paid: 0 },
  { month: "Jul", approved: 0, paid: 0 },
];

type Loan = {
  id: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  avatar: string;
};

export default function Dashboard() {
  const firestore = useFirestore();
  const [loans, loading, error] = useCollection(collection(firestore, 'loans'));
  const recentLoans: Loan[] = loans ? loans.docs.slice(0, 5).map(doc => ({ id: doc.id, ...doc.data() } as Loan)) : [];
  
  const analytics = {
    totalLoans: loans?.docs.length || 0,
    outstandingBalance: loans ? loans.docs
      .filter((doc) => doc.data().status === "Aprobado")
      .reduce((acc, doc) => acc + doc.data().amount, 0) : 0,
    delinquencyRate: 0, // Placeholder
  };


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };
  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Préstamos Totales</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : analytics.totalLoans}</div>
            <p className="text-xs text-muted-foreground">
              +10.2% desde el mes pasado
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Saldo Pendiente
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : formatCurrency(analytics.outstandingBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              +12.1% desde el mes pasado
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tasa de Morosidad
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `${analytics.delinquencyRate}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              -2.5% desde el mes pasado
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Rendimiento de Préstamos</CardTitle>
            <CardDescription>
              Montos aprobados vs. pagados en los últimos 7 meses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                approved: { label: "Aprobado", color: "hsl(var(--primary))" },
                paid: { label: "Pagado", color: "hsl(var(--accent))" },
              }}
              className="min-h-[300px]"
            >
              <BarChart data={chartData}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={false}
                />
                <Legend />
                <Bar dataKey="approved" fill="var(--color-approved)" radius={4} />
                <Bar dataKey="paid" fill="var(--color-paid)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Préstamos Recientes</CardTitle>
            <CardDescription>
              Una lista de las solicitudes de préstamos más recientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-8">
            {loading && <p>Cargando...</p>}
            {recentLoans.map((loan) => (
              <div key={loan.id} className="flex items-center gap-4">
                <Avatar className="hidden h-9 w-9 sm:flex">
                  <AvatarImage src={`https://picsum.photos/seed/${loan.id}/40/40`} alt="Avatar" data-ai-hint="person portrait" />
                  <AvatarFallback>{loan.customerName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="grid gap-1">
                  <p className="text-sm font-medium leading-none">
                    {loan.customerName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {loan.customerEmail}
                  </p>
                </div>
                <div className="ml-auto font-medium">
                  +{formatCurrency(loan.amount)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
