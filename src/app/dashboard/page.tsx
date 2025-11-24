
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
import { collection, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemo } from "react";
import { differenceInMonths } from "date-fns";


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
  partnerName: string;
  partnerId: string;
  amount: number;
  status: "Aprobado" | "Pendiente" | "Rechazado" | "Pagado";
  loanType: "estandar" | "personalizado";
  interestRate?: string;
  installments?: string;
  startDate: Timestamp;
  hasInterest?: boolean;
  paymentType?: 'cuotas' | 'libre';
  interestType?: 'porcentaje' | 'fijo';
  customInterest?: string;
  customInstallments?: string;
  // customerEmail might not be available, let's make it optional
  customerEmail?: string;
};

type Payment = {
  id: string;
  amount: number;
}

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
}

export default function Dashboard() {
  const firestore = useFirestore();
  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, 'loans') : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, 'partners') : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, 'payments') : null);

  const partners: Partner[] = useMemo(() => partnersCol ? partnersCol.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) : [], [partnersCol]);

  const loans: Loan[] = useMemo(() => loansCol ? loansCol.docs.map(doc => ({id: doc.id, ...doc.data()} as Loan)) : [], [loansCol]);

  const payments: Payment[] = useMemo(() => paymentsCol ? paymentsCol.docs.map(doc => ({id: doc.id, ...doc.data()} as Payment)) : [], [paymentsCol]);


  const recentLoans: Loan[] = useMemo(() => loans ? loans.slice(0, 5).map(loan => {
      const partner = partners.find(p => p.id === loan.partnerId);
      return {
        ...loan,
        partnerName: partner ? `${partner.firstName} ${partner.lastName}` : "Desconocido",
      }
  }) : [], [loans, partners]);

  const totalAccountsReceivable = useMemo(() => {
    const activeLoans = loans.filter(loan => loan.status !== 'Pagado');
    const today = new Date();

    let totalPrincipalAndInterest = 0;

    activeLoans.forEach(loan => {
      let accruedInterest = 0;
      const principalAmount = loan.amount;
      const startDate = loan.startDate.toDate();
      const monthsPassed = differenceInMonths(today, startDate);

      if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
        const installmentsCount = parseInt(loan.installments, 10);
        const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
        const principalPerInstallment = principalAmount / installmentsCount;
        let outstandingBalance = principalAmount;

        for (let i = 1; i <= installmentsCount; i++) {
          if (i <= monthsPassed + 1) { //+1 to include current month's interest
             accruedInterest += outstandingBalance * monthlyInterestRate;
          }
          outstandingBalance -= principalPerInstallment;
        }
      } else if (loan.loanType === 'personalizado' && loan.hasInterest && loan.customInterest) {
         if (loan.interestType === 'porcentaje') {
          // Simple interest over total for personalized loans. We assume it accrues fully at the start.
          accruedInterest = principalAmount * (parseFloat(loan.customInterest) / 100);
        } else { // 'fijo'
          accruedInterest = parseFloat(loan.customInterest);
        }
      }
      
      totalPrincipalAndInterest += principalAmount + accruedInterest;
    });

    const totalPaid = payments.reduce((acc, payment) => acc + payment.amount, 0);

    return totalPrincipalAndInterest - totalPaid;
  }, [loans, payments]);
  
  const analytics = {
    totalLoans: loans?.length || 0,
    delinquencyRate: 0, // Placeholder
  };

  const loading = loadingLoans || loadingPartners || loadingPayments;

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
              Total Cuentas por Cobrar
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : formatCurrency(Math.round(totalAccountsReceivable))}
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
                  <AvatarFallback>{loan.partnerName?.charAt(0) || 'S'}</AvatarFallback>
                </Avatar>
                <div className="grid gap-1">
                  <p className="text-sm font-medium leading-none">
                    {loan.partnerName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {loan.customerEmail || 'Sin email'}
                  </p>
                </div>
                <div className="ml-auto font-medium">
                  +{formatCurrency(Math.round(loan.amount))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
