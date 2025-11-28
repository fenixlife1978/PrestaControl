
"use client";

import { useState, useMemo } from "react";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";
import { collection, Timestamp, doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, format } from "date-fns";
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
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileDown, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

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
    installmentNumber: number;
}

type Installment = {
  loanId: string;
  partnerName: string;
  installmentNumber: number;
  dueDate: Date;
  total: number;
  isOverdue: boolean;
};

type OverdueLoanDetail = {
    partnerName: string;
    loanId: string;
    totalOverdueAmount: number;
    overdueInstallmentsCount: number;
}

type CompanySettings = {
    name?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    rif?: string;
    email?: string;
}

export function CarteraTotalReport() {
  const firestore = useFirestore();
  const [cutoffDate, setCutoffDate] = useState<Date>(new Date());

  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);
  const settingsRef = firestore ? doc(firestore, 'company_settings', 'main') : null;
  const [settingsDoc, loadingSettings] = useDocument(settingsRef);

  const partners: Partner[] = useMemo(() =>
      partnersCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner)) || [],
    [partnersCol]
  );
  
  const activeLoans: Loan[] = useMemo(() =>
      loansCol?.docs
      .filter(doc => doc.data().status === 'Aprobado')
      .map((doc) => {
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
  
  const companySettings: CompanySettings | null = useMemo(() => {
    return settingsDoc?.exists() ? settingsDoc.data() as CompanySettings : null
  }, [settingsDoc]);

  const allPendingInstallments = useMemo(() => {
    const installments: Installment[] = [];
    
    activeLoans.forEach((loan) => {
      let installmentsCount = 0;
      if (loan.loanType === 'estandar' && loan.installments) {
        installmentsCount = parseInt(loan.installments, 10);
      } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
        installmentsCount = parseInt(loan.customInstallments, 10);
      }
      
      if(installmentsCount <= 0) return;

      const principalAmount = loan.amount;
      const startDate = loan.startDate.toDate();

      for (let i = 1; i <= installmentsCount; i++) {
        const isPaid = payments.some(p => p.loanId === loan.id && p.installmentNumber === i);
        if (isPaid) continue;

        const dueDate = addMonths(startDate, i);
        let total = 0;

        if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
            const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
            const principalPerInstallment = principalAmount / installmentsCount;
            let outstandingBalance = principalAmount;
            for (let j = 1; j < i; j++) {
                outstandingBalance -= principalPerInstallment;
            }
            const interestForMonth = outstandingBalance * monthlyInterestRate;
            total = Math.round(principalPerInstallment) + Math.round(interestForMonth);
        } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
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
            total = Math.round(principalPerInstallment) + Math.round(interestPerInstallment);
        }
        
        installments.push({
          loanId: loan.id,
          partnerName: loan.partnerName || "Desconocido",
          installmentNumber: i,
          dueDate: dueDate,
          total: total,
          isOverdue: dueDate <= cutoffDate
        });
      }
    });
    return installments;
  }, [activeLoans, payments, cutoffDate]);
  
  const reportData = useMemo(() => {
    const overduePortfolio = allPendingInstallments
        .filter(inst => inst.isOverdue)
        .reduce((sum, inst) => sum + inst.total, 0);

    const futurePortfolio = allPendingInstallments
        .filter(inst => !inst.isOverdue)
        .reduce((sum, inst) => sum + inst.total, 0);

    const totalPortfolio = overduePortfolio + futurePortfolio;

    const overdueDetails = allPendingInstallments
        .filter(inst => inst.isOverdue)
        .reduce((acc, inst) => {
            if (!acc[inst.loanId]) {
                acc[inst.loanId] = {
                    partnerName: inst.partnerName,
                    loanId: inst.loanId,
                    totalOverdueAmount: 0,
                    overdueInstallmentsCount: 0
                };
            }
            acc[inst.loanId].totalOverdueAmount += inst.total;
            acc[inst.loanId].overdueInstallmentsCount++;
            return acc;
        }, {} as {[key: string]: OverdueLoanDetail});
        
    return {
        overduePortfolio,
        futurePortfolio,
        totalPortfolio,
        overdueDetails: Object.values(overdueDetails).sort((a,b) => b.totalOverdueAmount - a.totalOverdueAmount)
    }

  }, [allPendingInstallments]);
  

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const generationDate = new Date();

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
    doc.text(`Reporte de Cartera Total por Cobrar`, 14, 45);
    doc.setFontSize(10);
    doc.text(`Fecha de Corte: ${format(cutoffDate, "dd/MM/yyyy")}`, 14, 52);
    doc.text(`Generado: ${format(generationDate, "dd/MM/yyyy HH:mm:ss")}`, 14, 57);

    // Summary
    doc.setFontSize(16);
    doc.text(`Total General a Cobrar: ${formatCurrency(reportData.totalPortfolio)}`, 105, 70, { align: 'center'});

    doc.autoTable({
        startY: 75,
        theme: 'plain',
        body: [
            ['Cartera Vencida (Atrasada):', formatCurrency(reportData.overduePortfolio)],
            ['Cartera Futura (Pendiente):', formatCurrency(reportData.futurePortfolio)],
        ],
        styles: { fontSize: 12 },
        columnStyles: { 1: { halign: 'right' } },
    });

    // Overdue Details
    let finalY = (doc as any).autoTable.previous.finalY;
    if (finalY < 100) finalY = 100;
    
    if (reportData.overdueDetails.length > 0) {
        doc.setFontSize(14);
        doc.text("Detalle de Cartera Vencida", 14, finalY + 10);
        
        const tableColumn = ["Socio", "Préstamo ID", "# Cuotas Vencidas", "Monto Vencido"];
        const tableRows = reportData.overdueDetails.map(d => [
            d.partnerName,
            d.loanId.substring(0, 10) + '...',
            d.overdueInstallmentsCount,
            formatCurrency(d.totalOverdueAmount)
        ]);

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: finalY + 18,
            theme: 'grid',
            headStyles: { fillColor: [36, 53, 91] },
        });
    }

    doc.save(`cartera_total_cobrar_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const isLoading = loadingLoans || loadingPartners || loadingPayments || loadingSettings;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
         <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Fecha de Corte:</span>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn("w-[280px] justify-start text-left font-normal", !cutoffDate && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {cutoffDate ? format(cutoffDate, "PPP", { locale: es }) : <span>Seleccione una fecha</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={cutoffDate}
                        onSelect={(date) => date && setCutoffDate(date)}
                        initialFocus
                        locale={es}
                    />
                </PopoverContent>
            </Popover>
         </div>
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

      {isLoading ? ( <p>Calculando reporte...</p> ) : (
        <div className="space-y-6">
            <Card className="bg-primary/10">
                <CardHeader className="pb-2">
                    <CardTitle className="text-center text-2xl md:text-3xl">Total General a Cobrar</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-center text-4xl md:text-5xl font-bold text-primary">{formatCurrency(reportData.totalPortfolio)}</p>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle>Cartera Vencida</CardTitle>
                        <CardDescription>Monto total de cuotas atrasadas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-destructive">{formatCurrency(reportData.overduePortfolio)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle>Cartera Futura</CardTitle>
                        <CardDescription>Monto total de cuotas por vencer.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <p className="text-3xl font-bold text-green-500">{formatCurrency(reportData.futurePortfolio)}</p>
                    </CardContent>
                </Card>
            </div>
            
            {reportData.overdueDetails.length > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Detalle de Cartera Vencida</CardTitle>
                        <CardDescription>Clientes con préstamos que tienen cuotas vencidas a la fecha de corte.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Socio</TableHead>
                                    <TableHead>Préstamo ID</TableHead>
                                    <TableHead className="text-center"># Cuotas Vencidas</TableHead>
                                    <TableHead className="text-right">Monto Total Vencido</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.overdueDetails.map(detail => (
                                    <TableRow key={detail.loanId}>
                                        <TableCell className="font-medium">{detail.partnerName}</TableCell>
                                        <TableCell className="text-muted-foreground">{detail.loanId.substring(0, 10)}...</TableCell>
                                        <TableCell className="text-center">{detail.overdueInstallmentsCount}</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(detail.totalOverdueAmount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

        </div>
      )}
    </>
  );
}
