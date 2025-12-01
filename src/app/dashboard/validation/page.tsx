
"use client";

import { useState, useMemo } from "react";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { generatePaymentReceipt, type PaymentReceiptData } from "../payments/utils/generate-payment-receipt";
import jsPDF from "jspdf";
import "jspdf-autotable";


type Loan = {
  id: string;
  amount: number;
  startDate: Timestamp;
  status: "Aprobado" | "Pendiente" | "Rechazado" | "Pagado";
  loanType: "estandar" | "personalizado";
  installments?: string;
  paymentType?: "cuotas" | "libre";
  customInstallments?: string;
  interestRate?: string;
  hasInterest?: boolean;
  interestType?: "porcentaje" | "fijo";
  customInterest?: string;
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
  partnerId: string;
  partnerName?: string;
  installmentNumber: number;
  amount: number;
  paymentDate: Timestamp;
  paymentNumber: number;
  type?: 'payment' | 'closure';
  closureMonth?: string;
};

type MonthClosureRevert = {
    month: string;
    year: number;
    closureId: string; // YYYY-MM
}

type CompanySettings = {
    name?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    rif?: string;
    email?: string;
};

export default function ValidationPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [paymentToRevert, setPaymentToRevert] = useState<Payment | null>(null);
  const [closureToRevert, setClosureToRevert] = useState<MonthClosureRevert | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<Payment | null>(null);

  const [loansCol, loadingLoans] = useCollection(
    firestore ? collection(firestore, "loans") : null
  );
  const [partnersCol, loadingPartners] = useCollection(
    firestore ? collection(firestore, "partners") : null
  );
  const [paymentsCol, loadingPayments] = useCollection(
    firestore ? collection(firestore, "payments") : null
  );
  const settingsRef = firestore ? doc(firestore, 'company_settings', 'main') : null;
  const [settingsDoc, loadingSettings] = useDocument(settingsRef);


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

  const companySettings: CompanySettings | null = useMemo(() => {
    return settingsDoc?.exists() ? settingsDoc.data() as CompanySettings : null
  }, [settingsDoc]);
  
  const closedMonths = useMemo(() => {
    return allPayments
      .filter(p => p.type === 'closure' && p.closureMonth)
      .map(p => {
        const [year, month] = p.closureMonth!.split('-');
        return { 
          month: format(new Date(Number(year), Number(month) - 1), 'MMMM', { locale: es }),
          year: Number(year),
          closureId: p.closureMonth!
        };
      })
      .sort((a, b) => b.year - a.year || b.month.localeCompare(a.month));
  }, [allPayments]);

  const handleGenerateReceipt = async (payment: Payment) => {
    if (!payment) return;
    
    const partner = partners.find(p => p.id === payment.partnerId);
    if (!partner) {
      toast({ title: "Error", description: "Socio no encontrado", variant: "destructive" });
      return;
    }

    const receiptData: PaymentReceiptData = {
        receiptNumber: payment.paymentNumber,
        paymentDate: payment.paymentDate.toDate(),
        partner: partner,
        installmentsPaid: [
            {
                loanId: payment.loanId,
                installmentNumber: payment.installmentNumber,
                amount: payment.amount,
            },
        ],
        totalPaid: payment.amount,
    };
    
    await generatePaymentReceipt(receiptData, allLoans, companySettings);
    setReceiptPreview(null); // Close preview after generation
  };

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
        if(p.type === 'payment' && p.loanId) {
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
  
  const isLoading = loadingPartners || loadingPayments || loadingLoans || loadingSettings;
  
  const receiptPreviewDetails = useMemo(() => {
    if (!receiptPreview) return null;
    
    const loan = allLoans.find(l => l.id === receiptPreview.loanId);
    if (!loan) return null;

    const loanStartDate = new Date(loan.startDate.seconds * 1000);
    const dueDate = addMonths(loanStartDate, receiptPreview.installmentNumber);
    let capital = 0;
    let interest = 0;
    const principalAmount = loan.amount;

    if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
        const installmentsCount = parseInt(loan.installments, 10);
        const principalPerInstallment = principalAmount / installmentsCount;
        let outstandingBalance = principalAmount;
        for (let i = 1; i < receiptPreview.installmentNumber; i++) {
            outstandingBalance -= principalPerInstallment;
        }
        interest = Math.round(outstandingBalance * parseFloat(loan.interestRate) / 100);
        capital = Math.round(principalPerInstallment);
    } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
        const installmentsCount = parseInt(loan.customInstallments, 10);
        capital = Math.round(principalAmount / installmentsCount);
        if (loan.hasInterest && loan.customInterest) {
            const customInterestValue = parseFloat(loan.customInterest);
            if (loan.interestType === 'porcentaje') {
                interest = Math.round((principalAmount * (customInterestValue / 100)) / installmentsCount);
            } else {
                interest = Math.round(customInterestValue / installmentsCount);
            }
        }
    } else {
        capital = receiptPreview.amount;
    }

    return {
        ...receiptPreview,
        dueDate, capital, interest
    }
  }, [receiptPreview, allLoans])

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
            <CardTitle>Gestión de Pagos Individuales</CardTitle>
            <CardDescription>
              Aquí puede generar o revertir recibos de pagos individuales que se hayan registrado.
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
                              <TableHead className="text-right">Acciones</TableHead>
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
                                      <TableCell className="text-right space-x-2">
                                           <Button variant="outline" size="sm" onClick={() => setReceiptPreview(payment)}>
                                              Generar Recibo
                                          </Button>
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
                 {isLoading ? <p>Cargando cierres...</p> : 
                    closedMonths.length > 0 ? (
                        closedMonths.map(cm => (
                            <Button key={cm.closureId} variant="outline" onClick={() => openRevertClosureDialog(cm.month, cm.year, cm.closureId)}>
                                Revertir Cierre {cm.month} {cm.year}
                            </Button>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">No hay meses cerrados para revertir.</p>
                    )
                }
            </CardContent>
        </Card>
      </div>
      
      {/* Receipt Preview Dialog */}
      {receiptPreview && receiptPreviewDetails && (
        <Dialog open={!!receiptPreview} onOpenChange={() => setReceiptPreview(null)}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Vista Previa del Recibo de Pago</DialogTitle>
                    <DialogDescription>
                        Revise la información antes de generar el PDF.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                        <div className="text-center flex-1">
                             <h3 className="font-bold text-lg">{companySettings?.name || "Empresa"}</h3>
                             <p className="text-sm text-muted-foreground">{companySettings?.rif}</p>
                             <p className="text-sm text-muted-foreground">{companySettings?.address}</p>
                        </div>
                    </div>
                    <div className="flex justify-between items-start">
                         <div/>
                         <div className="text-right">
                           <p className="font-bold">Recibo de Pago #{String(receiptPreviewDetails.paymentNumber).padStart(8, '0')}</p>
                           <p className="text-sm text-muted-foreground">Fecha: {format(receiptPreviewDetails.paymentDate.toDate(), 'dd/MM/yyyy')}</p>
                        </div>
                    </div>

                    <div className="border-t pt-4 mt-4">
                        <p><strong>Socio:</strong> {receiptPreviewDetails.partnerName}</p>
                         <p><strong>Monto Total Pagado:</strong> {formatCurrency(receiptPreviewDetails.amount)}</p>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead># Cuota</TableHead>
                                <TableHead>Vencimiento</TableHead>
                                <TableHead className="text-right">Capital</TableHead>
                                <TableHead className="text-right">Interés</TableHead>
                                <TableHead className="text-right">Total Pagado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell>{receiptPreviewDetails.installmentNumber}</TableCell>
                                <TableCell>{format(receiptPreviewDetails.dueDate, "dd/MM/yyyy")}</TableCell>
                                <TableCell className="text-right">{formatCurrency(receiptPreviewDetails.capital)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(receiptPreviewDetails.interest)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(receiptPreviewDetails.amount)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setReceiptPreview(null)}>Cancelar</Button>
                    <Button onClick={() => handleGenerateReceipt(receiptPreview)}>Exportar a PDF</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}


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
