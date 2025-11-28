
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, addDoc, serverTimestamp, Timestamp, doc, writeBatch, query, where, getDocs } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, endOfMonth, startOfMonth } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayInstallmentDialog } from "./pay-installment-dialog";


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

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
};

type Payment = {
  id: string;
  loanId: string;
  installmentNumber: number;
  type: 'payment' | 'closure';
  closureMonth?: string; // e.g., "2024-06"
};

export type Installment = {
  loanId: string;
  partnerId: string;
  partnerName: string;
  installmentNumber: number;
  dueDate: Date;
  total: number;
  status: "Vencida" | "Pendiente" | "Pagada";
};

const months = [
  { value: 0, label: "Enero" }, { value: 1, label: "Febrero" }, { value: 2, label: "Marzo" },
  { value: 3, label: "Abril" }, { value: 4, label: "Mayo" }, { value: 5, label: "Junio" },
  { value: 6, label: "Julio" }, { value: 7, label: "Agosto" }, { value: 8, label: "Septiembre" },
  { value: 9, label: "Octubre" }, { value: 10, label: "Noviembre" }, { value: 11, label: "Diciembre" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);


export function AbonosVencidos() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [paymentModalState, setPaymentModalState] = useState<{isOpen: boolean, installment: Installment | null}>({isOpen: false, installment: null});

  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);

  const partners = useMemo(() => partnersCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner)) || [], [partnersCol]);
  const loans = useMemo(() => loansCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Loan)) || [], [loansCol]);
  const payments = useMemo(() => paymentsCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Payment)) || [], [paymentsCol]);

  const overdueInstallmentsByPartner = useMemo(() => {
    const overdue: { [key: string]: Installment[] } = {};
    
    const closedMonths = new Set(
        payments.filter(p => p.type === 'closure').map(p => p.closureMonth)
    );

    loans.forEach((loan) => {
      const partner = partners.find(p => p.id === loan.partnerId);
      if (!partner) return;
      
      let installmentsCount = 0;
      if (loan.loanType === 'estandar' && loan.installments) {
        installmentsCount = parseInt(loan.installments, 10);
      } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
        installmentsCount = parseInt(loan.customInstallments, 10);
      } else {
        return; // No installments for this loan type
      }

      if(installmentsCount <= 0) return;

      const principalAmount = loan.amount;
      const startDate = loan.startDate.toDate();
      
      for (let i = 1; i <= installmentsCount; i++) {
        const dueDate = addMonths(startDate, i);
        let total = 0;

        if(loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
            const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
            const principalPerInstallment = principalAmount / installmentsCount;
            let outstandingBalance = principalAmount;
            for(let j=1; j < i; j++){
                outstandingBalance -= principalPerInstallment;
            }
            const interestForMonth = outstandingBalance * monthlyInterestRate;
            const roundedPrincipal = principalPerInstallment;
            const roundedInterest = interestForMonth;
            total = Math.round(roundedPrincipal + roundedInterest);
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
            const roundedPrincipal = principalPerInstallment;
            const roundedInterest = interestPerInstallment;
            total = Math.round(roundedPrincipal + roundedInterest);
        }

        const isPaid = payments.some(p => p.loanId === loan.id && p.installmentNumber === i && p.type === 'payment');
        
        const installmentMonthId = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (!isPaid && closedMonths.has(installmentMonthId)) {
          if (!overdue[loan.partnerId]) {
            overdue[loan.partnerId] = [];
          }
          overdue[loan.partnerId].push({
            loanId: loan.id,
            partnerId: loan.partnerId,
            partnerName: `${partner.firstName} ${partner.lastName}`,
            installmentNumber: i,
            dueDate: dueDate,
            total: total,
            status: "Vencida",
          });
        }
      }
    });
    return overdue;
  }, [loans, partners, payments]);

  const partnersWithOverdue = useMemo(() => {
    return partners.filter(p => overdueInstallmentsByPartner[p.id]?.length > 0);
  }, [partners, overdueInstallmentsByPartner]);

  const handleOpenPayModal = (installment: Installment) => {
    setPaymentModalState({ isOpen: true, installment });
  };
  
  const handleClosePayModal = () => {
    setPaymentModalState({ isOpen: false, installment: null });
  };

  const checkAndFinalizeLoanAfterPayment = async (loanId: string, firestore: any) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return null;
  
    let totalInstallments = 0;
    if (loan.loanType === 'estandar' && loan.installments) {
      totalInstallments = parseInt(loan.installments, 10);
    } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
      totalInstallments = parseInt(loan.customInstallments, 10);
    }
  
    if (totalInstallments === 0) return null;
  
    const paymentsQuery = query(collection(firestore, 'payments'), where('loanId', '==', loanId), where('type', '==', 'payment'));
    const loanPaymentsSnapshot = await getDocs(paymentsQuery);
    // +1 because we are checking *after* a payment will be added
    const paidInstallmentsCount = loanPaymentsSnapshot.size + 1; 
  
    if (paidInstallmentsCount >= totalInstallments) {
        return doc(firestore, "loans", loanId);
    }
    return null;
  };

  const handleConfirmPayment = async (installment: Installment, paymentDate: Date) => {
    if (!firestore) return;
    try {
        const batch = writeBatch(firestore);

        const paymentRef = doc(collection(firestore, 'payments'));
        batch.set(paymentRef, {
            loanId: installment.loanId,
            partnerId: installment.partnerId,
            installmentNumber: installment.installmentNumber,
            amount: installment.total,
            paymentDate: Timestamp.fromDate(paymentDate),
            type: 'payment'
        });

        const loanRefToFinalize = await checkAndFinalizeLoanAfterPayment(installment.loanId, firestore);
        if (loanRefToFinalize) {
            batch.update(loanRefToFinalize, { status: 'Pagado' });
        }

        await batch.commit();

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

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => date.toLocaleDateString("es-ES", { year: 'numeric', month: 'long', day: 'numeric' });

  const isLoading = loadingLoans || loadingPartners || loadingPayments;


  if (isLoading) {
    return <p>Calculando cuotas vencidas...</p>;
  }
  
  return (
    <>
    <div className="space-y-4">
        {isLoading ? (
            <p>Calculando cuotas vencidas...</p>
        ) : partnersWithOverdue.length === 0 ? (
            <p className="pt-4 text-center text-muted-foreground">No hay socios con cuotas vencidas.</p>
        ) : (
            <Accordion type="single" collapsible className="w-full">
            {partnersWithOverdue.map(partner => {
                const installments = overdueInstallmentsByPartner[partner.id].sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
                const totalOwed = installments.reduce((acc, inst) => acc + inst.total, 0);

                return (
                <AccordionItem value={partner.id} key={partner.id}>
                    <AccordionTrigger>
                        <div className="flex justify-between w-full pr-4">
                            <span className="font-semibold">{partner.firstName} {partner.lastName}</span>
                            <Badge variant="destructive">{installments.length} cuota(s) vencida(s) - Total: {formatCurrency(totalOwed)}</Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead># Cuota</TableHead>
                            <TableHead>Fecha Vencimiento</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {installments.map(inst => (
                            <TableRow key={`${inst.loanId}-${inst.installmentNumber}`}>
                            <TableCell>{inst.installmentNumber}</TableCell>
                            <TableCell>{formatDate(inst.dueDate)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(inst.total)}</TableCell>
                            <TableCell className="text-center">
                                <Badge variant="destructive">{inst.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button size="sm" onClick={() => handleOpenPayModal(inst)}>
                                    Pagar
                                </Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    </AccordionContent>
                </AccordionItem>
                );
            })}
            </Accordion>
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
    </>
  );
}
