
"use client";

import { useState, useMemo, useEffect } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, addDoc, serverTimestamp, Timestamp, writeBatch, doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileDown, FileLock2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PayInstallmentDialog } from "./pay-installment-dialog";
import type { Installment } from "./abonos-vencidos";

// Extender la interfaz de jsPDF para incluir autoTable
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
    paymentDate: Timestamp;
    type: 'payment' | 'closure';
    closureMonth?: string; // e.g., "2024-06"
}


type MonthlyInstallment = Omit<Installment, 'status'> & {
  principal: number;
  interest: number;
  balance: number;
  status: "Pendiente" | "Pagada";
};


const months = [
  { value: 0, label: "Enero" },
  { value: 1, label: "Febrero" },
  { value: 2, label: "Marzo" },
  { value: 3, label: "Abril" },
  { value: 4, label: "Mayo" },
  { value: 5, label: "Junio" },
  { value: 6, label: "Julio" },
  { value: 7, label: "Agosto" },
  { value: 8, label: "Septiembre" },
  { value: 9, label: "Octubre" },
  { value: 10, label: "Noviembre" },
  { value: 11, label: "Diciembre" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export function CuotasPorCobrar() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [paymentModalState, setPaymentModalState] = useState<{isOpen: boolean, installment: Installment | null}>({isOpen: false, installment: null});
  const [isClosureAlertOpen, setIsClosureAlertOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isBulkPayAlertOpen, setIsBulkPayAlertOpen] = useState(false);


  const [loansCol, loadingLoans] = useCollection(
    firestore ? collection(firestore, "loans") : null
  );
  const [partnersCol, loadingPartners] = useCollection(
    firestore ? collection(firestore, "partners") : null
  );
  const [paymentsCol, loadingPayments] = useCollection(
    firestore ? collection(firestore, "payments") : null
  );

  const partners: Partner[] = useMemo(
    () =>
      partnersCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner)) || [],
    [partnersCol]
  );
  
  const loans: Loan[] = useMemo(
      () =>
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

  const payments: Payment[] = useMemo(
    () =>
      paymentsCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Payment)) || [],
    [paymentsCol]
  );

  const allInstallments = useMemo(() => {
    const installments: MonthlyInstallment[] = [];
    loans.forEach((loan) => {
      if (loan.loanType !== "estandar" || !loan.installments || !loan.interestRate) {
        return;
      }
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
        
        const isPaid = payments.some(p => p.loanId === loan.id && p.installmentNumber === i && p.type === 'payment');

        installments.push({
          loanId: loan.id,
          partnerId: loan.partnerId,
          partnerName: loan.partnerName || "Desconocido",
          installmentNumber: i,
          dueDate: dueDate,
          principal: principalPerInstallment,
          interest: interestForMonth,
          total: principalPerInstallment + interestForMonth,
          balance: outstandingBalance < 0.01 ? 0 : outstandingBalance,
          status: isPaid ? "Pagada" : "Pendiente",
        });
      }
    });
    return installments;
  }, [loans, payments]);

  const { filteredInstallments, isMonthClosed, pendingInstallmentsInMonth } = useMemo(() => {
    const filterStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
    const filterEndDate = endOfMonth(new Date(selectedYear, selectedMonth));
    const closureMonthId = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    const isClosed = payments.some(p => p.type === 'closure' && p.closureMonth === closureMonthId);

    const installmentsInPeriod = allInstallments.filter((inst) => {
      return inst.dueDate >= filterStartDate && inst.dueDate <= filterEndDate;
    });

    const pending = installmentsInPeriod.filter(i => i.status === 'Pendiente');

    return { 
      filteredInstallments: installmentsInPeriod, 
      isMonthClosed: isClosed,
      pendingInstallmentsInMonth: pending
    };
  }, [allInstallments, selectedMonth, selectedYear, payments]);

  // Clear selections when month/year changes
  useEffect(() => {
    setSelectedRows(new Set());
  }, [selectedMonth, selectedYear]);

  const pendingInstallmentIds = useMemo(() => {
    return filteredInstallments
        .filter(inst => inst.status === "Pendiente")
        .map(inst => `${inst.loanId}-${inst.installmentNumber}`);
  }, [filteredInstallments]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedRows(new Set(pendingInstallmentIds));
    } else {
        setSelectedRows(new Set());
    }
  };

  const handleRowSelect = (id: string, checked: boolean) => {
    const newSelectedRows = new Set(selectedRows);
    if (checked) {
      newSelectedRows.add(id);
    } else {
      newSelectedRows.delete(id);
    }
    setSelectedRows(newSelectedRows);
  };

  const totals = useMemo(() => {
    const totalPrincipal = filteredInstallments.reduce((acc, inst) => acc + inst.principal, 0);
    const totalInterest = filteredInstallments.reduce((acc, inst) => acc + inst.interest, 0);
    const totalDue = filteredInstallments.reduce((acc, inst) => acc + inst.total, 0);
    return {
      principal: totalPrincipal,
      interest: totalInterest,
      total: totalDue,
    };
  }, [filteredInstallments]);

  const handleOpenPayModal = (installment: Installment) => {
    setPaymentModalState({ isOpen: true, installment });
  };
  
  const handleClosePayModal = () => {
    setPaymentModalState({ isOpen: false, installment: null });
  };

  const handleConfirmPayment = async (installment: Installment, paymentDate: Date) => {
    if (!firestore) return;
    try {
        await addDoc(collection(firestore, 'payments'), {
            loanId: installment.loanId,
            partnerId: installment.partnerId,
            installmentNumber: installment.installmentNumber,
            amount: installment.total,
            paymentDate: Timestamp.fromDate(paymentDate),
            type: 'payment'
        });
        toast({
            title: "Pago Registrado",
            description: `El pago de la cuota #${installment.installmentNumber} para ${installment.partnerName} ha sido registrado.`,
        });
        handleClosePayModal();
    } catch(e) {
        console.error("Error al registrar el pago: ", e);
        toast({
            title: "Error",
            description: "No se pudo registrar el pago.",
            variant: "destructive",
        });
    }
  };

  const handleBulkPayment = async () => {
    if (!firestore || selectedRows.size === 0) return;
    
    const batch = writeBatch(firestore);
    const today = new Date();
    
    selectedRows.forEach(id => {
      const installmentToPay = allInstallments.find(inst => `${inst.loanId}-${inst.installmentNumber}` === id);
      if (installmentToPay) {
        const paymentRef = doc(collection(firestore, 'payments'));
        batch.set(paymentRef, {
            loanId: installmentToPay.loanId,
            partnerId: installmentToPay.partnerId,
            installmentNumber: installmentToPay.installmentNumber,
            amount: installmentToPay.total,
            paymentDate: Timestamp.fromDate(today),
            type: 'payment'
        });
      }
    });

    try {
      await batch.commit();
      toast({
        title: "Pagos Masivos Registrados",
        description: `Se registraron ${selectedRows.size} pagos exitosamente.`
      });
      setSelectedRows(new Set());
      setIsBulkPayAlertOpen(false);
    } catch (e) {
       console.error("Error en pago masivo: ", e);
       toast({
            title: "Error",
            description: "No se pudieron registrar los pagos masivos.",
            variant: "destructive",
        });
    }
  };
  
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";
    
    doc.setFontSize(18);
    doc.text(`Reporte de Cuotas por Cobrar - ${monthName} ${selectedYear}`, 14, 22);
    
    const tableColumn = ["Socio", "# Cuota", "Vencimiento", "Capital", "Interés", "Total", "Estado"];
    const tableRows: any[][] = [];

    filteredInstallments.forEach(inst => {
        const installmentData = [
            inst.partnerName,
            inst.installmentNumber,
            formatDate(inst.dueDate),
            formatCurrency(inst.principal),
            formatCurrency(inst.interest),
            formatCurrency(inst.total),
            inst.status
        ];
        tableRows.push(installmentData);
    });
    
    // Total row
    const totalRow = [
      { content: 'Totales', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(totals.principal), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(totals.interest), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(totals.total), styles: { fontStyle: 'bold', halign: 'right' } },
      ''
    ];
    tableRows.push(totalRow);

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        headStyles: { fillColor: [36, 53, 91] }, // --primary color
        styles: { halign: 'center' },
        columnStyles: {
            0: { halign: 'left' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
        }
    });

    doc.save(`cuotas_por_cobrar_${monthName.toLowerCase()}_${selectedYear}.pdf`);
  };

  const handleMonthClosure = async () => {
    if (!firestore) return;
    const closureMonthId = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    try {
        await addDoc(collection(firestore, 'payments'), {
            type: 'closure',
            closureMonth: closureMonthId,
            createdAt: serverTimestamp()
        });
        toast({
            title: "Mes Cerrado",
            description: `Las ${pendingInstallmentsInMonth.length} cuotas pendientes de ${months.find(m => m.value === selectedMonth)?.label} ahora se mostrarán como vencidas.`
        });
        setIsClosureAlertOpen(false);
    } catch(e) {
        console.error("Error al cerrar el mes: ", e);
        toast({
            title: "Error",
            description: "No se pudo realizar el cierre del mes.",
            variant: "destructive",
        });
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => date.toLocaleDateString("es-ES", { year: 'numeric', month: '2-digit', day: '2-digit'});

  const isLoading = loadingLoans || loadingPartners || loadingPayments;

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(selectedMonth)}
          onValueChange={(val) => setSelectedMonth(Number(val))}
          disabled={isLoading}
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
          disabled={isLoading}
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
            disabled={filteredInstallments.length === 0 || isLoading}
        >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar a PDF
        </Button>
         <Button 
            variant="default"
            size="sm"
            onClick={() => setIsBulkPayAlertOpen(true)}
            disabled={isLoading || isMonthClosed || selectedRows.size === 0}
        >
            Pagar Seleccionados ({selectedRows.size})
        </Button>
         <Button 
            variant="destructive"
            size="sm"
            onClick={() => setIsClosureAlertOpen(true)}
            disabled={isLoading || isMonthClosed}
        >
            <FileLock2 className="mr-2 h-4 w-4" />
            Cierre del Mes
        </Button>
      </div>

      {isLoading && <p>Cargando cuotas...</p>}
      
      {!isLoading && (
        <>
          {isMonthClosed && (
            <div className="p-4 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-md text-sm">
              Este mes ha sido cerrado. Las cuotas pendientes de este período ahora se listan en la pestaña de "Cuotas sin pagar".
            </div>
          )}
          <div className="relative max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">
                     <Checkbox
                        checked={selectedRows.size === pendingInstallmentIds.length && pendingInstallmentIds.length > 0}
                        onCheckedChange={handleSelectAll}
                        aria-label="Seleccionar todo"
                        disabled={isMonthClosed || pendingInstallmentIds.length === 0}
                    />
                  </TableHead>
                  <TableHead>Socio</TableHead>
                  <TableHead className="text-center"># Cuota</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Capital</TableHead>
                  <TableHead className="text-right">Interés</TableHead>
                  <TableHead className="text-right">Total Cuota</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInstallments.length > 0 ? (
                  filteredInstallments.map((inst) => {
                    const instId = `${inst.loanId}-${inst.installmentNumber}`;
                    return (
                    <TableRow key={instId} className={cn(isMonthClosed && inst.status === 'Pendiente' && 'opacity-50')}>
                      <TableCell className="px-4">
                         {inst.status === "Pendiente" && !isMonthClosed && (
                            <Checkbox
                                checked={selectedRows.has(instId)}
                                onCheckedChange={(checked) => handleRowSelect(instId, !!checked)}
                                aria-label={`Seleccionar cuota ${inst.installmentNumber}`}
                            />
                         )}
                      </TableCell>
                      <TableCell className="font-medium">{inst.partnerName}</TableCell>
                      <TableCell className="text-center">{inst.installmentNumber}</TableCell>
                      <TableCell>{formatDate(inst.dueDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inst.principal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inst.interest)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(inst.total)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={inst.status === 'Pagada' ? 'default' : 'secondary'} className={cn(inst.status === 'Pagada' && "bg-green-600 text-white")}>
                            {inst.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {inst.status === "Pendiente" && !isMonthClosed && (
                            <Button size="sm" onClick={() => handleOpenPayModal(inst)}>
                                Pagar
                            </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )})
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No hay cuotas por cobrar para el período seleccionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {filteredInstallments.length > 0 && (
                  <TableFooter>
                      <TableRow className="bg-muted/50 font-medium hover:bg-muted/60">
                          <TableCell colSpan={4} className="text-right font-bold text-base">Totales</TableCell>
                          <TableCell className="text-right font-bold text-base" style={{color: "hsl(var(--primary))"}}>{formatCurrency(totals.principal)}</TableCell>
                          <TableCell className="text-right font-bold text-base" style={{color: "hsl(var(--accent))"}}>{formatCurrency(totals.interest)}</TableCell>
                          <TableCell className="text-right font-bold text-base">{formatCurrency(totals.total)}</TableCell>
                          <TableCell colSpan={2}></TableCell>
                      </TableRow>
                  </TableFooter>
              )}
            </Table>
          </div>
        </>
      )}
    </div>
    
    {paymentModalState.installment && (
        <PayInstallmentDialog
            isOpen={paymentModalState.isOpen}
            onOpenChange={handleClosePayModal}
            installment={paymentModalState.installment}
            onConfirm={handleConfirmPayment}
        />
    )}

    <AlertDialog open={isClosureAlertOpen} onOpenChange={setIsClosureAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de cerrar el mes?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará las <strong>{pendingInstallmentsInMonth.length} cuotas no pagadas</strong> de este mes como vencidas.
              Una vez cerrado, no podrá registrar pagos para este mes desde esta pantalla.
              Las cuotas pendientes pasarán a la lista de "Cuotas sin pagar". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMonthClosure} className="bg-destructive hover:bg-destructive/90">
              Confirmar Cierre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={isBulkPayAlertOpen} onOpenChange={setIsBulkPayAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar Pagos Masivos?</AlertDialogTitle>
            <AlertDialogDescription>
              Está a punto de registrar el pago de <strong>{selectedRows.size} cuotas</strong> con la fecha de hoy. ¿Desea continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkPayment}>
              Confirmar Pagos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
