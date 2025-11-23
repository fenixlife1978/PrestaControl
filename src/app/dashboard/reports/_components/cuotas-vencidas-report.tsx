
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, isPast } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
};

type Payment = {
    id: string;
    loanId: string;
    installmentNumber: number;
}

type Installment = {
  loanId: string;
  partnerName: string;
  installmentNumber: number;
  dueDate: Date;
  total: number;
  status: "Vencida";
};

export function CuotasVencidasReport() {
  const firestore = useFirestore();
  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);

  const partners: Partner[] = useMemo(() =>
      partnersCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner)) || [],
    [partnersCol]
  );
  
  const loans: Loan[] = useMemo(() =>
      loansCol?.docs.map((doc) => {
          const data = doc.data();
          const partner = partners.find(p => p.id === data.partnerId);
          return {
            id: doc.id,
            ...data,
            partnerName: partner ? `${partner.firstName} ${partner.lastName}` : "Desconocido",
        } as Loan;
    }) || [],
    [loansCol, partners]
   );

  const payments: Payment[] = useMemo(() =>
      paymentsCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Payment)) || [],
    [paymentsCol]
  );

  const overdueInstallments = useMemo(() => {
    const installments: Installment[] = [];
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
        
        const isPaid = payments.some(p => p.loanId === loan.id && p.installmentNumber === i);
        
        if (!isPaid && isPast(dueDate)) {
            installments.push({
              loanId: loan.id,
              partnerName: loan.partnerName || "Desconocido",
              installmentNumber: i,
              dueDate: dueDate,
              total: principalPerInstallment + interestForMonth,
              status: "Vencida",
            });
        }
      }
    });
    return installments.sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [loans, payments]);

  const totalVencido = useMemo(() => {
    return overdueInstallments.reduce((acc, inst) => acc + inst.total, 0);
  }, [overdueInstallments]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => date.toLocaleDateString("es-ES", { year: 'numeric', month: '2-digit', day: '2-digit'});

  const isLoading = loadingLoans || loadingPartners || loadingPayments;

  return (
    <>
      {isLoading ? (
        <p>Cargando reporte...</p>
      ) : (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Socio</TableHead>
                    <TableHead className="text-center"># Cuota</TableHead>
                    <TableHead>Fecha Vencimiento</TableHead>
                    <TableHead className="text-right">Monto Vencido</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {overdueInstallments.length > 0 ? (
                    overdueInstallments.map((inst) => (
                        <TableRow key={`${inst.loanId}-${inst.installmentNumber}`}>
                            <TableCell className="font-medium">{inst.partnerName}</TableCell>
                            <TableCell className="text-center">{inst.installmentNumber}</TableCell>
                            <TableCell>{formatDate(inst.dueDate)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(inst.total)}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="destructive">{inst.status}</Badge>
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center">
                            No hay cuotas vencidas actualmente.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
             {overdueInstallments.length > 0 && (
                 <TableFooter>
                    <TableRow className="bg-muted/50 font-medium hover:bg-muted/60">
                        <TableCell colSpan={3} className="text-right font-bold text-base">Total Vencido</TableCell>
                        <TableCell className="text-right font-bold text-base text-destructive">{formatCurrency(totalVencido)}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                 </TableFooter>
            )}
        </Table>
      )}
    </>
  );
}
