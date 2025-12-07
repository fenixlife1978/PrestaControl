
"use client";

import { useState, useMemo, useEffect } from "react";
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
import { getDaysInMonth, format } from "date-fns";
import { es } from "date-fns/locale";
import type { Loan } from "../types";
import { Timestamp } from "firebase/firestore";

type ChangeStartDateDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan;
  onSubmit: (newDate: Date) => void;
};

const months = [
    { value: 0, label: "Enero" }, { value: 1, label: "Febrero" }, { value: 2, label: "Marzo" },
    { value: 3, label: "Abril" }, { value: 4, label: "Mayo" }, { value: 5, label: "Junio" },
    { value: 6, label: "Julio" }, { value: 7, label: "Agosto" }, { value: 8, label: "Septiembre" },
    { value: 9, label: "Octubre" }, { value: 10, label: "Noviembre" }, { value: 11, label: "Diciembre" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 20 }, (_, i) => currentYear - 10 + i);

export function ChangeStartDateDialog({
  isOpen,
  onOpenChange,
  loan,
  onSubmit,
}: ChangeStartDateDialogProps) {

  const initialDate = loan.startDate instanceof Timestamp ? loan.startDate.toDate() : new Date();

  const [selectedDay, setSelectedDay] = useState<number>(initialDate.getDate());
  const [selectedMonth, setSelectedMonth] = useState<number>(initialDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(initialDate.getFullYear());

  useEffect(() => {
    if (loan) {
        const date = loan.startDate instanceof Timestamp ? loan.startDate.toDate() : new Date();
        setSelectedDay(date.getDate());
        setSelectedMonth(date.getMonth());
        setSelectedYear(date.getFullYear());
    }
  }, [loan]);

  const daysInMonth = useMemo(() => {
    return getDaysInMonth(new Date(selectedYear, selectedMonth));
  }, [selectedYear, selectedMonth]);

  const handleConfirm = () => {
    const day = Math.min(selectedDay, daysInMonth);
    const newDate = new Date(selectedYear, selectedMonth, day);
    onSubmit(newDate);
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambiar Fecha de Inicio del Préstamo</DialogTitle>
          <DialogDescription>
            Seleccione la nueva fecha de inicio para el préstamo de{" "}
            <strong>{loan.partnerName}</strong> por un monto de{" "}
            <strong>{formatCurrency(loan.amount)}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 py-4">
             <Select
                value={String(selectedDay)}
                onValueChange={(val) => setSelectedDay(Number(val))}
                >
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Mes" />
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
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Año" />
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
        <p className="text-center text-sm text-muted-foreground">
            Fecha seleccionada: {`${selectedDay} de ${months[selectedMonth].label} de ${selectedYear}`}
        </p>
        <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleConfirm}>
                Guardar Nueva Fecha
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
