
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { startOfMonth, endOfMonth } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
};

type Payment = {
  id: string;
  partnerId: string;
  partnerName?: string;
  installmentNumber: number;
  amount: number;
  paymentDate: Timestamp;
};

const months = [
  { value: 0, label: "Enero" }, { value: 1, label: "Febrero" }, { value: 2, label: "Marzo" },
  { value: 3, label: "Abril" }, { value: 4, label: "Mayo" }, { value: 5, label: "Junio" },
  { value: 6, label: "Julio" }, { value: 7, label: "Agosto" }, { value: 8, label: "Septiembre" },
  { value: 9, label: "Octubre" }, { value: 10, label: "Noviembre" }, { value: 11, label: "Diciembre" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export function CuotasPagadasReport() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);

  const partners: Partner[] = useMemo(
    () => partnersCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner)) || [],
    [partnersCol]
  );

  const allPayments: Payment[] = useMemo(
    () =>
      paymentsCol?.docs.map((doc) => {
        const data = doc.data();
        const partner = partners.find((p) => p.id === data.partnerId);
        return {
          id: doc.id,
          ...data,
          partnerName: partner ? `${partner.firstName} ${partner.lastName}` : "Desconocido",
        } as Payment;
      }) || [],
    [paymentsCol, partners]
  );
  
  const filteredPayments = useMemo(() => {
    const filterStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
    const filterEndDate = endOfMonth(new Date(selectedYear, selectedMonth));
    return allPayments.filter((p) => {
        const paymentDate = p.paymentDate.toDate();
        return paymentDate >= filterStartDate && paymentDate <= filterEndDate;
    });
  }, [allPayments, selectedMonth, selectedYear]);

  const totalPagado = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + p.amount, 0);
  }, [filteredPayments]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => date.toLocaleString("es-ES");

  const isLoading = loadingPartners || loadingPayments;

  return (
    <>
      <div className="flex items-center gap-4">
        <Select
          value={String(selectedMonth)}
          onValueChange={(val) => setSelectedMonth(Number(val))}
        >
          <SelectTrigger className="w-[180px]">
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

      {isLoading ? (
        <p>Cargando reporte...</p>
      ) : (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Socio</TableHead>
                    <TableHead>Fecha de Pago</TableHead>
                    <TableHead className="text-center"># Cuota</TableHead>
                    <TableHead className="text-right">Monto Pagado</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredPayments.length > 0 ? (
                    filteredPayments.sort((a,b) => b.paymentDate.toMillis() - a.paymentDate.toMillis()).map((payment) => (
                        <TableRow key={payment.id}>
                            <TableCell className="font-medium">{payment.partnerName}</TableCell>
                            <TableCell>{formatDate(payment.paymentDate.toDate())}</TableCell>
                            <TableCell className="text-center">{payment.installmentNumber}</TableCell>
                            <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center">
                            No hay pagos registrados para este período.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            {filteredPayments.length > 0 && (
                 <TableFooter>
                    <TableRow className="bg-muted/50 font-medium hover:bg-muted/60">
                        <TableCell colSpan={3} className="text-right font-bold text-base">Total Pagado en el Período</TableCell>
                        <TableCell className="text-right font-bold text-base text-green-700">{formatCurrency(totalPagado)}</TableCell>
                    </TableRow>
                 </TableFooter>
            )}
        </Table>
      )}
    </>
  );
}
