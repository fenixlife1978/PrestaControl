

"use client";

import { useState, useMemo } from "react";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";
import { collection, Timestamp, doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, format, getDaysInMonth, isPast } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

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
    startDate: Date;
    totalOverdueAmount: number;
    overdueInstallmentsCount: number;
    installments: Installment[];
}

type FutureLoanDetail = {
    partnerName: string;
    loanId: string;
    startDate: Date;
    totalFutureAmount: number;
    futureInstallmentsCount: number;
    installments: Installment[];
}


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
const years = Array.from({ length: 20 }, (_, i) => currentYear - 10 + i);

export function CarteraTotalReport() {
  const firestore = useFirestore();
  const [day, setDay] = useState(new Date().getDate());
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [isExporting, setIsExporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const daysInMonth = useMemo(() => getDaysInMonth(new Date(year, month)), [year, month]);
  const cutoffDate = useMemo(() => new Date(year, month, Math.min(day, daysInMonth)), [year, month, day, daysInMonth]);

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

  const reportData = useMemo(() => {
    const installments: Installment[] = [];
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

    const overdueInstallments = installments.filter(inst => inst.isOverdue);
    const futureInstallments = installments.filter(inst => !inst.isOverdue);

    // Group details
    const overdueDetails = overdueInstallments.reduce((acc, inst) => {
        const loan = activeLoans.find(l => l.id === inst.loanId);
        if (!loan) return acc;
        if (!acc[inst.loanId]) {
            acc[inst.loanId] = {
                partnerName: inst.partnerName, loanId: inst.loanId, startDate: loan.startDate.toDate(),
                totalOverdueAmount: 0, overdueInstallmentsCount: 0, installments: []
            };
        }
        acc[inst.loanId].totalOverdueAmount += inst.total;
        acc[inst.loanId].overdueInstallmentsCount++;
        acc[inst.loanId].installments.push(inst);
        return acc;
    }, {} as {[key: string]: OverdueLoanDetail});

    const futureDetails = futureInstallments.reduce((acc, inst) => {
        const loan = activeLoans.find(l => l.id === inst.loanId);
        if (!loan) return acc;
        if (!acc[inst.loanId]) {
            acc[inst.loanId] = {
                partnerName: inst.partnerName, loanId: inst.loanId, startDate: loan.startDate.toDate(),
                totalFutureAmount: 0, futureInstallmentsCount: 0, installments: []
            };
        }
        acc[inst.loanId].totalFutureAmount += inst.total;
        acc[inst.loanId].futureInstallmentsCount++;
        acc[inst.loanId].installments.push(inst);
        return acc;
    }, {} as {[key: string]: FutureLoanDetail});

    // Libre abono
    const libreAbonoLoans = activeLoans.filter(l => l.paymentType === 'libre');
    const libreAbonoDetails: LibreAbonoLoanDetail[] = [];
    libreAbonoLoans.forEach(loan => {
        const paidAmount = allPayments
            .filter(p => p.loanId === loan.id && p.type === 'abono_libre')
            .reduce((sum, p) => sum + p.amount, 0);
        const remainingBalance = loan.amount - paidAmount;
        if (remainingBalance > 0) {
            libreAbonoDetails.push({
                partnerName: loan.partnerName || "Desconocido", loanId: loan.id,
                originalAmount: loan.amount, remainingBalance: Math.round(remainingBalance),
            });
        }
    });

    // Calculate totals from details
    const overduePortfolio = Object.values(overdueDetails).reduce((sum, d) => sum + d.totalOverdueAmount, 0);
    const futureInstallmentPortfolio = Object.values(futureDetails).reduce((sum, d) => sum + d.totalFutureAmount, 0);
    const libreAbonoPortfolio = libreAbonoDetails.reduce((sum, d) => sum + d.remainingBalance, 0);
    
    const futurePortfolio = futureInstallmentPortfolio + libreAbonoPortfolio;
    const totalPortfolio = overduePortfolio + futurePortfolio;

    return {
        overduePortfolio,
        futurePortfolio,
        totalPortfolio,
        overdueDetails: Object.values(overdueDetails).sort((a,b) => b.totalOverdueAmount - a.totalOverdueAmount),
        futureInstallmentDetails: Object.values(futureDetails).sort((a,b) => a.partnerName.localeCompare(b.partnerName)),
        libreAbonoDetails: libreAbonoDetails.sort((a,b) => a.partnerName.localeCompare(b.partnerName)),
    }
  }, [activeLoans, allPayments, cutoffDate]);
  

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => format(date, "dd/MM/yyyy");

  const handleExportPDF = async (reportType: 'summary' | 'full') => {
    setIsExporting(true);
    const doc = new jsPDF();
    const generationDate = new Date();

    // Header
    if (companySettings?.logoUrl) {
        try {
            const response = await fetch(companySettings.logoUrl);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            await new Promise<void>(resolve => {
                reader.onloadend = () => {
                    doc.addImage(reader.result as string, 'PNG', 14, 15, 30, 15);
                    resolve();
                };
            });
        } catch(e) {
            console.error("Error loading logo for PDF", e);
        }
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
    doc.text(`Total General a Cobrar: ${formatCurrency(reportData.totalPortfolio)}`, doc.internal.pageSize.getWidth() / 2, 70, { align: 'center'});

    autoTable(doc, {
        startY: 75,
        theme: 'plain',
        body: [
            ['Cartera Vencida (Atrasada):', formatCurrency(reportData.overduePortfolio)],
            ['Cartera Futura (Pendiente):', formatCurrency(reportData.futurePortfolio)],
        ],
        styles: { fontSize: 12 },
        columnStyles: { 1: { halign: 'right' } },
    });

    let finalY = (doc as any).lastAutoTable.finalY;
    if (finalY < 95) finalY = 95;
    
    if (reportType === 'full') {
        const addPageIfNeeded = (requiredHeight: number) => {
            if (finalY + requiredHeight > doc.internal.pageSize.height - 20) {
                doc.addPage();
                finalY = 20;
            }
        };

        if (reportData.overdueDetails.length > 0) {
            addPageIfNeeded(30);
            doc.setFontSize(14);
            doc.text("Detalle de Cartera Vencida", 14, finalY + 10);
            
            const tableColumn = ["Socio", "Fecha Otorgamiento", "# Cuotas Vencidas", "Monto Vencido"];
            const tableRows = reportData.overdueDetails.map(d => [
                d.partnerName,
                formatDate(d.startDate),
                d.overdueInstallmentsCount,
                formatCurrency(d.totalOverdueAmount)
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: finalY + 18,
                theme: 'grid',
                headStyles: { fillColor: [220, 53, 69], textColor: 255 }, // destructive color
            });
            finalY = (doc as any).lastAutoTable.finalY;
        }
        
        if (reportData.futureInstallmentDetails.length > 0) {
            addPageIfNeeded(30);
            doc.setFontSize(14);
            doc.text("Detalle de Cartera Futura (Cuotas)", 14, finalY + 15);
            
            const tableColumn = ["Socio", "Fecha Otorgamiento", "# Cuotas Pendientes", "Monto Pendiente"];
            const tableRows = reportData.futureInstallmentDetails.map(d => [
                d.partnerName,
                formatDate(d.startDate),
                d.futureInstallmentsCount,
                formatCurrency(d.totalFutureAmount)
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: finalY + 23,
                theme: 'grid',
                headStyles: { fillColor: [25, 135, 84], textColor: 255 }, // a green color
            });
            finalY = (doc as any).lastAutoTable.finalY;
        }

        if (reportData.libreAbonoDetails.length > 0) {
            addPageIfNeeded(30);
            doc.setFontSize(14);
            doc.text("Detalle de Cartera Futura (Libre Abono)", 14, finalY + 15);

            const tableColumn = ["Socio", "Monto Original", "Saldo Pendiente"];
            const tableRows = reportData.libreAbonoDetails.map(d => [
                d.partnerName,
                formatCurrency(d.originalAmount),
                formatCurrency(d.remainingBalance)
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: finalY + 23,
                theme: 'grid',
                headStyles: { fillColor: [25, 135, 84], textColor: 255 }, // a green color
            });
            finalY = (doc as any).lastAutoTable.finalY;
        }
    }

    doc.save(`cartera_total_cobrar_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    setIsExporting(false);
    setIsExportDialogOpen(false);
  };

  const isLoading = loadingLoans || loadingPartners || loadingPayments || loadingSettings;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
         <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Fecha de Corte:</span>
             <div className="grid grid-cols-3 gap-2">
                <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                    <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
            </div>
         </div>
         <Button 
            variant="outline"
            size="sm"
            onClick={() => setIsExportDialogOpen(true)}
            disabled={isLoading || isExporting}
        >
            {isExporting ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exportando...
                </>
            ) : (
                <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Exportar a PDF
                </>
            )}
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
                                                <TableHead>Fecha Otorgamiento</TableHead>
                                                <TableHead className="text-center"># Cuotas Vencidas</TableHead>
                                                <TableHead className="text-right">Monto Vencido</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {reportData.overdueDetails.map(detail => (
                                                <TableRow key={detail.loanId}>
                                                    <TableCell className="font-medium">{detail.partnerName}</TableCell>
                                                    <TableCell>{formatDate(detail.startDate)}</TableCell>
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
                                                        <TableHead>Fecha Otorgamiento</TableHead>
                                                        <TableHead className="text-center"># Cuotas Pendientes</TableHead>
                                                        <TableHead className="text-right">Monto Pendiente</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {reportData.futureInstallmentDetails.map(detail => (
                                                        <TableRow key={detail.loanId}>
                                                            <TableCell className="font-medium">{detail.partnerName}</TableCell>
                                                            <TableCell>{formatDate(detail.startDate)}</TableCell>
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
                                                        <TableHead className="text-right">Monto Original</TableHead>
                                                        <TableHead className="text-right">Saldo Pendiente</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {reportData.libreAbonoDetails.map(detail => (
                                                        <TableRow key={detail.loanId}>
                                                            <TableCell className="font-medium">{detail.partnerName}</TableCell>
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

      <AlertDialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Qué desea exportar?</AlertDialogTitle>
            <AlertDialogDescription>
              Puede exportar solo un resumen de los saldos totales o un reporte completo con el detalle de cada cartera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExporting}>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleExportPDF('summary')}
              disabled={isExporting}
            >
              {isExporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</>
              ) : (
                "Solo Saldos"
              )}
            </Button>
            <Button
              onClick={() => handleExportPDF('full')}
              disabled={isExporting}
            >
              {isExporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</>
              ) : (
                "Reporte Completo"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

