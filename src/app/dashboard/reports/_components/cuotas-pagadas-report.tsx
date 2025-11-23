
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

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
  hasInterest?: boolean;
  paymentType?: 'cuotas' | 'libre';
  interestType?: 'porcentaje' | 'fijo';
  customInterest?: string;
  customInstallments?: string;
};

type Payment = {
  id: string;
  loanId: string;
  partnerId: string;
  partnerName?: string;
  installmentNumber: number | null; // Null for free payments
  amount: number;
  paymentDate: Timestamp;
  type: 'payment' | 'abono_libre';
};

type PaidInstallmentDetails = {
    payment: Payment;
    capital: number;
    interest: number;
    originalDueDate: Date | null; // Null for free payments
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
      paymentsCol?.docs
        .filter(doc => (doc.data().type === 'payment' || doc.data().type === 'abono_libre') && doc.data().paymentDate)
        .map((doc) => {
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
        
        // Handle 'abono_libre' payments
        if(payment.type === 'abono_libre') {
            detailedPayments.push({
                payment: payment,
                capital: 0, // Not applicable
                interest: 0, // Not applicable
                originalDueDate: null
            });
            return;
        }

        if (!loan || !payment.installmentNumber) {
            detailedPayments.push({ payment, capital: payment.amount, interest: 0, originalDueDate: new Date() });
            return;
        }

        const principalAmount = loan.amount;
        const startDate = loan.startDate.toDate();
        let capitalPart = 0;
        let interestPart = 0;

        if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
            const installmentsCount = parseInt(loan.installments, 10);
            const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
            const principalPerInstallment = principalAmount / installmentsCount;
            
            let outstandingBalance = principalAmount;
            for (let i = 1; i < payment.installmentNumber; i++) {
                outstandingBalance -= principalPerInstallment;
            }
            
            interestPart = outstandingBalance * monthlyInterestRate;
            capitalPart = payment.amount - interestPart;
        } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
            const installmentsCount = parseInt(loan.customInstallments, 10);
            capitalPart = principalAmount / installmentsCount;
            if(loan.hasInterest && loan.customInterest) {
                const customInterestValue = parseFloat(loan.customInterest);
                 if(loan.interestType === 'porcentaje') {
                    interestPart = (principalAmount * (customInterestValue / 100)) / installmentsCount;
                } else { // 'fijo'
                    interestPart = customInterestValue / installmentsCount;
                }
            }
        } else {
             capitalPart = payment.amount;
        }
        
        detailedPayments.push({
            payment: payment,
            capital: capitalPart > 0 ? capitalPart : payment.amount, 
            interest: interestPart > 0 ? interestPart : 0,
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
  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return date.toLocaleString("es-ES", { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";

    doc.setFontSize(18);
    doc.text(`Reporte de Pagos Recibidos - ${monthName} ${selectedYear}`, 14, 22);

    const tableColumn = ["Socio", "Fecha Venc.", "Fecha de Pago", "# Cuota", "Capital", "Interés", "Total Pagado"];
    const tableRows: any[][] = [];

    filteredPaymentsDetails
        .sort((a,b) => b.payment.paymentDate.toMillis() - a.payment.paymentDate.toMillis())
        .forEach(detail => {
        const rowData = [
            detail.payment.partnerName,
            formatDate(detail.originalDueDate),
            formatDate(detail.payment.paymentDate.toDate()),
            detail.payment.installmentNumber || 'Abono',
            detail.payment.type === 'payment' ? formatCurrency(detail.capital) : '-',
            detail.payment.type === 'payment' ? formatCurrency(detail.interest) : '-',
            formatCurrency(detail.payment.amount),
        ];
        tableRows.push(rowData);
    });

    const totalRow = [
      { content: 'Totales', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(totals.capital), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(totals.interest), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(totals.pagado), styles: { fontStyle: 'bold', halign: 'right' } },
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
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
        }
    });

    doc.save(`pagos_recibidos_${monthName.toLowerCase()}_${selectedYear}.pdf`);
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
            disabled={filteredPaymentsDetails.length === 0}
        >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar a PDF
        </Button>
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
                                <TableCell className="text-center">{detail.payment.installmentNumber || 'Abono'}</TableCell>
                                <TableCell className="text-right">{detail.payment.type === 'payment' ? formatCurrency(detail.capital) : '-'}</TableCell>
                                <TableCell className="text-right">{detail.payment.type === 'payment' ? formatCurrency(detail.interest) : '-'}</TableCell>
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
                {filteredPaymentsDetails.length > 0 && (
                  <TableFooter>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={4} className="text-right">Totales</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.capital)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.interest)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.pagado)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
            </Table>
        </>
      )}
    </>
  );
}
