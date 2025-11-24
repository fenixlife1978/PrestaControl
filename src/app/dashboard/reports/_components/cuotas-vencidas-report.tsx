
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, startOfMonth, endOfMonth } from "date-fns";
import jsPDF from "jspdf";
import "jspdf-autotable";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type Loan = {
  id: string;
  partnerId: string;
  partnerName?: string;
  amount: number;
  loanType: "estandar" | "personalizado";
  interestRate?: string;
  installments?: string;
  startDate: Timestamp;
  hasInterest?: boolean;
  paymentType?: 'cuotas' | 'libre';
  interestType?: 'porcentaje' | 'fijo';
  customInterest?: string;
  customInstallments?: string;
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
  status: "No Pagada";
};

const months = [
  { value: 0, label: "Enero" }, { value: 1, label: "Febrero" }, { value: 2, label: "Marzo" },
  { value: 3, label: "Abril" }, { value: 4, label: "Mayo" }, { value: 5, label: "Junio" },
  { value: 6, label: "Julio" }, { value: 7, label: "Agosto" }, { value: 8, label: "Septiembre" },
  { value: 9, label: "Octubre" }, { value: 10, label: "Noviembre" }, { value: 11, label: "Diciembre" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export function CuotasVencidasReport() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
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
      paymentsCol?.docs.filter(doc => doc.data().type === 'payment').map((doc) => ({ id: doc.id, ...doc.data() } as Payment)) || [],
    [paymentsCol]
  );

  const unpaidInstallments = useMemo(() => {
    const installments: Installment[] = [];
    const filterStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
    const filterEndDate = endOfMonth(new Date(selectedYear, selectedMonth));

    loans.forEach((loan) => {
      let installmentsCount = 0;
      if (loan.loanType === 'estandar' && loan.installments) {
        installmentsCount = parseInt(loan.installments, 10);
      } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
        installmentsCount = parseInt(loan.customInstallments, 10);
      } else {
        return;
      }

      const principalAmount = loan.amount;
      const startDate = loan.startDate.toDate();

      for (let i = 1; i <= installmentsCount; i++) {
        const dueDate = addMonths(startDate, i);
        const isPaid = payments.some(p => p.loanId === loan.id && p.installmentNumber === i);
        
        if (!isPaid && dueDate >= filterStartDate && dueDate <= filterEndDate) {
            let total = 0;
            if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
                const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
                const principalPerInstallment = principalAmount / installmentsCount;
                let outstandingBalance = principalAmount;
                for (let j = 1; j < i; j++) {
                    outstandingBalance -= principalPerInstallment;
                }
                const interestForMonth = outstandingBalance * monthlyInterestRate;
                const roundedPrincipal = Math.round(principalPerInstallment);
                const roundedInterest = Math.round(interestForMonth);
                total = roundedPrincipal + roundedInterest;
            } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
                 const installmentsCount = parseInt(loan.customInstallments, 10);
                 const principalPerInstallment = principalAmount / installmentsCount;
                 let interestPerInstallment = 0;
                if(loan.hasInterest && loan.customInterest) {
                    const customInterestValue = parseFloat(loan.customInterest);
                    if(loan.interestType === 'porcentaje') {
                        interestPerInstallment = (principalAmount * (customInterestValue / 100)) / installmentsCount;
                    } else { // 'fijo'
                        interestPerInstallment = customInterestValue / installmentsCount;
                    }
                }
                const roundedPrincipal = Math.round(principalPerInstallment);
                const roundedInterest = Math.round(interestPerInstallment);
                total = roundedPrincipal + roundedInterest;
            }
            
            installments.push({
              loanId: loan.id,
              partnerName: loan.partnerName || "Desconocido",
              installmentNumber: i,
              dueDate: dueDate,
              total: total,
              status: "No Pagada",
            });
        }
      }
    });
    return installments.sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [loans, payments, selectedMonth, selectedYear]);

  const totalNoPagado = useMemo(() => {
    return unpaidInstallments.reduce((acc, inst) => acc + inst.total, 0);
  }, [unpaidInstallments]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => date.toLocaleDateString("es-ES", { year: 'numeric', month: '2-digit', day: '2-digit'});

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";

    doc.setFontSize(18);
    doc.text(`Reporte de Cuotas no Pagadas - ${monthName} ${selectedYear}`, 14, 22);

    const tableColumn = ["Socio", "# Cuota", "Fecha Vencimiento", "Monto Pendiente", "Estado"];
    const tableRows: any[][] = [];

    unpaidInstallments.forEach(inst => {
        const rowData = [
            inst.partnerName,
            inst.installmentNumber,
            formatDate(inst.dueDate),
            formatCurrency(inst.total),
            inst.status
        ];
        tableRows.push(rowData);
    });

    const totalRow = [
      { content: 'Total No Pagado', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(totalNoPagado), styles: { fontStyle: 'bold', halign: 'right' } },
      ''
    ];
    tableRows.push(totalRow);

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        headStyles: { fillColor: [36, 53, 91] },
        styles: { halign: 'center' },
        columnStyles: {
            0: { halign: 'left' },
            3: { halign: 'right' },
        }
    });
    
    doc.save(`cuotas_no_pagadas_${monthName.toLowerCase()}_${selectedYear}.pdf`);
  };

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
         <Button 
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={unpaidInstallments.length === 0}
        >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar a PDF
        </Button>
      </div>

      {isLoading ? (
        <p>Cargando reporte...</p>
      ) : (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Socio</TableHead>
                    <TableHead className="text-center"># Cuota</TableHead>
                    <TableHead>Fecha Vencimiento</TableHead>
                    <TableHead className="text-right">Monto Pendiente</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {unpaidInstallments.length > 0 ? (
                    unpaidInstallments.map((inst) => (
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
                            No hay cuotas no pagadas para este período.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
             {unpaidInstallments.length > 0 && (
                 <TableFooter>
                    <TableRow className="bg-muted/50 font-medium hover:bg-muted/60">
                        <TableCell colSpan={3} className="text-right font-bold text-base">Total No Pagado</TableCell>
                        <TableCell className="text-right font-bold text-base text-destructive">{formatCurrency(totalNoPagado)}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                 </TableFooter>
            )}
        </Table>
      )}
    </>
  );
}
