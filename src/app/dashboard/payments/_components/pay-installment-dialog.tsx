
"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDaysInMonth } from 'date-fns';
import type { Installment } from "./abonos-vencidos";

type PayInstallmentDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  installment: Installment;
  onConfirm: (installment: Installment, paymentDate: Date) => void;
};

const months = [
    { value: 0, label: "Enero" }, { value: 1, label: "Febrero" }, { value: 2, label: "Marzo" },
    { value: 3, label: "Abril" }, { value: 4, label: "Mayo" }, { value: 5, label: "Junio" },
    { value: 6, label: "Julio" }, { value: 7, label: "Agosto" }, { value: 8, label: "Septiembre" },
    { value: 9, label: "Octubre" }, { value: 10, label: "Noviembre" }, { value: 11, label: "Diciembre" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 20 }, (_, i) => currentYear - 10 + i);


export function PayInstallmentDialog({
  isOpen,
  onOpenChange,
  installment,
  onConfirm,
}: PayInstallmentDialogProps) {
  const [selectedDay, setSelectedDay] = useState<number>(installment.dueDate.getDate());
  const [selectedMonth, setSelectedMonth] = useState<number>(installment.dueDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(installment.dueDate.getFullYear());
  
  const daysInMonth = useMemo(() => {
    return getDaysInMonth(new Date(selectedYear, selectedMonth));
  }, [selectedYear, selectedMonth]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const handleConfirm = () => {
    // Create new date, ensuring day is valid for the selected month/year
    const day = Math.min(selectedDay, daysInMonth);
    const newPaymentDate = new Date(selectedYear, selectedMonth, day);
    onConfirm(installment, newPaymentDate);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Pago de Cuota</DialogTitle>
          <DialogDescription>
            Ajuste la fecha de pago para la cuota #{installment.installmentNumber} de{" "}
            <strong>{installment.partnerName}</strong> por{" "}
            <strong>{formatCurrency(installment.total)}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center items-center gap-2 py-4">
             <Select
                value={String(selectedDay)}
                onValueChange={(val) => setSelectedDay(Number(val))}
                >
                <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Día" />
                </SelectTrigger>
                <SelectContent>
                   {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                     <SelectItem key={day} value={String(day)}>
                       {day}
                     </SelectItem>
                   ))}
                </SelectContent>
            </Select>
             <Select
                value={String(selectedMonth)}
                onValueChange={(val) => setSelectedMonth(Number(val))}
                >
                <SelectTrigger className="flex-1">
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
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleConfirm}>
                Confirmar Pago
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

