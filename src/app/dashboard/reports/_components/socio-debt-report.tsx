
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, isPast, format } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
  cedula?: string;
};

type Loan = {
  id: string;
  partnerId: string;
  amount: number;
  status: "Aprobado" | "Pendiente" | "Rechazado" | "Pagado";
  loanType: "estandar" | "personalizado";
  interestRate?: string;
  installments?: string;
  startDate: Timestamp;
  hasInterest?: boolean;
  paymentType?: "cuotas" | "libre";
  interestType?: "porcentaje" | "fijo";
  customInterest?: string;
  customInstallments?: string;
};

type Payment = {
    id: string;
    loanId: string;
    installmentNumber: number | null;
    amount: number;
    type: 'payment' | 'closure' | 'abono_libre';
}

type PartnerDebt = {
    partnerId: string;
    partnerName: string;
    totalOverdue: number;
    totalFuture: number;
    totalDebt: number;
}

export function SocioDebtReport() {
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState("");

  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);

  const partners: Partner[] = useMemo(() => partnersCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) || [], [partnersCol]);
  const activeLoans: Loan[] = useMemo(() => loansCol?.docs.filter(doc => doc.data().status === 'Aprobado').map(doc => ({ id: doc.id, ...doc.data() } as Loan)) || [], [loansCol]);
  const allPayments: Payment[] = useMemo(() => paymentsCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)) || [], [paymentsCol]);
  
  const allPartnersDebtData = useMemo(() => {
    const debtMap: { [key: string]: PartnerDebt } = {};

    partners.forEach(p => {
        debtMap[p.id] = {
            partnerId: p.id,
            partnerName: `${p.firstName} ${p.lastName}`,
            totalOverdue: 0,
            totalFuture: 0,
            totalDebt: 0
        }
    });

    activeLoans.forEach(loan => {
      const partnerDebt = debtMap[loan.partnerId];
      if (!partnerDebt) return;

      if (loan.paymentType === 'cuotas') {
        let installmentsCount = 0;
        if (loan.loanType === 'estandar' && loan.installments) {
          installmentsCount = parseInt(loan.installments, 10);
        } else if (loan.loanType === 'personalizado' && loan.customInstallments) {
          installmentsCount = parseInt(loan.customInstallments, 10);
        }

        if (installmentsCount > 0) {
            const principalAmount = loan.amount;
            const startDate = loan.startDate.toDate();

            for (let i = 1; i <= installmentsCount; i++) {
                const isPaid = allPayments.some(p => p.loanId === loan.id && p.installmentNumber === i && p.type === 'payment');
                if (isPaid) continue;

                const dueDate = addMonths(startDate, i);
                let total = 0;

                if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
                    const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
                    const principalPerInstallment = principalAmount / installmentsCount;
                    let outstandingBalance = principalAmount;
                    for (let j = 1; j < i; j++) { outstandingBalance -= principalPerInstallment; }
                    total = Math.round(principalPerInstallment + (outstandingBalance * monthlyInterestRate));
                } else if (loan.loanType === 'personalizado' && loan.customInstallments) {
                    const principalPerInstallment = principalAmount / installmentsCount;
                    let interestPerInstallment = 0;
                    if (loan.hasInterest && loan.customInterest) {
                        const customInterestValue = parseFloat(loan.customInterest);
                        if (loan.interestType === 'porcentaje') {
                            interestPerInstallment = (principalAmount * (customInterestValue / 100)) / installmentsCount;
                        } else {
                            interestPerInstallment = customInterestValue / installmentsCount;
                        }
                    }
                    total = Math.round(principalPerInstallment + interestPerInstallment);
                }

                if (isPast(dueDate)) {
                    partnerDebt.totalOverdue += total;
                } else {
                    partnerDebt.totalFuture += total;
                }
            }
        }
      } else if (loan.paymentType === 'libre') {
        const paidAmount = allPayments
            .filter(p => p.loanId === loan.id && p.type === 'abono_libre')
            .reduce((sum, p) => sum + p.amount, 0);
        const remainingBalance = loan.amount - paidAmount;
        if (remainingBalance > 0) {
            partnerDebt.totalFuture += remainingBalance;
        }
      }
    });
    
    return Object.values(debtMap)
      .map(p => ({ ...p, totalDebt: p.totalOverdue + p.totalFuture }))
      .filter(p => p.totalDebt > 0);

  }, [partners, activeLoans, allPayments]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return allPartnersDebtData;
    return allPartnersDebtData.filter(p =>
      p.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allPartnersDebtData, searchQuery]);
  
  const grandTotals = useMemo(() => {
    return allPartnersDebtData.reduce((acc, p) => {
        acc.overdue += p.totalOverdue;
        acc.future += p.totalFuture;
        acc.total += p.totalDebt;
        return acc;
    }, { overdue: 0, future: 0, total: 0 });
  }, [allPartnersDebtData]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const generationDate = new Date();
    
    doc.setFontSize(18);
    doc.text("Reporte de Deuda Consolidada por Socio", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generado: ${format(generationDate, "dd/MM/yyyy HH:mm:ss", { locale: es })}`, 14, 30);
    
    const tableColumn = ["Socio", "Deuda Vencida", "Deuda Futura", "Deuda Total"];
    const tableRows = filteredData.map(p => [
        p.partnerName,
        formatCurrency(p.totalOverdue),
        formatCurrency(p.totalFuture),
        formatCurrency(p.totalDebt)
    ]);

    const totalRow = [
      { content: 'Totales Generales', colSpan: 1, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(grandTotals.overdue), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(grandTotals.future), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(grandTotals.total), styles: { fontStyle: 'bold', halign: 'right' } },
    ];
    tableRows.push(totalRow as any);

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [36, 53, 91] },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' }
        }
    });
    
    doc.save(`reporte_deuda_por_socio_${format(generationDate, "yyyy-MM-dd")}.pdf`);
  };

  const isLoading = loadingLoans || loadingPartners || loadingPayments;

  if (isLoading) {
    return <p>Calculando reporte...</p>;
  }

  return (
    <Card>
        <CardHeader>
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                     <CardTitle>Reporte de Deuda Consolidada por Socio</CardTitle>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                     <div className="relative w-full sm:w-64">
                         <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                         <Input
                            type="search"
                            placeholder="Buscar socio..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                         />
                     </div>
                     <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredData.length === 0}>
                        <FileDown className="mr-2 h-4 w-4" /> Exportar
                    </Button>
                </div>
             </div>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Socio</TableHead>
                        <TableHead className="text-right text-destructive">Deuda Vencida</TableHead>
                        <TableHead className="text-right text-green-600">Deuda Futura</TableHead>
                        <TableHead className="text-right font-bold">Deuda Total</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.length > 0 ? (
                        filteredData.map(p => (
                            <TableRow key={p.partnerId}>
                                <TableCell className="font-medium">{p.partnerName}</TableCell>
                                <TableCell className="text-right">{formatCurrency(p.totalOverdue)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(p.totalFuture)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(p.totalDebt)}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center">No se encontraron socios con deudas.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                {filteredData.length > 0 && (
                    <TableFooter>
                        <TableRow className="bg-muted/50 font-bold">
                            <TableCell className="text-right">Totales</TableCell>
                            <TableCell className="text-right text-destructive">{formatCurrency(grandTotals.overdue)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(grandTotals.future)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(grandTotals.total)}</TableCell>
                        </TableRow>
                    </TableFooter>
                )}
            </Table>
        </CardContent>
    </Card>
  );
}

