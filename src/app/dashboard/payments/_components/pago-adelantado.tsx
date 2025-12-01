
"use client";

import { useState, useMemo } from "react";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";
import { collection, addDoc, serverTimestamp, Timestamp, doc, writeBatch, query, where, getDocs, runTransaction } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, isPast, isFuture } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, X } from "lucide-react";
import { PayInstallmentDialog } from "./pay-installment-dialog";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { generatePaymentReceipt, type PaymentReceiptData } from "../utils/generate-payment-receipt";

type Loan = {
  id: string;
  partnerId: string;
  partnerName?: string;
  amount: number;
  status: "Aprobado";
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
  cedula?: string;
};

type Payment = {
  id: string;
  loanId: string;
  installmentNumber: number;
};

type Installment = {
  loanId: string;
  partnerId: string;
  partnerName: string;
  installmentNumber: number;
  dueDate: Date;
  total: number;
  status: "Vencida" | "Pendiente" | "Pagada";
};

type CompanySettings = {
    name?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    rif?: string;
    email?: string;
}

export function PagoAdelantado() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [paymentModalState, setPaymentModalState] = useState<{isOpen: boolean, installment: Installment | null}>({isOpen: false, installment: null});

  const [loansCol, loadingLoans] = useCollection(firestore ? query(collection(firestore, "loans"), where("status", "==", "Aprobado")) : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);
  const settingsRef = firestore ? doc(firestore, 'company_settings', 'main') : null;
  const [settingsDoc, loadingSettings] = useDocument(settingsRef);

  const partners = useMemo(() => partnersCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) || [], [partnersCol]);
  const activeLoans = useMemo(() => loansCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)) || [], [loansCol]);
  const payments = useMemo(() => paymentsCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)) || [], [paymentsCol]);
  const companySettings: CompanySettings | null = useMemo(() => {
    return settingsDoc?.exists() ? settingsDoc.data() as CompanySettings : null
  }, [settingsDoc]);

  const partnersWithActiveLoans = useMemo(() => {
    const partnerIdsWithLoans = new Set(activeLoans.map(l => l.partnerId));
    return partners.filter(p => partnerIdsWithLoans.has(p.id));
  }, [partners, activeLoans]);

  const filteredPartners = useMemo(() => partnersWithActiveLoans.filter(partner =>
    `${partner.firstName} ${partner.lastName} ${partner.cedula || ''}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  ), [partnersWithActiveLoans, searchQuery]);

  const partnerLoans = useMemo(() => {
    if (!selectedPartner) return [];
    return activeLoans.filter(loan => loan.partnerId === selectedPartner.id);
  }, [selectedPartner, activeLoans]);

  const paymentPlan = useMemo(() => {
    if (!selectedLoan) return [];
    const plan: Installment[] = [];
    const { id: loanId, partnerId, amount, startDate, loanType, installments, interestRate, customInstallments, hasInterest, customInterest, interestType, paymentType } = selectedLoan;

    let installmentsCount = 0;
    if (loanType === 'estandar' && installments) {
      installmentsCount = parseInt(installments, 10);
    } else if (loanType === 'personalizado' && paymentType === 'cuotas' && customInstallments) {
      installmentsCount = parseInt(customInstallments, 10);
    }
    if (installmentsCount <= 0) return [];
    
    const principalAmount = amount;
    const loanStartDate = startDate.toDate();

    for (let i = 1; i <= installmentsCount; i++) {
        const dueDate = addMonths(loanStartDate, i);
        const isPaid = payments.some(p => p.loanId === loanId && p.installmentNumber === i);
        let status: Installment['status'] = isPaid ? "Pagada" : isPast(dueDate) ? "Vencida" : "Pendiente";
        
        let total = 0;
        if (loanType === 'estandar' && installments && interestRate) {
            const monthlyInterestRate = parseFloat(interestRate) / 100;
            const principalPerInstallment = principalAmount / installmentsCount;
            let outstandingBalance = principalAmount;
            for (let j = 1; j < i; j++) {
                outstandingBalance -= principalPerInstallment;
            }
            const interestForMonth = outstandingBalance * monthlyInterestRate;
            total = Math.round(principalPerInstallment + interestForMonth);
        } else if (loanType === 'personalizado' && paymentType === 'cuotas' && customInstallments) {
            const principalPerInstallment = principalAmount / installmentsCount;
            let interestPerInstallment = 0;
            if (hasInterest && customInterest) {
                const customInterestValue = parseFloat(customInterest);
                if (interestType === 'porcentaje') {
                    interestPerInstallment = (principalAmount * (customInterestValue / 100)) / installmentsCount;
                } else {
                    interestPerInstallment = customInterestValue / installmentsCount;
                }
            }
            total = Math.round(principalPerInstallment + interestPerInstallment);
        }

        plan.push({
            loanId,
            partnerId,
            partnerName: `${selectedPartner?.firstName} ${selectedPartner?.lastName}`,
            installmentNumber: i,
            dueDate,
            total,
            status,
        });
    }

    return plan;
  }, [selectedLoan, payments, selectedPartner]);

  const handleSelectPartner = (partner: Partner) => {
    setSelectedPartner(partner);
    setSearchQuery("");
    const partnerLoans = activeLoans.filter(l => l.partnerId === partner.id);
    if (partnerLoans.length === 1) {
        setSelectedLoan(partnerLoans[0]);
    }
  };

  const handleClearPartner = () => {
    setSelectedPartner(null);
    setSelectedLoan(null);
  };

  const handleClearLoan = () => {
    setSelectedLoan(null);
  }

  const handleOpenPayModal = (installment: Installment) => {
    setPaymentModalState({ isOpen: true, installment });
  };
  
  const handleClosePayModal = () => {
    setPaymentModalState({ isOpen: false, installment: null });
  };

  const checkAndFinalizeLoanAfterPayment = async (loanId: string) => {
    if (!firestore) return null;
    const loan = activeLoans.find(l => l.id === loanId);
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
        const metadataRef = doc(firestore, "metadata", "payments");

        await runTransaction(firestore, async (transaction) => {
            const metadataDoc = await transaction.get(metadataRef);
            const currentPaymentNumber = metadataDoc.exists() ? metadataDoc.data().lastNumber || 0 : 0;
            const newPaymentNumber = currentPaymentNumber + 1;

            const paymentRef = doc(collection(firestore, 'payments'));
            transaction.set(paymentRef, {
                paymentNumber: newPaymentNumber,
                loanId: installment.loanId,
                partnerId: installment.partnerId,
                installmentNumber: installment.installmentNumber,
                amount: installment.total,
                paymentDate: Timestamp.fromDate(paymentDate),
                type: 'payment'
            });

            const loanRefToFinalize = await checkAndFinalizeLoanAfterPayment(installment.loanId);
            if (loanRefToFinalize) {
                transaction.update(loanRefToFinalize, { status: 'Pagado' });
            }
            transaction.set(metadataRef, { lastNumber: newPaymentNumber }, { merge: true });
        });
        
        const partner = partners.find(p => p.id === installment.partnerId);
        const receiptData: PaymentReceiptData = {
            receiptNumber: (await runTransaction(firestore, async t => (await t.get(metadataRef)).data()?.lastNumber)),
            paymentDate: paymentDate,
            partner: partner || { id: installment.partnerId, firstName: 'Desconocido', lastName: ''},
            installmentsPaid: [
                {
                    loanId: installment.loanId,
                    installmentNumber: installment.installmentNumber,
                    amount: installment.total,
                },
            ],
            totalPaid: installment.total,
        };
        
        await generatePaymentReceipt(receiptData, companySettings);

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
  const isLoading = loadingLoans || loadingPartners || loadingPayments || loadingSettings;

  if (isLoading) {
    return <p>Cargando datos...</p>;
  }

  // Step 1: Partner Selection
  if (!selectedPartner) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar socio por nombre, apellido o cédula..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-2">
            {partnersWithActiveLoans.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">No hay socios con préstamos activos.</p>
            )}
            {partnersWithActiveLoans.length > 0 && filteredPartners.length === 0 && (
                 <p className="text-center text-sm text-muted-foreground">No se encontraron socios.</p>
            )}
            {filteredPartners.map(partner => (
                <Button variant="outline" key={partner.id} className="w-full justify-start" onClick={() => handleSelectPartner(partner)}>
                    {partner.firstName} {partner.lastName} ({partner.cedula || 'Sin Cédula'})
                </Button>
            ))}
        </div>
      </div>
    );
  }

  // Step 2: Loan Selection (if more than one)
  if (!selectedLoan) {
      return (
          <div className="space-y-4 max-w-lg mx-auto">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Seleccionar Préstamo para {selectedPartner.firstName}</h3>
                <Button variant="link" onClick={handleClearPartner}>Cambiar Socio</Button>
              </div>
              <div className="space-y-2">
                  {partnerLoans.map(loan => (
                      <Button variant="outline" key={loan.id} className="w-full justify-start h-auto py-2" onClick={() => setSelectedLoan(loan)}>
                          <div className="flex flex-col items-start">
                              <span>Préstamo de {formatCurrency(loan.amount)}</span>
                              <span className="text-xs text-muted-foreground">Fecha de inicio: {formatDate(loan.startDate.toDate())}</span>
                          </div>
                      </Button>
                  ))}
              </div>
          </div>
      );
  }

  // Step 3: Payment Plan Display
  return (
    <>
      <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Plan de Pagos para {selectedPartner.firstName} {selectedPartner.lastName}</CardTitle>
                        <CardDescription>Préstamo de {formatCurrency(selectedLoan.amount)} iniciado el {formatDate(selectedLoan.startDate.toDate())}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {partnerLoans.length > 1 && <Button variant="link" onClick={handleClearLoan}>Cambiar Préstamo</Button>}
                        <Button variant="link" onClick={handleClearPartner}>Cambiar Socio</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="relative max-h-[60vh] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-center"># Cuota</TableHead>
                                <TableHead>Fecha Vencimiento</TableHead>
                                <TableHead className="text-right">Monto Cuota</TableHead>
                                <TableHead className="text-center">Estado</TableHead>
                                <TableHead className="text-right">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paymentPlan.map(inst => (
                                <TableRow key={inst.installmentNumber}>
                                    <TableCell className="text-center font-medium">{inst.installmentNumber}</TableCell>
                                    <TableCell>{formatDate(inst.dueDate)}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(inst.total)}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={inst.status === 'Pagada' ? 'default' : inst.status === 'Vencida' ? 'destructive' : 'secondary'}
                                               className={cn(inst.status === 'Pagada' && "bg-green-600 text-white")}>
                                            {inst.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {inst.status !== 'Pagada' && (
                                            <Button size="sm" onClick={() => handleOpenPayModal(inst)}>
                                                Pagar
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
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
