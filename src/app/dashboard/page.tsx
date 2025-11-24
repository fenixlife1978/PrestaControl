
"use client";

import {
  ArrowUpRight,
  DollarSign,
  Landmark,
  TrendingDown,
  CircleDollarSign,
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
import { differenceInMonths, isPast, format, startOfMonth, subMonths, addMonths } from "date-fns";
import { es } from 'date-fns/locale';


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
  customerEmail?: string;
};

type Payment = {
  id: string;
  loanId: string;
  installmentNumber: number | null;
  amount: number;
  type: 'payment' | 'closure' | 'abono_libre';
  paymentDate: Timestamp;
};

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


  const analytics = useMemo(() => {
    if (loadingLoans || loadingPayments) return { totalLoans: 0, delinquencyRate: 0 };
    
    const activeLoans = loans.filter(l => l.status === 'Aprobado');
    let totalOverduePrincipal = 0;
    let totalOutstandingPrincipal = 0;

    activeLoans.forEach(loan => {
      const totalPaidOnLoan = payments
        .filter(p => p.loanId === loan.id)
        .reduce((sum, p) => sum + p.amount, 0);

      const outstandingBalance = loan.amount - totalPaidOnLoan;
      if (outstandingBalance > 0) {
        totalOutstandingPrincipal += outstandingBalance;
      }
      
      let installmentsCount = 0;
      let principalPerInstallment = 0;

      if (loan.loanType === 'estandar' && loan.installments) {
        installmentsCount = parseInt(loan.installments, 10);
        principalPerInstallment = installmentsCount > 0 ? loan.amount / installmentsCount : 0;
      } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
        installmentsCount = parseInt(loan.customInstallments, 10);
        principalPerInstallment = installmentsCount > 0 ? loan.amount / installmentsCount : 0;
      } else {
        return; 
      }

      const startDate = loan.startDate.toDate();
      for (let i = 1; i <= installmentsCount; i++) {
        const dueDate = addMonths(startDate, i);
        const isPaid = payments.some(p => p.loanId === loan.id && p.installmentNumber === i);

        if (!isPaid && isPast(dueDate)) {
          totalOverduePrincipal += principalPerInstallment;
        }
      }
    });

    const delinquencyRate = totalOutstandingPrincipal > 0 
      ? (totalOverduePrincipal / totalOutstandingPrincipal) * 100 
      : 0;

    return {
      totalLoans: loans.length,
      delinquencyRate: delinquencyRate.toFixed(2), 
    };

  }, [loans, payments, loadingLoans, loadingPayments]);


  const { performanceChartData, interestChartData } = useMemo(() => {
    const pData = [];
    const iData = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = subMonths(today, i);
        const monthName = format(date, 'MMM', { locale: es }).replace('.', '');
        const formattedMonth = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}`;
        
        pData.push({ month: formattedMonth, year: date.getFullYear(), approved: 0, paid: 0 });
        iData.push({ month: formattedMonth, year: date.getFullYear(), interest: 0 });
    }

    loans.forEach(loan => {
        const loanDate = loan.startDate.toDate();
        const monthIndex = pData.findIndex(d => d.year === loanDate.getFullYear() && d.month.toLowerCase() === format(loanDate, 'MMM', { locale: es }));
        if (monthIndex > -1) {
            pData[monthIndex].approved += loan.amount;
        }
    });

    payments.forEach(payment => {
        if(payment.paymentDate) {
            const paymentDate = payment.paymentDate.toDate();
            const monthIndex = pData.findIndex(d => d.year === paymentDate.getFullYear() && d.month.toLowerCase() === format(paymentDate, 'MMM', { locale: es }));
            
            if (monthIndex > -1) {
                pData[monthIndex].paid += payment.amount;

                // Calculate interest for the payment
                if (payment.type === 'payment' && payment.installmentNumber) {
                    const loan = loans.find(l => l.id === payment.loanId);
                    if (loan) {
                        let interestPart = 0;
                        const principalAmount = loan.amount;
                        if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
                            const installmentsCount = parseInt(loan.installments, 10);
                            const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
                            const principalPerInstallment = principalAmount / installmentsCount;
                            let outstandingBalance = principalAmount;
                            for (let i = 1; i < payment.installmentNumber; i++) {
                                outstandingBalance -= principalPerInstallment;
                            }
                            interestPart = outstandingBalance * monthlyInterestRate;
                        } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
                            const installmentsCount = parseInt(loan.customInstallments, 10);
                            if(loan.hasInterest && loan.customInterest) {
                                const customInterestValue = parseFloat(loan.customInterest);
                                if(loan.interestType === 'porcentaje') {
                                    interestPart = (principalAmount * (customInterestValue / 100)) / installmentsCount;
                                } else { // 'fijo'
                                    interestPart = customInterestValue / installmentsCount;
                                }
                            }
                        }
                        iData[monthIndex].interest += Math.round(interestPart > 0 ? interestPart : 0);
                    }
                }
            }
        }
    });

    return { performanceChartData: pData, interestChartData: iData };
  }, [loans, payments]);


  const loading = loadingLoans || loadingPartners || loadingPayments;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };
  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-2">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Préstamos Totales</CardTitle>
            <Landmark className="h-4 w-4 text-primary-foreground/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : analytics.totalLoans}</div>
            <p className="text-xs text-primary-foreground/80">
              +10.2% desde el mes pasado
            </p>
          </CardContent>
        </Card>
        <Card className="bg-accent/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tasa de Morosidad
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-accent-foreground/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `${analytics.delinquencyRate}%`}
            </div>
            <p className="text-xs text-accent-foreground/80">
              -2.5% desde el mes pasado
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2">
        <Card>
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
              <BarChart data={performanceChartData}>
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
            <CardTitle>Intereses Ganados</CardTitle>
            <CardDescription>
              Intereses ganados en los últimos 7 meses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                interest: { label: "Interés", color: "hsl(var(--chart-3))" },
              }}
              className="min-h-[300px]"
            >
              <BarChart data={interestChartData}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={false}
                />
                <Legend />
                <Bar dataKey="interest" fill="var(--color-interest)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
