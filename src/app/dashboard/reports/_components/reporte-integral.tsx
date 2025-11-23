
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths } from "date-fns";
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
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
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
  "Ene", "Feb", "Mar", "Abr", "May", "Jun", 
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export function ReporteIntegral() {
  const firestore = useFirestore();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [loansCol, loadingLoans] = useCollection(
    firestore ? collection(firestore, "loans") : null
  );

  const yearlyData = useMemo(() => {
    const data: { [key: string]: { capital: number; interest: number } } = months.reduce((acc, month) => {
        acc[month] = { capital: 0, interest: 0 };
        return acc;
    }, {} as { [key: string]: { capital: number; interest: number } });

    if (!loansCol) return data;

    const loans = loansCol.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)) || [];
    
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
        if (dueDate.getFullYear() === selectedYear) {
            let capital = 0;
            let interest = 0;

            if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
                const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
                capital = principalAmount / installmentsCount;
                let outstandingBalance = principalAmount;
                for (let j = 1; j < i; j++) {
                    outstandingBalance -= capital;
                }
                interest = outstandingBalance * monthlyInterestRate;
            } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
                capital = principalAmount / installmentsCount;
                if(loan.hasInterest && loan.customInterest) {
                    const customInterestValue = parseFloat(loan.customInterest);
                    if(loan.interestType === 'porcentaje') {
                        interest = (principalAmount * (customInterestValue / 100)) / installmentsCount;
                    } else { // 'fijo'
                        interest = customInterestValue / installmentsCount;
                    }
                }
            }
            
            const monthName = months[dueDate.getMonth()];
            data[monthName].capital += capital;
            data[monthName].interest += interest;
        }
      }
    });

    return data;
  }, [loansCol, selectedYear]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(18);
    doc.text(`Reporte Integral Mensual - Año ${selectedYear}`, 14, 22);

    const tableColumn = ["Concepto", ...months];
    const tableRows: any[][] = [];

    const capitalRow = ["Capital Recuperado", ...months.map(m => formatCurrency(yearlyData[m].capital))];
    const interestRow = ["Interés Ganado", ...months.map(m => formatCurrency(yearlyData[m].interest))];
    const totalRow = [
        { content: 'Total Mensual', styles: { fontStyle: 'bold' } }, 
        ...months.map(m => ({
            content: formatCurrency(yearlyData[m].capital + yearlyData[m].interest),
            styles: { fontStyle: 'bold' }
        }))
    ];

    tableRows.push(capitalRow, interestRow, totalRow);

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        headStyles: { fillColor: [36, 53, 91] },
        theme: 'grid',
        styles: { halign: 'right' },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold' },
        }
    });

    doc.save(`reporte_integral_${selectedYear}.pdf`);
  };

  const isLoading = loadingLoans;

  return (
    <>
      <div className="flex items-center gap-4">
        <Select
          value={String(selectedYear)}
          onValueChange={(val) => setSelectedYear(Number(val))}
        >
          <SelectTrigger className="w-[180px]">
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
            disabled={isLoading}
        >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar a PDF
        </Button>
      </div>

      {isLoading ? (
        <p>Cargando resumen...</p>
      ) : (
          <Card>
            <CardContent className="pt-6">
                 <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[150px] min-w-[150px]">Concepto</TableHead>
                                {months.map(month => (
                                    <TableHead key={month} className="text-right min-w-[100px]">{month}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium">Capital Recuperado</TableCell>
                                {months.map(month => (
                                    <TableCell key={`capital-${month}`} className="text-right text-blue-800">
                                        {formatCurrency(yearlyData[month].capital)}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Interés Ganado</TableCell>
                                {months.map(month => (
                                    <TableCell key={`interest-${month}`} className="text-right text-orange-800">
                                        {formatCurrency(yearlyData[month].interest)}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow className="bg-muted/50 font-semibold text-foreground hover:bg-muted/60">
                                <TableCell className="font-bold text-base">Total Mensual</TableCell>
                                {months.map(month => (
                                    <TableCell key={`total-${month}`} className="text-right font-bold text-base text-green-800">
                                        {formatCurrency(yearlyData[month].capital + yearlyData[month].interest)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
          </Card>
      )}
    </>
  );
}
