
"use client";

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
import { addMonths } from "date-fns";
import type { Loan } from "../page";

type PaymentPlanDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan | null;
};

type Installment = {
  installmentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  total: number;
  balance: number;
};

export function PaymentPlanDialog({
  isOpen,
  onOpenChange,
  loan,
}: PaymentPlanDialogProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const calculatePaymentPlan = (loanData: Loan): Installment[] => {
    const plan: Installment[] = [];
    if (!loanData) return plan;

    const principalAmount = loanData.amount;
    const startDate = new Date(loanData.startDate.seconds * 1000);
    
    if (loanData.loanType === 'estandar' && loanData.installments && loanData.interestRate) {
        const installmentsCount = parseInt(loanData.installments, 10);
        const monthlyInterestRate = parseFloat(loanData.interestRate) / 100;
        const principalPerInstallment = principalAmount / installmentsCount;
        let outstandingBalance = principalAmount;

        for (let i = 1; i <= installmentsCount; i++) {
          const interestForMonth = outstandingBalance * monthlyInterestRate;
          const roundedPrincipal = Math.round(principalPerInstallment);
          const roundedInterest = Math.round(interestForMonth);
          const totalPayment = roundedPrincipal + roundedInterest;
          
          outstandingBalance -= principalPerInstallment;
          
          plan.push({
            installmentNumber: i,
            dueDate: addMonths(startDate, i).toLocaleDateString('es-ES'),
            principal: roundedPrincipal,
            interest: roundedInterest,
            total: totalPayment,
            balance: Math.round(outstandingBalance < 0.01 ? 0 : outstandingBalance),
          });
        }
    } else if (loanData.loanType === 'personalizado' && loanData.paymentType === 'cuotas' && loanData.customInstallments) {
        const installmentsCount = parseInt(loanData.customInstallments, 10);
        if (installmentsCount <= 0) return [];

        const principalPerInstallment = principalAmount / installmentsCount;
        let interestPerInstallment = 0;

        if(loanData.hasInterest && loanData.customInterest) {
            const customInterestValue = parseFloat(loanData.customInterest);
            if(loanData.interestType === 'porcentaje') {
                // Assuming simple interest over the total amount, distributed over installments
                interestPerInstallment = (principalAmount * (customInterestValue / 100)) / installmentsCount;
            } else { // 'fijo'
                interestPerInstallment = customInterestValue / installmentsCount;
            }
        }
        
        const roundedPrincipal = Math.round(principalPerInstallment);
        const roundedInterest = Math.round(interestPerInstallment);
        const totalPerInstallment = roundedPrincipal + roundedInterest;
        let outstandingBalance = principalAmount;

        for (let i = 1; i <= installmentsCount; i++) {
            outstandingBalance -= principalPerInstallment;
            plan.push({
                installmentNumber: i,
                dueDate: addMonths(startDate, i).toLocaleDateString('es-ES'),
                principal: roundedPrincipal,
                interest: roundedInterest,
                total: totalPerInstallment,
                balance: Math.round(outstandingBalance < 0.01 ? 0 : outstandingBalance),
            });
        }
    }


    return plan;
  };

  const paymentPlan = loan ? calculatePaymentPlan(loan) : [];
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
