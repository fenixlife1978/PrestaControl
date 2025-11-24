
"use client";

import { useState, useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, doc, deleteDoc, Timestamp, query, where, getDocs, writeBatch } from "firebase/firestore";
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

type Loan = {
  id: string;
  status: "Aprobado" | "Pendiente" | "Rechazado" | "Pagado";
  loanType: "estandar" | "personalizado";
  installments?: string;
  paymentType?: "cuotas" | "libre";
  customInstallments?: string;
};

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
  const [isVerifying, setIsVerifying] = useState(false);

  const [loansCol, loadingLoans] = useCollection(
    firestore ? collection(firestore, "loans") : null
  );
  const [partnersCol, loadingPartners] = useCollection(
    firestore ? collection(firestore, "partners") : null
  );
  const [paymentsCol, loadingPayments] = useCollection(
    firestore ? collection(firestore, "payments") : null
  );

  const allLoans: Loan[] = useMemo(
    () => loansCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Loan)) || [],
    [loansCol]
  );

  const partners: Partner[] = useMemo(
    () =>
      partnersCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner)) || [],
    [partnersCol]
  );

  const allPayments: Payment[] = useMemo(
    () => paymentsCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Payment)) || [],
    [paymentsCol]
  );
  
  const individualPayments: Payment[] = useMemo(
    () =>
      allPayments
      .filter(doc => doc.type === 'payment') 
      .map((doc) => {
        const partner = partners.find((p) => p.id === doc.partnerId);
        return {
          ...doc,
          partnerName: partner ? `${partner.firstName} ${partner.lastName}` : "Desconocido",
        } as Payment;
      }),
    [allPayments, partners]
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

  const handleVerifyPaidLoans = async () => {
    if (!firestore) return;
    setIsVerifying(true);
    try {
      const activeLoans = allLoans.filter(l => l.status === 'Aprobado');
      const paymentsByLoan = allPayments.reduce((acc, p) => {
        if(p.type === 'payment') {
            if (!acc[p.loanId]) {
            acc[p.loanId] = [];
            }
            acc[p.loanId].push(p);
        }
        return acc;
      }, {} as {[key: string]: Payment[]});

      const batch = writeBatch(firestore);
      let updatedCount = 0;

      for (const loan of activeLoans) {
        let totalInstallments = 0;
        if (loan.loanType === 'estandar' && loan.installments) {
          totalInstallments = parseInt(loan.installments, 10);
        } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
          totalInstallments = parseInt(loan.customInstallments, 10);
        }

        if (totalInstallments > 0) {
          const paidInstallmentsCount = paymentsByLoan[loan.id]?.length || 0;
          if (paidInstallmentsCount >= totalInstallments) {
            const loanRef = doc(firestore, 'loans', loan.id);
            batch.update(loanRef, { status: 'Pagado' });
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
        toast({
            title: "Verificación Completada",
            description: `${updatedCount} préstamo(s) han sido actualizados a estado "Pagado".`,
        });
      } else {
         toast({
            title: "Verificación Completada",
            description: "No se encontraron préstamos para actualizar. Todos los estados están correctos.",
        });
      }

    } catch (e) {
        console.error("Error verificando préstamos:", e);
        toast({
            title: "Error de Verificación",
            description: "Ocurrió un error al verificar y actualizar los préstamos.",
            variant: "destructive",
        });
    } finally {
        setIsVerifying(false);
    }
  }

  const openRevertClosureDialog = (month: string, year: number, closureId: string) => {
    setClosureToRevert({ month, year, closureId });
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleString("es-ES");
  };
  
  const isLoading = loadingPartners || loadingPayments || loadingLoans;

  return (
    <>
      <div className="grid gap-8">
        <Card>
            <CardHeader>
                <CardTitle>Validación de Préstamos Finalizados</CardTitle>
                <CardDescription>
                Esta herramienta recorre todos los préstamos activos y verifica si todas sus cuotas han sido pagadas. Si es así, actualiza su estado a "Pagado" automáticamente. Úsela para corregir inconsistencias de datos.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleVerifyPaidLoans} disabled={isLoading || isVerifying}>
                    {isVerifying ? "Verificando..." : "Verificar y Actualizar Préstamos Pagados"}
                </Button>
            </CardContent>
        </Card>

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
                          {individualPayments.length > 0 ? (
                              individualPayments.sort((a,b) => b.paymentDate.toMillis() - a.paymentDate.toMillis()).map((payment) => (
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
                <Button variant="outline" onClick={() => openRevertClosureDialog("Marzo", 2025, "2025-03")}>
                    Revertir Cierre Marzo 2025
                </Button>
                <Button variant="outline" onClick={() => openRevertClosureDialog("Abril", 2025, "2025-04")}>
                    Revertir Cierre Abril 2025
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
