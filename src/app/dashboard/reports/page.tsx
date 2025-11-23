
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, startOfMonth, endOfMonth } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Loan = {
  id: string;
  partnerId: string;
  partnerName?: string;
  amount: number;
  loanType: "estandar" | "personalizado";
  interestRate?: string;
  installments?: string;
  startDate: Timestamp;
};

const months = [
  { value: 0, label: "Enero" }, { value: 1, label: "Febrero" }, { value: 2, label: "Marzo" },
  { value: 3, label: "Abril" }, { value: 4, label: "Mayo" }, { value: 5, label: "Junio" },
  { value: 6, label: "Julio" }, { value: 7, label: "Agosto" }, { value: 8, label: "Septiembre" },
  { value: 9, label: "Octubre" }, { value: 10, label: "Noviembre" }, { value: 11, label: "Diciembre" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);

  const allInstallments = useMemo(() => {
    const installments: any[] = [];
    const loans = loansCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)) || [];
    
    loans.forEach((loan) => {
      if (loan.loanType !== "estandar" || !loan.installments || !loan.interestRate) return;
      
      const principalAmount = loan.amount;
      const installmentsCount = parseInt(loan.installments, 10);
      const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
      const startDate = loan.startDate.toDate();
      let outstandingBalance = principalAmount;
      const principalPerInstallment = principalAmount / installmentsCount;

      for (let i = 1; i <= installmentsCount; i++) {
        const interestForMonth = outstandingBalance * monthlyInterestRate;
        const dueDate = addMonths(startDate, i);
        outstandingBalance -= principalPerInstallment;

        installments.push({
          dueDate,
          principal: principalPerInstallment,
          interest: interestForMonth,
          total: principalPerInstallment + interestForMonth,
        });
      }
    });
    return installments;
  }, [loansCol]);

  const filteredInstallments = useMemo(() => {
    const filterStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
    const filterEndDate = endOfMonth(new Date(selectedYear, selectedMonth));
    return allInstallments.filter((inst) => {
      return inst.dueDate >= filterStartDate && inst.dueDate <= filterEndDate;
    });
  }, [allInstallments, selectedMonth, selectedYear]);

  const totals = useMemo(() => {
    const totalPrincipal = filteredInstallments.reduce((acc, inst) => acc + inst.principal, 0);
    const totalInterest = filteredInstallments.reduce((acc, inst) => acc + inst.interest, 0);
    const totalDue = filteredInstallments.reduce((acc, inst) => acc + inst.total, 0);
    return {
      principal: totalPrincipal,
      interest: totalInterest,
      total: totalDue,
    };
  }, [filteredInstallments]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const isLoading = loadingLoans || loadingPayments;


  return (
    <Card>
      <CardHeader>
        <CardTitle>Reporte de Cuotas del Período</CardTitle>
        <CardDescription>
          Aquí puede ver el resumen financiero para el período seleccionado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Select
            value={String(selectedMonth)}
            onValueChange={(val) => setSelectedMonth(Number(val))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Seleccione mes" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(Number(val))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Seleccione año" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p>Cargando resumen...</p>
        ) : (
            <Card>
                <CardHeader>
                    <CardTitle>Resumen del Período</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-blue-100/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Total Capital</p>
                        <p className="text-2xl font-bold text-blue-800">{formatCurrency(totals.principal)}</p>
                    </div>
                    <div className="p-4 bg-orange-100/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Total Interés</p>
                        <p className="text-2xl font-bold text-orange-800">{formatCurrency(totals.interest)}</p>
                    </div>
                    <div className="p-4 bg-green-100/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Total Cuotas del Período</p>
                        <p className="text-2xl font-bold text-green-800">{formatCurrency(totals.total)}</p>
                    </div>
                </CardContent>
            </Card>
        )}
      </CardContent>
    </Card>
  );
}
