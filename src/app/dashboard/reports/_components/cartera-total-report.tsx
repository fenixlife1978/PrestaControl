

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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
    installmentNumber: number | null; // Null for abono_libre
    amount: number;
    type: 'payment' | 'closure' | 'abono_libre';
}

type Installment = {
  loanId: string;
  partnerName: string;
  installmentNumber: number;
  dueDate: Date;
  total: number;
  isOverdue: boolean;
};

type LibreAbonoLoanDetail = {
    partnerName: string;
    loanId: string;
    originalAmount: number;
    remainingBalance: number;
}

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

  const allPayments: Payment[] = useMemo(() =>
      paymentsCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Payment)) || [],
    [paymentsCol]
  );
  
  const companySettings: CompanySettings | null = useMemo(() => {
    return settingsDoc?.exists() ? settingsDoc.data() as CompanySettings : null
  }, [settingsDoc]);

  const allPendingInstallments = useMemo(() => {
    const installments: Installment[] = [];
    
    // Filtramos solo los préstamos con cuotas
    const loansWithInstallments = activeLoans.filter(loan => loan.paymentType === 'cuotas');
    
    loansWithInstallments.forEach((loan) => {
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
        const isPaid = allPayments.some(p => p.loanId === loan.id && p.installmentNumber === i && p.type === 'payment');
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
  }, [activeLoans, allPayments, cutoffDate]);
  
  const reportData = useMemo(() => {
    // Cartera de cuotas
    const overdueInstallments = allPendingInstallments.filter(inst => inst.isOverdue);
    const futureInstallments = allPendingInstallments.filter(inst => !inst.isOverdue);
    const overduePortfolio = overdueInstallments.reduce((sum, inst) => sum + inst.total, 0);
    const futureInstallmentPortfolio = futureInstallments.reduce((sum, inst) => sum + inst.total, 0);

    // Cartera de libre abono
    const libreAbonoLoans = activeLoans.filter(l => l.paymentType === 'libre');
    let libreAbonoPortfolio = 0;
    const libreAbonoDetails: LibreAbonoLoanDetail[] = [];
    
    libreAbonoLoans.forEach(loan => {
        const paidAmount = allPayments
            .filter(p => p.loanId === loan.id && p.type === 'abono_libre')
            .reduce((sum, p) => sum + p.amount, 0);
        const remainingBalance = loan.amount - paidAmount;

        if (remainingBalance > 0) {
            libreAbonoPortfolio += remainingBalance;
            libreAbonoDetails.push({
                partnerName: loan.partnerName || "Desconocido",
                loanId: loan.id,
                originalAmount: loan.amount,
                remainingBalance: remainingBalance,
            });
        }
    });
    
    // Combinar carteras
    const totalPortfolio = overduePortfolio + futureInstallmentPortfolio + libreAbonoPortfolio;
    const futurePortfolio = futureInstallmentPortfolio + libreAbonoPortfolio; // Cartera futura = cuotas futuras + saldo libre abono

    const overdueDetails = overdueInstallments.reduce((acc, inst) => {
        if (!acc[inst.loanId]) {
            acc[inst.loanId] = {
                partnerName: inst.partnerName,
                loanId: inst.loanId,
                totalOverdueAmount: 0,
                overdueInstallmentsCount: 0,
                installments: []
            };
        }
        acc[inst.loanId].totalOverdueAmount += inst.total;
        acc[inst.loanId].overdueInstallmentsCount++;
        acc[inst.loanId].installments.push(inst);
        return acc;
    }, {} as {[key: string]: any});

    const futureDetails = futureInstallments.reduce((acc, inst) => {
        if (!acc[inst.loanId]) {
            acc[inst.loanId] = {
                partnerName: inst.partnerName,
                loanId: inst.loanId,
                totalFutureAmount: 0,
                futureInstallmentsCount: 0,
                installments: []
            };
        }
        acc[inst.loanId].totalFutureAmount += inst.total;
        acc[inst.loanId].futureInstallmentsCount++;
        acc[inst.loanId].installments.push(inst);
        return acc;
    }, {} as {[key: string]: any});
        
    return {
        overduePortfolio,
        futurePortfolio,
        totalPortfolio,
        overdueDetails: Object.values(overdueDetails).sort((a,b) => b.totalOverdueAmount - a.totalOverdueAmount),
        futureInstallmentDetails: Object.values(futureDetails).sort((a,b) => a.partnerName.localeCompare(b.partnerName)),
        libreAbonoDetails, // Pasamos el detalle de libre abono
    }

  }, [activeLoans, allPayments, allPendingInstallments]);
  

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => format(date, "dd/MM/yyyy");

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

            <Accordion type="single" collapsible className="w-full space-y-4">
                <AccordionItem value="overdue" className="border-none">
                     <Card>
                        <AccordionTrigger className="hover:no-underline p-6">
                            <div className="w-full">
                                <CardTitle>Cartera Vencida</CardTitle>
                                <CardDescription className="text-left">Monto total de cuotas atrasadas.</CardDescription>
                                <p className="text-3xl text-left font-bold text-destructive pt-2">{formatCurrency(reportData.overduePortfolio)}</p>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <CardContent>
                                {reportData.overdueDetails.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Socio</TableHead>
                                                <TableHead>Préstamo</TableHead>
                                                <TableHead className="text-center"># Cuotas Vencidas</TableHead>
                                                <TableHead className="text-right">Monto Vencido</TableHead>
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
                                ) : <p className="text-center text-muted-foreground py-4">No hay cartera vencida.</p>}
                            </CardContent>
                        </AccordionContent>
                    </Card>
                </AccordionItem>
                
                <AccordionItem value="future" className="border-none">
                     <Card>
                        <AccordionTrigger className="hover:no-underline p-6">
                            <div className="w-full">
                                <CardTitle>Cartera Futura</CardTitle>
                                <CardDescription className="text-left">Monto total de cuotas por vencer y saldos de libre abono.</CardDescription>
                                 <p className="text-3xl text-left font-bold text-green-600 pt-2">{formatCurrency(reportData.futurePortfolio)}</p>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                             <CardContent>
                                {reportData.futureInstallmentDetails.length === 0 && reportData.libreAbonoDetails.length === 0 ? (
                                     <p className="text-center text-muted-foreground py-4">No hay cartera futura.</p>
                                ) : (
                                   <div className="space-y-6">
                                     {reportData.futureInstallmentDetails.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold mb-2">Cuotas por Vencer</h4>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Socio</TableHead>
                                                        <TableHead>Préstamo</TableHead>
                                                        <TableHead className="text-center"># Cuotas Pendientes</TableHead>
                                                        <TableHead className="text-right">Monto Pendiente</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {reportData.futureInstallmentDetails.map(detail => (
                                                        <TableRow key={detail.loanId}>
                                                            <TableCell className="font-medium">{detail.partnerName}</TableCell>
                                                            <TableCell className="text-muted-foreground">{detail.loanId.substring(0, 10)}...</TableCell>
                                                            <TableCell className="text-center">{detail.futureInstallmentsCount}</TableCell>
                                                            <TableCell className="text-right font-semibold">{formatCurrency(detail.totalFutureAmount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                     )}
                                     {reportData.libreAbonoDetails.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold mb-2">Préstamos de Libre Abono</h4>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Socio</TableHead>
                                                        <TableHead>Préstamo</TableHead>
                                                        <TableHead className="text-right">Monto Original</TableHead>
                                                        <TableHead className="text-right">Saldo Pendiente</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {reportData.libreAbonoDetails.map(detail => (
                                                        <TableRow key={detail.loanId}>
                                                            <TableCell className="font-medium">{detail.partnerName}</TableCell>
                                                            <TableCell className="text-muted-foreground">{detail.loanId.substring(0, 10)}...</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(detail.originalAmount)}</TableCell>
                                                            <TableCell className="text-right font-semibold">{formatCurrency(detail.remainingBalance)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                     )}
                                   </div>
                                )}
                            </CardContent>
                        </AccordionContent>
                    </Card>
                </AccordionItem>
            </Accordion>
        </div>
      )}
    </>
  );
}
