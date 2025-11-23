
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
};

type Loan = {
  id: string;
  partnerId: string;
  amount: number;
  loanType: "estandar" | "personalizado";
  interestRate?: string;
  installments?: string;
  startDate: Timestamp;
};

type Payment = {
  id: string;
  loanId: string;
  partnerId: string;
  partnerName?: string;
  installmentNumber: number;
  amount: number;
  paymentDate: Timestamp;
};

type PaidInstallmentDetails = {
    payment: Payment;
    capital: number;
    interest: number;
    originalDueDate: Date;
};

const months = [
  { value: 0, label: "Enero" }, { value: 1, label: "Febrero" }, { value: 2, label: "Marzo" },
  { value: 3, label: "Abril" }, { value: 4, label: "Mayo" }, { value: 5, label: "Junio" },
  { value: 6, label: "Julio" }, { value: 7, label: "Agosto" }, { value: 8, label: "Septiembre" },
  { value: 9, label: "Octubre" }, { value: 10, label: "Noviembre" }, { value: 11, label: "Diciembre" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export function CuotasPagadasReport() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);

  const partners: Partner[] = useMemo(
    () => partnersCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner)) || [],
    [partnersCol]
  );
  
  const loans: Loan[] = useMemo(
      () => loansCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Loan)) || [],
      [loansCol]
  );

  const allPayments: Payment[] = useMemo(
    () =>
      paymentsCol?.docs.map((doc) => {
        const data = doc.data();
        const partner = partners.find((p) => p.id === data.partnerId);
        return {
          id: doc.id,
          ...data,
          partnerName: partner ? `${partner.firstName} ${partner.lastName}` : "Desconocido",
        } as Payment;
      }) || [],
    [paymentsCol, partners]
  );
  
  const filteredPaymentsDetails = useMemo(() => {
    const filterStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
    const filterEndDate = endOfMonth(new Date(selectedYear, selectedMonth));
    
    const paymentsInPeriod = allPayments.filter((p) => {
        const paymentDate = p.paymentDate.toDate();
        return paymentDate >= filterStartDate && paymentDate <= filterEndDate;
    });

    const detailedPayments: PaidInstallmentDetails[] = [];

    paymentsInPeriod.forEach(payment => {
        const loan = loans.find(l => l.id === payment.loanId);
        if (!loan || loan.loanType !== 'estandar' || !loan.installments || !loan.interestRate) {
            detailedPayments.push({ payment, capital: 0, interest: 0, originalDueDate: new Date() });
            return;
        }

        const principalAmount = loan.amount;
        const installmentsCount = parseInt(loan.installments, 10);
        const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
        const principalPerInstallment = principalAmount / installmentsCount;
        const startDate = loan.startDate.toDate();
        
        let outstandingBalance = principalAmount;
        for (let i = 1; i < payment.installmentNumber; i++) {
            outstandingBalance -= principalPerInstallment;
        }
        
        const interestForMonth = outstandingBalance * monthlyInterestRate;
        const capitalPart = payment.amount - interestForMonth;

        detailedPayments.push({
            payment: payment,
            capital: capitalPart > 0 ? capitalPart : payment.amount, 
            interest: interestForMonth > 0 ? interestForMonth : 0,
            originalDueDate: addMonths(startDate, payment.installmentNumber)
        });
    });

    return detailedPayments;
  }, [allPayments, loans, selectedMonth, selectedYear]);

  const totals = useMemo(() => {
    return filteredPaymentsDetails.reduce((acc, detail) => {
        acc.capital += detail.capital;
        acc.interest += detail.interest;
        acc.pagado += detail.payment.amount;
        return acc;
    }, { capital: 0, interest: 0, pagado: 0 });
  }, [filteredPaymentsDetails]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => date.toLocaleString("es-ES", { year: 'numeric', month: '2-digit', day: '2-digit' });

  const isLoading = loadingLoans || loadingPartners || loadingPayments;

  return (
    <>
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
        <p>Cargando reporte...</p>
      ) : (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Socio</TableHead>
                        <TableHead>Fecha Venc.</TableHead>
                        <TableHead>Fecha de Pago</TableHead>
                        <TableHead className="text-center"># Cuota</TableHead>
                        <TableHead className="text-right">Capital</TableHead>
                        <TableHead className="text-right">Interés</TableHead>
                        <TableHead className="text-right">Total Pagado</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredPaymentsDetails.length > 0 ? (
                        filteredPaymentsDetails
                            .sort((a,b) => b.payment.paymentDate.toMillis() - a.payment.paymentDate.toMillis())
                            .map((detail) => (
                            <TableRow key={detail.payment.id}>
                                <TableCell className="font-medium">{detail.payment.partnerName}</TableCell>
                                <TableCell>{formatDate(detail.originalDueDate)}</TableCell>
                                <TableCell>{formatDate(detail.payment.paymentDate.toDate())}</TableCell>
                                <TableCell className="text-center">{detail.payment.installmentNumber}</TableCell>
                                <TableCell className="text-right">{formatCurrency(detail.capital)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(detail.interest)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(detail.payment.amount)}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center">
                                No hay pagos registrados para este período.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            {filteredPaymentsDetails.length > 0 && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="text-lg">Resumen del Período</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Capital Recuperado</p>
                            <p className="text-2xl font-bold" style={{color: "hsl(var(--primary))"}}>{formatCurrency(totals.capital)}</p>
                        </div>
                         <div>
                            <p className="text-sm text-muted-foreground">Total Interés Ganado</p>
                            <p className="text-2xl font-bold" style={{color: "hsl(var(--accent))"}}>{formatCurrency(totals.interest)}</p>
                        </div>
                         <div>
                            <p className="text-sm text-muted-foreground">Total Pagado</p>
                            <p className="text-2xl font-bold text-green-700">{formatCurrency(totals.pagado)}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
      )}
    </>
  );
}
