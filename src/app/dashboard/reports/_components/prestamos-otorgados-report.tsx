
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { startOfMonth, endOfMonth, eachMonthOfInterval, format, parse } from "date-fns";
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


const months = [
  { value: 0, label: "Enero" }, { value: 1, label: "Febrero" }, { value: 2, label: "Marzo" },
  { value: 3, label: "Abril" }, { value: 4, label: "Mayo" }, { value: 5, label: "Junio" },
  { value: 6, label: "Julio" }, { value: 7, label: "Agosto" }, { value: 8, label: "Septiembre" },
  { value: 9, label: "Octubre" }, { value: 10, label: "Noviembre" }, { value: 11, label: "Diciembre" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export function PrestamosOtorgadosReport() {
  const firestore = useFirestore();
  const [startMonth, setStartMonth] = useState(new Date().getMonth());
  const [startYear, setStartYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(new Date().getMonth());
  const [endYear, setEndYear] = useState(currentYear);

  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);

  const partners: Partner[] = useMemo(
    () => partnersCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner)) || [],
    [partnersCol]
  );
  
  const allLoans: Loan[] = useMemo(
      () => loansCol?.docs.map((doc) => {
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

  const loansByMonth = useMemo(() => {
    const startDate = new Date(startYear, startMonth);
    const endDate = new Date(endYear, endMonth);
    
    if (startDate > endDate) return {};

    const monthsInInterval = eachMonthOfInterval({ start: startDate, end: endDate });
    const groupedLoans: { [key: string]: Loan[] } = {};

    monthsInInterval.forEach(monthDate => {
      const monthKey = format(monthDate, "yyyy-MM");
      const filterStartDate = startOfMonth(monthDate);
      const filterEndDate = endOfMonth(monthDate);

      const loansInMonth = allLoans.filter(loan => {
        const loanStartDate = loan.startDate.toDate();
        return loanStartDate >= filterStartDate && loanStartDate <= filterEndDate;
      });

      if (loansInMonth.length > 0) {
        groupedLoans[monthKey] = loansInMonth;
      }
    });

    return groupedLoans;
  }, [allLoans, startMonth, startYear, endMonth, endYear]);

  const totalAmountInPeriod = useMemo(() => {
    return Object.values(loansByMonth).flat().reduce((acc, loan) => acc + loan.amount, 0);
  }, [loansByMonth]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => date.toLocaleDateString("es-ES", { year: 'numeric', month: '2-digit', day: '2-digit'});

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const periodStart = format(new Date(startYear, startMonth), "MMMM yyyy", {locale: es});
    const periodEnd = format(new Date(endYear, endMonth), "MMMM yyyy", {locale: es});
    doc.setFontSize(18);
    doc.text(`Reporte de Préstamos Otorgados`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Período: ${periodStart} a ${periodEnd}`, 14, 30);
    
    let yPos = 40;

    const sortedMonths = Object.keys(loansByMonth).sort();

    for (const monthKey of sortedMonths) {
        const loans = loansByMonth[monthKey];
        const monthDate = parse(monthKey, 'yyyy-MM', new Date());
        const monthName = format(monthDate, "MMMM yyyy", { locale: es });
        const totalMonthAmount = loans.reduce((acc, loan) => acc + loan.amount, 0);

        if (yPos > 40) yPos += 10;
        
        doc.setFontSize(14);
        doc.text(`Mes: ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`, 14, yPos);
        yPos += 8;

        const tableColumn = ["Socio", "Fecha", "Monto", "Tipo", "Detalles"];
        const tableRows: any[][] = [];

        loans.forEach(loan => {
             const details = loan.loanType === 'estandar' 
                ? `${loan.installments} cuotas, ${loan.interestRate}%`
                : `${loan.paymentType}, ${loan.customInstallments || 'N/A'} cuotas`;
            const rowData = [
                loan.partnerName,
                formatDate(loan.startDate.toDate()),
                formatCurrency(loan.amount),
                loan.loanType,
                details
            ];
            tableRows.push(rowData);
        });

        const totalRow = [
          { content: 'Total del Mes', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: formatCurrency(totalMonthAmount), styles: { fontStyle: 'bold', halign: 'right' } },
           '', ''
        ];
        tableRows.push(totalRow);

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: yPos,
            headStyles: { fillColor: [36, 53, 91] },
            didDrawPage: (data) => {
                yPos = data.cursor?.y || 40;
            },
            columnStyles: {
                2: { halign: 'right' },
            }
        });
        yPos = doc.autoTable.previous.finalY;
    }
    
    yPos += 10;
    doc.setFontSize(14);
    doc.text(`Total Otorgado en el Período: ${formatCurrency(totalAmountInPeriod)}`, 14, yPos);


    doc.save(`prestamos_otorgados_${startYear}_${endYear}.pdf`);
  };

  const isLoading = loadingLoans || loadingPartners;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium">Desde:</span>
        <Select value={String(startMonth)} onValueChange={(val) => setStartMonth(Number(val))}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(startYear)} onValueChange={(val) => setStartYear(Number(val))}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
         <span className="text-sm font-medium">Hasta:</span>
        <Select value={String(endMonth)} onValueChange={(val) => setEndMonth(Number(val))}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(endYear)} onValueChange={(val) => setEndYear(Number(val))}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Button 
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={Object.keys(loansByMonth).length === 0}
        >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar a PDF
        </Button>
      </div>

      {isLoading ? (
        <p>Cargando reporte...</p>
      ) : Object.keys(loansByMonth).length === 0 ? (
         <p className="text-center text-muted-foreground pt-8">No hay préstamos otorgados en el período seleccionado.</p>
      ) : (
        <div className="space-y-6">
            {Object.keys(loansByMonth).sort().map(monthKey => {
                 const loans = loansByMonth[monthKey];
                 const monthDate = parse(monthKey, 'yyyy-MM', new Date());
                 const monthName = format(monthDate, "MMMM 'de' yyyy", { locale: es });
                 const totalMonthAmount = loans.reduce((acc, loan) => acc + loan.amount, 0);

                return (
                    <Card key={monthKey}>
                        <CardHeader>
                            <CardTitle className="text-lg capitalize">{monthName}</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Socio</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Detalles</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loans.map(loan => (
                                        <TableRow key={loan.id}>
                                            <TableCell className="font-medium">{loan.partnerName}</TableCell>
                                            <TableCell>{formatDate(loan.startDate.toDate())}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(loan.amount)}</TableCell>
                                            <TableCell className="capitalize">{loan.loanType}</TableCell>
                                            <TableCell>
                                                {loan.loanType === 'estandar' 
                                                    ? `${loan.installments} cuotas, ${loan.interestRate}% interés`
                                                    : `Pago ${loan.paymentType}, ${loan.customInstallments || 'N/A'} cuotas`
                                                }
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-right font-bold">Total del Mes</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(totalMonthAmount)}</TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </CardContent>
                    </Card>>
                )
            })}
             <Card className="bg-primary text-primary-foreground">
                <CardHeader>
                    <CardTitle className="text-xl">Total Otorgado en el Período</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-bold">{formatCurrency(totalAmountInPeriod)}</p>
                </CardContent>
            </Card>
        </div>
      )}
    </>
  );
}
