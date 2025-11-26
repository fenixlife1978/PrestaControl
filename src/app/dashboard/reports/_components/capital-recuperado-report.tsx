

"use client";

import { useState, useMemo } from "react";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";
import { collection, Timestamp, doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { startOfMonth, endOfMonth, eachMonthOfInterval, format, parse, addMonths } from "date-fns";
import { es } from "date-fns/locale";
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
  paymentType?: "cuotas" | "libre";
  interestType?: "porcentaje" | "fijo";
  customInterest?: string;
  customInstallments?: string;
};

type Payment = {
  id: string;
  loanId: string;
  partnerId: string;
  partnerName?: string;
  installmentNumber: number | null;
  amount: number;
  paymentDate: Timestamp;
  type: "payment" | "abono_libre";
};

type PaidInstallmentDetails = {
    payment: Payment;
    capital: number;
    interest: number;
    originalDueDate: Date | null;
};

type CompanySettings = {
    name?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    rif?: string;
    email?: string;
}

const months = [
  { value: 0, label: "Enero" }, { value: 1, label: "Febrero" }, { value: 2, label: "Marzo" },
  { value: 3, label: "Abril" }, { value: 4, label: "Mayo" }, { value: 5, label: "Junio" },
  { value: 6, label: "Julio" }, { value: 7, label: "Agosto" }, { value: 8, label: "Septiembre" },
  { value: 9, label: "Octubre" }, { value: 10, label: "Noviembre" }, { value: 11, label: "Diciembre" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export function CapitalRecuperadoReport() {
  const firestore = useFirestore();
  const [startMonth, setStartMonth] = useState(new Date().getMonth());
  const [startYear, setStartYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(new Date().getMonth());
  const [endYear, setEndYear] = useState(currentYear);

  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);
  const settingsRef = firestore ? doc(firestore, 'company_settings', 'main') : null;
  const [settingsDoc, loadingSettings] = useDocument(settingsRef);


  const partners: Partner[] = useMemo(() => partnersCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner)) || [], [partnersCol]);
  const loans: Loan[] = useMemo(() => loansCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Loan)) || [], [loansCol]);

  const allPayments: Payment[] = useMemo(() =>
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
  
  const companySettings: CompanySettings | null = useMemo(() => {
    return settingsDoc?.exists() ? settingsDoc.data() as CompanySettings : null
  }, [settingsDoc]);

  const paymentsByMonth = useMemo(() => {
    const startDate = new Date(startYear, startMonth);
    const endDate = new Date(endYear, endMonth);
    if (startDate > endDate) return {};

    const monthsInInterval = eachMonthOfInterval({ start: startDate, end: endDate });
    const groupedPayments: { [key: string]: PaidInstallmentDetails[] } = {};

    monthsInInterval.forEach(monthDate => {
      const monthKey = format(monthDate, "yyyy-MM");
      const filterStartDate = startOfMonth(monthDate);
      const filterEndDate = endOfMonth(monthDate);

      const paymentsInMonth = allPayments.filter(p => {
        const paymentDate = p.paymentDate.toDate();
        return paymentDate >= filterStartDate && paymentDate <= filterEndDate;
      });

      if (paymentsInMonth.length > 0) {
        const detailedPayments: PaidInstallmentDetails[] = [];
        paymentsInMonth.forEach(payment => {
            const loan = loans.find(l => l.id === payment.loanId);
            if(payment.type === 'abono_libre') {
                detailedPayments.push({ payment, capital: payment.amount, interest: 0, originalDueDate: null });
                return;
            }
            if (!loan || !payment.installmentNumber) {
                detailedPayments.push({ payment, capital: payment.amount, interest: 0, originalDueDate: new Date() });
                return;
            }
            const principalAmount = loan.amount;
            const loanStartDate = loan.startDate.toDate();
            let capitalPart = 0;
            let interestPart = 0;

            if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
                const installmentsCount = parseInt(loan.installments, 10);
                if (installmentsCount <= 0) { capitalPart = payment.amount; }
                else {
                    const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
                    const principalPerInstallment = principalAmount / installmentsCount;
                    let outstandingBalance = principalAmount;
                    for (let i = 1; i < payment.installmentNumber; i++) {
                        outstandingBalance -= principalPerInstallment;
                    }
                    interestPart = outstandingBalance * monthlyInterestRate;
                    // El capital es la diferencia, para cuadrar con el total pagado
                    capitalPart = payment.amount - Math.round(interestPart);
                }
            } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
                const installmentsCount = parseInt(loan.customInstallments, 10);
                if (installmentsCount <= 0) { capitalPart = payment.amount; }
                else {
                    capitalPart = principalAmount / installmentsCount;
                    if(loan.hasInterest && loan.customInterest) {
                        const customInterestValue = parseFloat(loan.customInterest);
                        if(loan.interestType === 'porcentaje') {
                            interestPart = (principalAmount * (customInterestValue / 100)) / installmentsCount;
                        } else { interestPart = customInterestValue / installmentsCount; }
                    }
                }
            } else { capitalPart = payment.amount; }
            detailedPayments.push({
                payment: payment,
                capital: capitalPart > 0 ? Math.round(capitalPart) : Math.round(payment.amount), 
                interest: interestPart > 0 ? Math.round(interestPart) : 0,
                originalDueDate: addMonths(loanStartDate, payment.installmentNumber)
            });
        });
        groupedPayments[monthKey] = detailedPayments;
      }
    });

    return groupedPayments;
  }, [allPayments, loans, startMonth, startYear, endMonth, endYear]);

  const totalPeriod = useMemo(() => {
    return Object.values(paymentsByMonth).flat().reduce((acc, detail) => {
        acc.capital += detail.capital;
        acc.interest += detail.interest;
        acc.total += detail.payment.amount;
        return acc;
    }, { capital: 0, interest: 0, total: 0 });
  }, [paymentsByMonth]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return date.toLocaleString("es-ES", { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const periodStart = format(new Date(startYear, startMonth), "MMMM yyyy", { locale: es });
    const periodEnd = format(new Date(endYear, endMonth), "MMMM yyyy", { locale: es });
    
    // Header
    if (companySettings?.logoUrl) {
        doc.addImage(companySettings.logoUrl, 'PNG', 14, 15, 30, 15);
    }
    doc.setFontSize(10);
    const companyInfoX = doc.internal.pageSize.getWidth() - 14;
    doc.text(companySettings?.name || '', companyInfoX, 15, { align: 'right'});
    doc.setFontSize(8);
    doc.text(companySettings?.rif || '', companyInfoX, 19, { align: 'right'});
    doc.text(companySettings?.address || '', companyInfoX, 23, { align: 'right'});
    doc.text(companySettings?.phone || '', companyInfoX, 27, { align: 'right'});
    doc.text(companySettings?.email || '', companyInfoX, 31, { align: 'right'});

    // Title
    doc.setFontSize(18);
    doc.text(`Reporte de Capital Recuperado e Intereses Ganados`, 14, 45);
    doc.setFontSize(12);
    doc.text(`Período: ${periodStart} a ${periodEnd}`, 14, 53);
    
    let yPos = 65;
    const sortedMonths = Object.keys(paymentsByMonth).sort();

    for (const monthKey of sortedMonths) {
      const details = paymentsByMonth[monthKey];
      const monthDate = parse(monthKey, "yyyy-MM", new Date());
      const monthName = format(monthDate, "MMMM yyyy", { locale: es });
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      const totalsMonth = details.reduce((acc, d) => {
        acc.capital += d.capital;
        acc.interest += d.interest;
        acc.total += d.payment.amount;
        return acc;
      }, { capital: 0, interest: 0, total: 0 });

      const tableColumn = ["Socio", "Fecha Venc.", "Fecha de Pago", "# Cuota", "Capital", "Interés", "Total Pagado"];
      const tableRows: any[][] = [];

      details.sort((a,b) => a.payment.paymentDate.toMillis() - b.payment.paymentDate.toMillis()).forEach(detail => {
        tableRows.push([
            detail.payment.partnerName,
            formatDate(detail.originalDueDate),
            formatDate(detail.payment.paymentDate.toDate()),
            detail.payment.installmentNumber || 'Abono',
            formatCurrency(detail.capital),
            detail.payment.type === 'payment' ? formatCurrency(detail.interest) : '-',
            formatCurrency(detail.payment.amount),
        ]);
      });
      tableRows.push([
          { content: 'Total del Mes', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: formatCurrency(totalsMonth.capital), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: formatCurrency(totalsMonth.interest), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: formatCurrency(totalsMonth.total), styles: { fontStyle: 'bold', halign: 'right' } },
      ]);
      
      const tableHeight = (tableRows.length + 2) * 10;
      if (yPos + tableHeight > doc.internal.pageSize.height - 20) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.text(capitalizedMonth, 14, yPos);
      yPos += 8;

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [36, 53, 91], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 
            0: { cellWidth: 40 },
            4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } 
        },
      });
      yPos = (doc as any).autoTable.previous.finalY + 15;
    }

    if (yPos > doc.internal.pageSize.height - 30) {
        doc.addPage();
        yPos = 20;
    }
    doc.setFontSize(14);
    doc.text(`Total General del Período`, 14, yPos);
    yPos += 8;
    doc.autoTable({
        body: [
            ['Capital Total Recuperado:', formatCurrency(totalPeriod.capital)],
            ['Intereses Totales Ganados:', formatCurrency(totalPeriod.interest)],
            [{ content: 'Monto Total Recibido:', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalPeriod.total), styles: { fontStyle: 'bold' } }],
        ],
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 11 },
        columnStyles: { 1: { halign: 'right' } },
    });

    doc.save(`capital_recuperado_${startYear}_${endYear}.pdf`);
  };

  const isLoading = loadingLoans || loadingPartners || loadingPayments || loadingSettings;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium">Desde:</span>
        <Select value={String(startMonth)} onValueChange={(val) => setStartMonth(Number(val))}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{months.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent></Select>
        <Select value={String(startYear)} onValueChange={(val) => setStartYear(Number(val))}><SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
        <span className="text-sm font-medium">Hasta:</span>
        <Select value={String(endMonth)} onValueChange={(val) => setEndMonth(Number(val))}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{months.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent></Select>
        <Select value={String(endYear)} onValueChange={(val) => setEndYear(Number(val))}><SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={Object.keys(paymentsByMonth).length === 0}><FileDown className="mr-2 h-4 w-4" />Exportar a PDF</Button>
      </div>
      <div>
      {isLoading ? ( <p>Cargando reporte...</p> ) : Object.keys(paymentsByMonth).length === 0 ? (
         <p className="text-center text-muted-foreground pt-8">No hay pagos recibidos en el período seleccionado.</p>
      ) : (
        <div className="space-y-6">
            {Object.keys(paymentsByMonth).sort().map(monthKey => {
                 const details = paymentsByMonth[monthKey];
                 const monthDate = parse(monthKey, 'yyyy-MM', new Date());
                 const monthName = format(monthDate, "MMMM 'de' yyyy", { locale: es });
                 const totalsMonth = details.reduce((acc, d) => {
                    acc.capital += d.capital;
                    acc.interest += d.interest;
                    acc.total += d.payment.amount;
                    return acc;
                 }, { capital: 0, interest: 0, total: 0 });

                return (
                    <Card key={monthKey}>
                        <CardHeader><CardTitle className="text-lg capitalize">{monthName}</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Socio</TableHead><TableHead>Fecha Pago</TableHead><TableHead className="text-center"># Cuota</TableHead><TableHead className="text-right">Capital</TableHead><TableHead className="text-right">Interés</TableHead><TableHead className="text-right">Total Pagado</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {details.sort((a,b) => a.payment.paymentDate.toMillis() - b.payment.paymentDate.toMillis()).map(detail => (
                                        <TableRow key={detail.payment.id}>
                                            <TableCell className="font-medium">{detail.payment.partnerName}</TableCell>
                                            <TableCell>{formatDate(detail.payment.paymentDate.toDate())}</TableCell>
                                            <TableCell className="text-center">{detail.payment.installmentNumber || 'Abono'}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(detail.capital)}</TableCell>
                                            <TableCell className="text-right">{detail.payment.type === 'payment' ? formatCurrency(detail.interest) : '-'}</TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(detail.payment.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow className="font-bold">
                                        <TableCell colSpan={3} className="text-right">Total del Mes</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totalsMonth.capital)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totalsMonth.interest)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totalsMonth.total)}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </CardContent>
                    </Card>
                )
            })}
             <Card className="bg-primary text-primary-foreground">
                <CardHeader><CardTitle className="text-xl">Totales Generales del Período</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-sm font-medium opacity-80">Capital Total Recuperado</p>
                        <p className="text-2xl font-bold">{formatCurrency(totalPeriod.capital)}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium opacity-80">Intereses Totales Ganados</p>
                        <p className="text-2xl font-bold">{formatCurrency(totalPeriod.interest)}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium opacity-80">Monto Total Recibido</p>
                        <p className="text-2xl font-bold">{formatCurrency(totalPeriod.total)}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}
      </div>
    </>
  );
}
