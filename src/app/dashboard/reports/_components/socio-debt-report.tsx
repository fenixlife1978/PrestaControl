
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, Timestamp, doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, format, isPast } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
  cedula?: string;
};

type Loan = {
  id: string;
  partnerId: string;
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
    installmentNumber: number | null;
    amount: number;
    type: 'payment' | 'closure' | 'abono_libre';
}

type Installment = {
  loanId: string;
  installmentNumber: number;
  dueDate: Date;
  total: number;
};

export function SocioDebtReport() {
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);

  const partners: Partner[] = useMemo(() => partnersCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) || [], [partnersCol]);
  const activeLoans: Loan[] = useMemo(() => loansCol?.docs.filter(doc => doc.data().status === 'Aprobado').map(doc => ({ id: doc.id, ...doc.data() } as Loan)) || [], [loansCol]);
  const allPayments: Payment[] = useMemo(() => paymentsCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)) || [], [paymentsCol]);

  const filteredPartners = useMemo(() => partners.filter(partner =>
    `${partner.firstName} ${partner.lastName} ${partner.cedula || ''}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  ), [partners, searchQuery]);

  const partnerDebtData = useMemo(() => {
    if (!selectedPartner) return null;

    const partnerLoans = activeLoans.filter(l => l.partnerId === selectedPartner.id);
    let totalOverdue = 0;
    let totalFuture = 0;
    let overdueInstallments: (Installment & { partnerName: string })[] = [];
    let futureInstallments: (Installment & { partnerName: string })[] = [];
    
    partnerLoans.forEach(loan => {
      // Handle loans with installments
      if (loan.paymentType === 'cuotas') {
        let installmentsCount = 0;
        if (loan.loanType === 'estandar' && loan.installments) {
          installmentsCount = parseInt(loan.installments, 10);
        } else if (loan.loanType === 'personalizado' && loan.customInstallments) {
          installmentsCount = parseInt(loan.customInstallments, 10);
        }

        if (installmentsCount > 0) {
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
                    for (let j = 1; j < i; j++) { outstandingBalance -= principalPerInstallment; }
                    total = Math.round(principalPerInstallment + (outstandingBalance * monthlyInterestRate));
                } else if (loan.loanType === 'personalizado' && loan.customInstallments) {
                    const principalPerInstallment = principalAmount / installmentsCount;
                    let interestPerInstallment = 0;
                    if (loan.hasInterest && loan.customInterest) {
                        const customInterestValue = parseFloat(loan.customInterest);
                        if (loan.interestType === 'porcentaje') {
                            interestPerInstallment = (principalAmount * (customInterestValue / 100)) / installmentsCount;
                        } else {
                            interestPerInstallment = customInterestValue / installmentsCount;
                        }
                    }
                    total = Math.round(principalPerInstallment + interestPerInstallment);
                }
                
                const installmentDetail = {
                    loanId: loan.id,
                    installmentNumber: i,
                    dueDate,
                    total,
                    partnerName: `${selectedPartner.firstName} ${selectedPartner.lastName}`
                };

                if (isPast(dueDate)) {
                    totalOverdue += total;
                    overdueInstallments.push(installmentDetail);
                } else {
                    totalFuture += total;
                    futureInstallments.push(installmentDetail);
                }
            }
        }
      }
      // Handle free payment loans
      else if (loan.paymentType === 'libre') {
        const paidAmount = allPayments
            .filter(p => p.loanId === loan.id && p.type === 'abono_libre')
            .reduce((sum, p) => sum + p.amount, 0);
        const remainingBalance = loan.amount - paidAmount;
        if (remainingBalance > 0) {
            totalFuture += remainingBalance; // Free payments are always 'future' debt until paid
        }
      }
    });

    return { totalOverdue, totalFuture, overdueInstallments, futureInstallments };

  }, [selectedPartner, activeLoans, allPayments]);


  const handlePartnerSelect = (partner: Partner) => {
    setSelectedPartner(partner);
    setSearchQuery("");
  };

  const handleClearPartner = () => {
    setSelectedPartner(null);
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => format(date, "dd/MM/yyyy", { locale: es });
  const isLoading = loadingLoans || loadingPartners || loadingPayments;

  if (isLoading) {
    return <p>Calculando reporte...</p>;
  }

  if (!selectedPartner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Buscar Socio</CardTitle>
          <CardDescription>Seleccione un socio para ver su deuda consolidada.</CardDescription>
        </CardHeader>
        <CardContent>
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
            <div className="max-h-[400px] overflow-y-auto space-y-2">
                {partners.length === 0 && <p className="text-center text-sm text-muted-foreground">No hay socios registrados.</p>}
                {partners.length > 0 && filteredPartners.length === 0 && <p className="text-center text-sm text-muted-foreground">No se encontraron socios.</p>}
                {filteredPartners.map(partner => (
                    <Button variant="outline" key={partner.id} className="w-full justify-start" onClick={() => handlePartnerSelect(partner)}>
                        {partner.firstName} {partner.lastName} ({partner.cedula || 'Sin Cédula'})
                    </Button>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle>Deuda Consolidada de {selectedPartner.firstName} {selectedPartner.lastName}</CardTitle>
                    <CardDescription>Suma de todas las obligaciones pendientes.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearPartner} className="h-7 gap-1">
                  <X className="h-3.5 w-3.5" />
                  <span>Cambiar Socio</span>
              </Button>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-destructive/10 border-destructive">
                        <CardHeader className="pb-2"><CardTitle>Deuda Vencida</CardTitle></CardHeader>
                        <CardContent><p className="text-2xl font-bold text-destructive">{formatCurrency(partnerDebtData?.totalOverdue || 0)}</p></CardContent>
                    </Card>
                    <Card className="bg-green-600/10 border-green-600">
                        <CardHeader className="pb-2"><CardTitle>Deuda Futura</CardTitle></CardHeader>
                        <CardContent><p className="text-2xl font-bold text-green-700">{formatCurrency(partnerDebtData?.totalFuture || 0)}</p></CardContent>
                    </Card>
                     <Card className="bg-primary/10 border-primary">
                        <CardHeader className="pb-2"><CardTitle>Deuda Total</CardTitle></CardHeader>
                        <CardContent><p className="text-2xl font-bold text-primary">{formatCurrency((partnerDebtData?.totalOverdue || 0) + (partnerDebtData?.totalFuture || 0))}</p></CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>
        
        {partnerDebtData && (partnerDebtData.overdueInstallments.length > 0 || partnerDebtData.futureInstallments.length > 0) ? (
            <Card>
                <CardHeader><CardTitle>Detalle de Cuotas Pendientes</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Préstamo ID</TableHead>
                                <TableHead className="text-center"># Cuota</TableHead>
                                <TableHead>Fecha Vencimiento</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                                <TableHead className="text-center">Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {partnerDebtData.overdueInstallments.map(inst => (
                                <TableRow key={`${inst.loanId}-${inst.installmentNumber}`}>
                                    <TableCell className="font-medium text-muted-foreground">{inst.loanId.substring(0, 10)}...</TableCell>
                                    <TableCell className="text-center">{inst.installmentNumber}</TableCell>
                                    <TableCell>{formatDate(inst.dueDate)}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(inst.total)}</TableCell>
                                    <TableCell className="text-center"><Badge variant="destructive">Vencida</Badge></TableCell>
                                </TableRow>
                            ))}
                            {partnerDebtData.futureInstallments.map(inst => (
                                <TableRow key={`${inst.loanId}-${inst.installmentNumber}`}>
                                    <TableCell className="font-medium text-muted-foreground">{inst.loanId.substring(0, 10)}...</TableCell>
                                    <TableCell className="text-center">{inst.installmentNumber}</TableCell>
                                    <TableCell>{formatDate(inst.dueDate)}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(inst.total)}</TableCell>
                                    <TableCell className="text-center"><Badge variant="secondary">Pendiente</Badge></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        ) : (
            <p className="text-center text-muted-foreground pt-4">Este socio no tiene deudas pendientes.</p>
        )}
    </div>
  );
}
