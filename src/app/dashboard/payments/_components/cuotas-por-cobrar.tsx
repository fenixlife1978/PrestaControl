
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, startOfMonth, endOfMonth } from "date-fns";
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
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
}

type Installment = {
  loanId: string;
  partnerId: string;
  partnerName: string;
  installmentNumber: number;
  dueDate: Date;
  principal: number;
  interest: number;
  total: number;
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
    const installments: Installment[] = [];
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
        
        const isPaid = payments.some(p => p.loanId === loan.id && p.installmentNumber === i);

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

  const filteredInstallments = useMemo(() => {
    const filterStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
    const filterEndDate = endOfMonth(new Date(selectedYear, selectedMonth));
    return allInstallments.filter((inst) => {
      return inst.dueDate >= filterStartDate && inst.dueDate <= filterEndDate;
    });
  }, [allInstallments, selectedMonth, selectedYear]);

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

  const handlePayInstallment = async (installment: Installment) => {
    if (!firestore) return;
    try {
        await addDoc(collection(firestore, 'payments'), {
            loanId: installment.loanId,
            partnerId: installment.partnerId,
            installmentNumber: installment.installmentNumber,
            amount: installment.total,
            paymentDate: serverTimestamp(),
        });
        toast({
            title: "Pago Registrado",
            description: `El pago de la cuota #${installment.installmentNumber} para ${installment.partnerName} ha sido registrado.`,
        });
    } catch(e) {
        console.error("Error al registrar el pago: ", e);
        toast({
            title: "Error",
            description: "No se pudo registrar el pago.",
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


  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => date.toLocaleDateString("es-ES", { year: 'numeric', month: '2-digit', day: '2-digit'});

  const isLoading = loadingLoans || loadingPartners || loadingPayments;

  return (
    <div className="space-y-4">
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
            disabled={filteredInstallments.length === 0}
        >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar a PDF
        </Button>
      </div>

      {isLoading && <p>Cargando cuotas...</p>}
      
      {!isLoading && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
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
                filteredInstallments.map((inst) => (
                  <TableRow key={`${inst.loanId}-${inst.installmentNumber}`}>
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
                      {inst.status === "Pendiente" && (
                          <Button size="sm" onClick={() => handlePayInstallment(inst)}>
                              Pagar
                          </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No hay cuotas por cobrar para el período seleccionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {filteredInstallments.length > 0 && (
                <TableFooter>
                    <TableRow className="bg-muted/50 font-medium hover:bg-muted/60">
                        <TableCell colSpan={3} className="text-right font-bold text-base">Totales</TableCell>
                        <TableCell className="text-right font-bold text-base" style={{color: "hsl(var(--primary))"}}>{formatCurrency(totals.principal)}</TableCell>
                        <TableCell className="text-right font-bold text-base" style={{color: "hsl(var(--accent))"}}>{formatCurrency(totals.interest)}</TableCell>
                        <TableCell className="text-right font-bold text-base">{formatCurrency(totals.total)}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                    </TableRow>
                </TableFooter>
            )}
          </Table>
           
        </>
      )}
    </div>
  );
}
