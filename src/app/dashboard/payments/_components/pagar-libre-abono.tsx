
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, addDoc, Timestamp, doc, writeBatch } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Search, Calendar as CalendarIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

type Loan = {
  id: string;
  partnerId: string;
  amount: number;
  status: "Aprobado" | "Pendiente" | "Rechazado" | "Pagado";
  loanType: "estandar" | "personalizado";
  paymentType?: 'cuotas' | 'libre';
  remainingBalance: number;
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
  amount: number;
  type: 'payment' | 'closure' | 'abono_libre';
};


export function PagarLibreAbono() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentConfirmation, setPaymentConfirmation] = useState<{loan: Loan, amount: number, isTotal: boolean} | null>(null);

  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);

  const partners = useMemo(() => partnersCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) || [], [partnersCol]);
  const loans = useMemo(() => loansCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)) || [], [loansCol]);
  const payments = useMemo(() => paymentsCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)) || [], [paymentsCol]);

  const loansWithFreePayment = useMemo(() => {
    return loans.filter(loan => loan.loanType === 'personalizado' && loan.paymentType === 'libre' && loan.status === 'Aprobado');
  }, [loans]);

  const partnerHasFreePaymentLoan = useMemo(() => {
    const partnerIdsWithFreeLoans = new Set(loansWithFreePayment.map(l => l.partnerId));
    return partners.filter(p => partnerIdsWithFreeLoans.has(p.id));
  }, [partners, loansWithFreePayment]);
  

  const filteredPartners = useMemo(() => partnerHasFreePaymentLoan.filter(partner =>
    `${partner.firstName} ${partner.lastName} ${partner.cedula || ''}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  ), [partnerHasFreePaymentLoan, searchQuery]);

  const selectedPartnerLoans = useMemo(() => {
    if (!selectedPartner) return [];
    return loansWithFreePayment
        .filter(l => l.partnerId === selectedPartner.id)
        .map(loan => {
            const paidAmount = payments
                .filter(p => p.loanId === loan.id)
                .reduce((acc, p) => acc + p.amount, 0);
            const remainingBalance = loan.amount - paidAmount;
            return { ...loan, paidAmount, remainingBalance };
        });
  }, [selectedPartner, loansWithFreePayment, payments]);

  const handleSelectPartner = (partner: Partner) => {
    setSelectedPartner(partner);
    setSearchQuery("");
  };

  const handleClearPartner = () => {
    setSelectedPartner(null);
    setPaymentAmount("");
    setPaymentDate(new Date());
  };

  const handleConfirmPayment = async () => {
    if (!firestore || !paymentConfirmation || !paymentDate) return;

    const { loan, amount, isTotal } = paymentConfirmation;

    try {
        const batch = writeBatch(firestore);
        
        const paymentRef = doc(collection(firestore, 'payments'));
        batch.set(paymentRef, {
            loanId: loan.id,
            partnerId: loan.partnerId,
            amount: amount,
            paymentDate: Timestamp.fromDate(paymentDate),
            type: 'abono_libre',
            installmentNumber: null, // No aplica
        });

        if(isTotal) {
            const loanRef = doc(firestore, "loans", loan.id);
            batch.update(loanRef, { status: "Pagado" });
        }

        await batch.commit();

        toast({
            title: "Pago Registrado",
            description: `Se registró un abono de ${formatCurrency(amount)} para ${selectedPartner?.firstName}.`,
        });
    } catch(e) {
        console.error("Error al registrar el pago:", e);
        toast({
            title: "Error",
            description: "No se pudo registrar el pago.",
            variant: "destructive"
        })
    } finally {
        setPaymentConfirmation(null);
        setPaymentAmount("");
    }
  };

  const openConfirmationDialog = (loan: Loan, amount: number, isTotal: boolean = false) => {
    if (amount <= 0) {
        toast({ title: "Monto inválido", description: "El monto a pagar debe ser mayor a cero.", variant: "destructive"});
        return;
    }
     if (amount > loan.remainingBalance) {
        toast({ title: "Monto inválido", description: `El monto a pagar no puede exceder el saldo pendiente de ${formatCurrency(loan.remainingBalance)}.`, variant: "destructive"});
        return;
    }
    setPaymentConfirmation({loan, amount, isTotal});
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
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
            {partnerHasFreePaymentLoan.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">No hay socios con préstamos de libre abono.</p>
            )}
            {partnerHasFreePaymentLoan.length > 0 && filteredPartners.length === 0 && (
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
    <div className="space-y-6 max-w-2xl mx-auto">
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
        
        {selectedPartnerLoans.map(loan => (
            <Card key={loan.id}>
                <CardHeader>
                    <CardTitle className="text-lg">Préstamo #{loan.id.substring(0,6)}...</CardTitle>
                    <div className="flex justify-between text-sm pt-2">
                        <span className="text-muted-foreground">Monto Total:</span>
                        <span className="font-medium">{formatCurrency(loan.amount)}</span>
                    </div>
                     <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Abonado:</span>
                        <span className="font-medium">{formatCurrency(loan.paidAmount)}</span>
                    </div>
                     <div className="flex justify-between text-lg">
                        <span className="text-muted-foreground">Saldo Pendiente:</span>
                        <span className="font-bold text-primary">{formatCurrency(Math.round(loan.remainingBalance))}</span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                             <Label htmlFor="paymentAmount">Monto a Abonar (USD)</Label>
                            <Input
                                id="paymentAmount"
                                type="number"
                                placeholder="Ej: 100.00"
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(e.target.value)}
                                disabled={loan.remainingBalance <= 0}
                            />
                        </div>
                        <div>
                             <Label>Fecha de Abono</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant={"outline"}
                                    className={cn("w-full justify-start text-left font-normal", !paymentDate && "text-muted-foreground")}
                                    disabled={loan.remainingBalance <= 0}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {paymentDate ? format(paymentDate, "PPP", { locale: es }) : <span>Seleccione fecha</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                    mode="single"
                                    selected={paymentDate}
                                    onSelect={setPaymentDate}
                                    initialFocus
                                    locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button 
                        variant="default"
                        onClick={() => openConfirmationDialog(loan, parseFloat(paymentAmount))}
                        disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || loan.remainingBalance <= 0}
                    >
                        Realizar Abono
                    </Button>
                     <Button 
                        variant="destructive"
                        onClick={() => openConfirmationDialog(loan, loan.remainingBalance, true)}
                        disabled={loan.remainingBalance <= 0}
                    >
                        Pagar Saldo Total ({formatCurrency(Math.round(loan.remainingBalance))})
                    </Button>
                </CardFooter>
            </Card>
        ))}
    </div>

    {paymentConfirmation && (
        <AlertDialog open={!!paymentConfirmation} onOpenChange={() => setPaymentConfirmation(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Pago</AlertDialogTitle>
                    <AlertDialogDescription>
                        ¿Está seguro de que desea registrar un pago de <strong>{formatCurrency(paymentConfirmation.amount)}</strong> para el socio <strong>{selectedPartner.firstName} {selectedPartner.lastName}</strong> con fecha <strong>{format(paymentDate || new Date(), "PPP", { locale: es })}</strong>?
                        {paymentConfirmation.isTotal && " Esta acción marcará el préstamo como pagado en su totalidad."}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmPayment}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )}
    </>
  );
}
