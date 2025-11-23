
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Installment } from "./abonos-vencidos";

type PayInstallmentDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  installment: Installment;
  onConfirm: (installment: Installment, paymentDate: Date) => void;
};

export function PayInstallmentDialog({
  isOpen,
  onOpenChange,
  installment,
  onConfirm,
}: PayInstallmentDialogProps) {
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const handleConfirm = () => {
    if (paymentDate) {
        onConfirm(installment, paymentDate);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pago de Cuota</DialogTitle>
          <DialogDescription>
            Seleccione la fecha en que se realizó el pago para la cuota #{installment.installmentNumber} de{" "}
            <strong>{installment.partnerName}</strong> por{" "}
            <strong>{formatCurrency(installment.total)}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
            <Calendar
                mode="single"
                selected={paymentDate}
                onSelect={setPaymentDate}
                className="rounded-md border"
                locale={es}
                initialFocus
            />
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!paymentDate}>
                Confirmar Pago
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
