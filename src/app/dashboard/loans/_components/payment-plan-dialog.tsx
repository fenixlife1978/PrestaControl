
"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addMonths, isPast } from "date-fns";
import type { Loan } from "../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Payment = {
    id: string;
    loanId: string;
    installmentNumber: number;
    type: 'payment' | 'closure';
}

type PaymentPlanDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan | null;
  payments: Payment[];
};

type Installment = {
  installmentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  total: number;
  balance: number;
  status: "Pagada" | "Vencida" | "Pendiente";
};

export function PaymentPlanDialog({
  isOpen,
  onOpenChange,
  loan,
  payments
}: PaymentPlanDialogProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const paymentPlan = useMemo(() => {
    const plan: Installment[] = [];
    if (!loan) return plan;

    const principalAmount = loan.amount;
    const startDate = new Date(loan.startDate.seconds * 1000);
    
    if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
        const installmentsCount = parseInt(loan.installments, 10);
        if (installmentsCount <= 0) return [];
        const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
        const principalPerInstallment = principalAmount / installmentsCount;
        let outstandingBalance = principalAmount;

        for (let i = 1; i <= installmentsCount; i++) {
          const interestForMonth = outstandingBalance * monthlyInterestRate;
          const roundedPrincipal = Math.round(principalPerInstallment);
          const roundedInterest = Math.round(interestForMonth);
          const totalPayment = roundedPrincipal + roundedInterest;
          const dueDate = addMonths(startDate, i);
          
          outstandingBalance -= principalPerInstallment;
          
          const isPaid = payments.some(p => p.installmentNumber === i);
          const status = isPaid ? "Pagada" : isPast(dueDate) ? "Vencida" : "Pendiente";
          
          plan.push({
            installmentNumber: i,
            dueDate: dueDate.toLocaleDateString('es-ES'),
            principal: roundedPrincipal,
            interest: roundedInterest,
            total: totalPayment,
            balance: Math.round(outstandingBalance < 0.01 ? 0 : outstandingBalance),
            status: status
          });
        }
    } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
        const installmentsCount = parseInt(loan.customInstallments, 10);
        if (installmentsCount <= 0) return [];

        const principalPerInstallment = principalAmount / installmentsCount;
        let interestPerInstallment = 0;

        if(loan.hasInterest && loan.customInterest) {
            const customInterestValue = parseFloat(loan.customInterest);
            if(loan.interestType === 'porcentaje') {
                interestPerInstallment = (principalAmount * (customInterestValue / 100)) / installmentsCount;
            } else { 
                interestPerInstallment = customInterestValue / installmentsCount;
            }
        }
        
        const roundedPrincipal = Math.round(principalPerInstallment);
        const roundedInterest = Math.round(interestPerInstallment);
        const totalPerInstallment = roundedPrincipal + roundedInterest;
        let outstandingBalance = principalAmount;

        for (let i = 1; i <= installmentsCount; i++) {
            outstandingBalance -= principalPerInstallment;
            const dueDate = addMonths(startDate, i);
            const isPaid = payments.some(p => p.installmentNumber === i);
            const status = isPaid ? "Pagada" : isPast(dueDate) ? "Vencida" : "Pendiente";
            
            plan.push({
                installmentNumber: i,
                dueDate: dueDate.toLocaleDateString('es-ES'),
                principal: roundedPrincipal,
                interest: roundedInterest,
                total: totalPerInstallment,
                balance: Math.round(outstandingBalance < 0.01 ? 0 : outstandingBalance),
                status: status
            });
        }
    }
    return plan;
  }, [loan, payments]);

  const showPlan = paymentPlan.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Plan de Pagos</DialogTitle>
          <DialogDescription>
            Detalles de amortización para el préstamo de{" "}
            <strong>{loan?.partnerName}</strong> por un monto de{" "}
            <strong>{formatCurrency(loan?.amount || 0)}</strong>.
          </DialogDescription>
        </DialogHeader>
        {showPlan ? (
             <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead className="text-center"># Cuota</TableHead>
                        <TableHead>Fecha Venc.</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="text-right">Capital</TableHead>
                        <TableHead className="text-right">Interés</TableHead>
                        <TableHead className="text-right">Total Cuota</TableHead>
                        <TableHead className="text-right">Saldo Pendiente</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {paymentPlan.map((p) => (
                        <TableRow key={p.installmentNumber}>
                        <TableCell className="text-center font-medium">{p.installmentNumber}</TableCell>
                        <TableCell>{p.dueDate}</TableCell>
                        <TableCell className="text-center">
                            <Badge variant={p.status === 'Pagada' ? 'default' : p.status === 'Vencida' ? 'destructive' : 'secondary'}
                                   className={cn(p.status === 'Pagada' && "bg-green-600 text-white")}>
                                {p.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(p.principal)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.interest)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(p.total)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.balance)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
        ) : (
            <div className="py-8 text-center text-muted-foreground">
                No hay un plan de pagos aplicable para este tipo de préstamo (ej. Abono Libre o sin cuotas definidas).
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
