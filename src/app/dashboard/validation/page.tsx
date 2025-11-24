
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, doc, deleteDoc, Timestamp, query, where, getDocs } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
};

type Payment = {
  id: string;
  loanId: string;
  partnerId: string;
  partnerName?: string;
  installmentNumber: number;
  amount: number;
  paymentDate: Timestamp;
  type?: 'payment' | 'closure';
};

type MonthClosureRevert = {
    month: string;
    year: number;
    closureId: string; // YYYY-MM
}

export default function ValidationPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [paymentToRevert, setPaymentToRevert] = useState<Payment | null>(null);
  const [closureToRevert, setClosureToRevert] = useState<MonthClosureRevert | null>(null);

  const [partnersCol, loadingPartners] = useCollection(
    firestore ? collection(firestore, "partners") : null
  );
  const [paymentsCol, loadingPayments] = useCollection(
    firestore ? collection(firestore, "payments") : null
  );

  const partners: Partner[] = useMemo(
    () =>
      partnersCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner)) || [],
    [partnersCol]
  );

  const payments: Payment[] = useMemo(
    () =>
      paymentsCol?.docs
      .filter(doc => doc.data().type === 'payment') 
      .map((doc) => {
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
  
  const handleRevertPayment = async () => {
    if (!firestore || !paymentToRevert) return;
    try {
        await deleteDoc(doc(firestore, "payments", paymentToRevert.id));
        toast({
            title: "Pago Revertido",
            description: "El pago ha sido revertido exitosamente. La cuota ahora está pendiente.",
        });
        setPaymentToRevert(null);
    } catch(e) {
        console.error("Error al revertir el pago:", e);
        toast({
            title: "Error",
            description: "No se pudo revertir el pago.",
            variant: "destructive",
        });
        setPaymentToRevert(null);
    }
  };

  const handleRevertMonthClosure = async () => {
    if (!firestore || !closureToRevert) return;
    try {
        const q = query(
            collection(firestore, "payments"), 
            where("type", "==", "closure"), 
            where("closureMonth", "==", closureToRevert.closureId)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
             toast({
                title: "Cierre no encontrado",
                description: `El cierre para ${closureToRevert.month} ${closureToRevert.year} no fue encontrado o ya fue revertido.`,
                variant: "destructive"
            });
            setClosureToRevert(null);
            return;
        }

        const docToDelete = querySnapshot.docs[0];
        await deleteDoc(docToDelete.ref);

        toast({
            title: "Cierre de Mes Revertido",
            description: `El cierre para ${closureToRevert.month} ${closureToRevert.year} ha sido revertido. Ahora puede registrar pagos para ese mes.`,
        });

    } catch (e) {
         console.error("Error al revertir el cierre:", e);
        toast({
            title: "Error",
            description: "No se pudo revertir el cierre del mes.",
            variant: "destructive",
        });
    } finally {
        setClosureToRevert(null);
    }
  };

  const openRevertClosureDialog = (month: string, year: number, closureId: string) => {
    setClosureToRevert({ month, year, closureId });
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleString("es-ES");
  };
  
  const isLoading = loadingPartners || loadingPayments;

  return (
    <>
      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Reversión de Pagos</CardTitle>
            <CardDescription>
              Aquí puede revertir pagos de cuotas individuales que se hayan registrado por error.
            </CardDescription>
          </CardHeader>
          <CardContent>
              {isLoading && <p>Cargando pagos...</p>}
              {!isLoading && (
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Socio</TableHead>
                              <TableHead>Fecha de Pago</TableHead>
                              <TableHead className="text-center"># Cuota</TableHead>
                              <TableHead className="text-right">Monto</TableHead>
                              <TableHead className="text-right">Acción</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {payments.length > 0 ? (
                              payments.sort((a,b) => b.paymentDate.toMillis() - a.paymentDate.toMillis()).map((payment) => (
                                  <TableRow key={payment.id}>
                                      <TableCell className="font-medium">{payment.partnerName}</TableCell>
                                      <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                                      <TableCell className="text-center">{payment.installmentNumber}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                                      <TableCell className="text-right">
                                          <Button variant="destructive" size="sm" onClick={() => setPaymentToRevert(payment)}>
                                              Revertir
                                          </Button>
                                      </TableCell>
                                  </TableRow>
                              ))
                          ) : (
                              <TableRow>
                                  <TableCell colSpan={5} className="text-center">
                                      No hay pagos de cuotas registrados.
                                  </TableCell>
                              </TableRow>
                          )}
                      </TableBody>
                  </Table>
              )}
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Reversión de Cierre de Mes</CardTitle>
                <CardDescription>
                Use esta sección para revertir el cierre de un mes específico y volver a habilitar los pagos.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4">
                <Button variant="outline" onClick={() => openRevertClosureDialog("Octubre", 2024, "2024-10")}>
                    Revertir Cierre Octubre 2024
                </Button>
                <Button variant="outline" onClick={() => openRevertClosureDialog("Noviembre", 2024, "2024-11")}>
                    Revertir Cierre Noviembre 2024
                </Button>
            </CardContent>
        </Card>
      </div>
      
      <AlertDialog open={!!paymentToRevert} onOpenChange={() => setPaymentToRevert(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Está seguro de revertir este pago?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción no se puede deshacer. El registro del pago se eliminará permanentemente y la cuota volverá a estar pendiente.
                    <br/><br/>
                    <strong>Socio:</strong> {paymentToRevert?.partnerName}<br/>
                    <strong>Monto:</strong> {formatCurrency(paymentToRevert?.amount || 0)}<br/>
                    <strong>Cuota:</strong> #{paymentToRevert?.installmentNumber}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPaymentToRevert(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRevertPayment} className="bg-destructive hover:bg-destructive/90">
                    Confirmar Reversión
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!closureToRevert} onOpenChange={() => setClosureToRevert(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Revertir Cierre de Mes?</AlertDialogTitle>
                <AlertDialogDescription>
                    ¿Está seguro de que desea revertir el cierre de <strong>{closureToRevert?.month} {closureToRevert?.year}</strong>?
                    <br/><br/>
                    Esta acción reabrirá el mes, permitiendo que se registren nuevos pagos y que las cuotas pendientes de ese período ya no aparezcan como vencidas.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setClosureToRevert(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRevertMonthClosure} className="bg-destructive hover:bg-destructive/90">
                    Confirmar Reversión de Cierre
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
