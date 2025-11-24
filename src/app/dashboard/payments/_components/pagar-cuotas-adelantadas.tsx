
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { addMonths, startOfToday } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PayInstallmentDialog } from "./pay-installment-dialog";
import type { Installment } from "./abonos-vencidos";

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
  type: 'payment';
};

export function PagarCuotasAdelantadas() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [paymentModalState, setPaymentModalState] = useState<{isOpen: boolean, installment: Installment | null}>({isOpen: false, installment: null});

  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);

  const partners = useMemo(() => partnersCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) || [], [partnersCol]);
  const loans = useMemo(() => loansCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)) || [], [loansCol]);
  const payments = useMemo(() => paymentsCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)) || [], [paymentsCol]);

  const partnersWithInstallmentLoans = useMemo(() => {
    const loanPartnerIds = new Set(loans.filter(l => (l.loanType === 'estandar' && l.installments) || (l.loanType === 'personalizado' && l.paymentType === 'cuotas')).map(l => l.partnerId));
    return partners.filter(p => loanPartnerIds.has(p.id));
  }, [partners, loans]);

  const filteredPartners = useMemo(() => partnersWithInstallmentLoans.filter(partner =>
    `${partner.firstName} ${partner.lastName} ${partner.cedula || ''}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  ), [partnersWithInstallmentLoans, searchQuery]);

  const futureInstallments = useMemo(() => {
    if (!selectedPartner) return [];

    const today = startOfToday();
    const partnerInstallments: Installment[] = [];

    const partnerLoans = loans.filter(l => l.partnerId === selectedPartner.id);

    partnerLoans.forEach((loan) => {
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

        if (dueDate >= today) {
          const isPaid = payments.some(p => p.loanId === loan.id && p.installmentNumber === i && p.type === 'payment');
          if (!isPaid) {
            let total = 0;
            // Simplified total calculation for display, precise calculation is in `pay-installment-dialog` logic
            if(loan.loanType === 'estandar' && loan.installments) {
                total = (principalAmount / installmentsCount) * (1 + (parseFloat(loan.interestRate || '0') / 100));
            } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
                 const principalPerInstallment = principalAmount / parseInt(loan.customInstallments, 10);
                 let interestPerInstallment = 0;
                if(loan.hasInterest && loan.customInterest) {
                    const customInterestValue = parseFloat(loan.customInterest);
                    if(loan.interestType === 'porcentaje') {
                        interestPerInstallment = (principalAmount * (customInterestValue / 100)) / parseInt(loan.customInstallments, 10);
                    } else { // 'fijo'
                        interestPerInstallment = customInterestValue / parseInt(loan.customInstallments, 10);
                    }
                }
                total = principalPerInstallment + interestPerInstallment;
            }

            partnerInstallments.push({
              loanId: loan.id,
              partnerId: loan.partnerId,
              partnerName: `${selectedPartner.firstName} ${selectedPartner.lastName}`,
              installmentNumber: i,
              dueDate: dueDate,
              total: total,
              status: "Pendiente",
            });
          }
        }
      }
    });

    return partnerInstallments.sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [selectedPartner, loans, payments]);


  const handleSelectPartner = (partner: Partner) => {
    setSelectedPartner(partner);
    setSearchQuery("");
  };

  const handleClearPartner = () => {
    setSelectedPartner(null);
  };
  
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
            title: "Pago Adelantado Registrado",
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
  const isLoading = loadingPartners || loadingLoans || loadingPayments;

  if (isLoading) {
    return <p>Cargando datos...</p>;
  }

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
            {partnersWithInstallmentLoans.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">No hay socios con préstamos a cuotas.</p>
            )}
            {partnersWithInstallmentLoans.length > 0 && filteredPartners.length === 0 && (
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

  return (
    <>
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle>{selectedPartner.firstName} {selectedPartner.lastName}</CardTitle>
                    <CardDescription>{selectedPartner.cedula || 'Sin Cédula'}</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClearPartner} className="h-7 w-7">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Cambiar Socio</span>
                </Button>
            </CardHeader>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Cuotas Futuras Pendientes</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead># Cuota</TableHead>
                            <TableHead>Fecha Vencimiento</TableHead>
                            <TableHead className="text-right">Monto Estimado</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {futureInstallments.length > 0 ? futureInstallments.map(inst => (
                             <TableRow key={`${inst.loanId}-${inst.installmentNumber}`}>
                                <TableCell>{inst.installmentNumber}</TableCell>
                                <TableCell>{formatDate(inst.dueDate)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(inst.total)}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="secondary">{inst.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" onClick={() => handleOpenPayModal(inst)}>
                                        Pagar
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center">No hay cuotas futuras pendientes para este socio.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
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
