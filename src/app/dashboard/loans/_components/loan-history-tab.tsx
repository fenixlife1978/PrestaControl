"use client";

import { useMemo, useState, useRef } from "react";
import {
  MoreHorizontal,
  Search,
  X,
  FileText,
  CalendarClock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";
import {
  collection,
  Timestamp,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { AddLoanFlow } from "./add-loan-flow";
import { useToast } from "@/hooks/use-toast";
import { PaymentPlanDialog } from "./payment-plan-dialog";
import type { Loan } from "../types";
import { generateLoanReceipt } from "../utils/generate-loan-receipt";
import { ChangeStartDateDialog } from "./change-start-date-dialog";

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
  cedula?: string;
};

type Payment = {
  id: string;
  loanId: string;
  installmentNumber: number;
  type: "payment" | "closure";
};

type CompanySettings = {
  name?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  rif?: string;
  email?: string;
};

export function LoanHistoryTab() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentPlanOpen, setPaymentPlanOpen] = useState(false);
  const [isDateChangeOpen, setIsDateChangeOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);

  const [loans] = useCollection(
    firestore ? collection(firestore, "loans") : null
  );
  const [partnersCol] = useCollection(
    firestore ? collection(firestore, "partners") : null
  );
  const [paymentsCol] = useCollection(
    firestore ? collection(firestore, "payments") : null
  );
  const settingsRef = firestore
    ? doc(firestore, "company_settings", "main")
    : null;
  const [settingsDoc] = useDocument(settingsRef);

  const partners: Partner[] = useMemo(
    () =>
      partnersCol
        ? partnersCol.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Partner)
          )
        : [],
    [partnersCol]
  );

  const payments: Payment[] = useMemo(
    () =>
      paymentsCol
        ? paymentsCol.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Payment)
          )
        : [],
    [paymentsCol]
  );

  const companySettings: CompanySettings | null = useMemo(() => {
    return settingsDoc?.exists()
      ? (settingsDoc.data() as CompanySettings)
      : null;
  }, [settingsDoc]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" }).format(value);

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "N/A";
    try {
      return new Date(timestamp.seconds * 1000).toLocaleDateString("es-ES");
    } catch {
      return "Fecha inválida";
    }
  };

  const filteredPartners = useMemo(
    () =>
      partners.filter((partner) =>
        `${partner.firstName} ${partner.lastName} ${partner.cedula || ""}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      ),
    [partners, searchQuery]
  );

  const loansData: Loan[] = useMemo(() => {
    if (!loans || !selectedPartner) return [];
    return loans.docs
      .map((docSnap) => {
        const data = docSnap.data() as any;
        const partner = partners.find((p) => p.id === data.partnerId);
        return {
          id: docSnap.id,
          ...data,
          partnerName: partner
            ? `${partner.firstName} ${partner.lastName}`
            : "Desconocido",
        } as Loan;
      })
      .filter((loan) => loan.partnerId === selectedPartner.id)
      .sort((a, b) => {
        const aTs = (a as any).createdAt as Timestamp | undefined;
        const bTs = (b as any).createdAt as Timestamp | undefined;
        if (aTs && bTs) return bTs.toMillis() - aTs.toMillis();
        return 0;
      });
  }, [loans, partners, selectedPartner]);

  const handlePartnerSelect = (partner: Partner) => {
    setSelectedPartner(partner);
    setSearchQuery("");
  };

  const handleClearPartner = () => {
    setSelectedPartner(null);
    setSelectedLoan(null);
    setIsDialogOpen(false);
    setPaymentPlanOpen(false);
    setIsDateChangeOpen(false);
  };

  const handleOpenEditDialog = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsDialogOpen(true);
  };

  const handleOpenPaymentPlan = (loan: Loan) => {
    setSelectedLoan(loan);
    setPaymentPlanOpen(true);
  };

  const openChangeDateDialog = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsDateChangeOpen(true);
  };

  const handleLoanEditSubmit = async (values: any) => {
    if (!firestore || !selectedLoan) return;
    try {
      const loanRef = doc(firestore, "loans", selectedLoan.id);
      await updateDoc(loanRef, {
        amount: parseFloat(values.amount || "0"),
        startDate: Timestamp.fromDate(values.startDate),
        loanType: values.loanType,
        interestRate: values.interestRate,
        installments: values.installments,
      } as any);

      toast({
        title: "Préstamo modificado",
        description: "El préstamo ha sido actualizado exitosamente.",
      });
      setIsDialogOpen(false);
      setSelectedLoan(null);
      triggerRef.current?.focus();
    } catch {
      toast({
        title: "Error",
        description: "No se pudo modificar el préstamo.",
        variant: "destructive",
      });
    }
  };

  const handleChangeDateSubmit = async (newDate: Date) => {
    if (!firestore || !selectedLoan) return;
    try {
      const loanRef = doc(firestore, "loans", selectedLoan.id);
      await updateDoc(loanRef, {
        startDate: Timestamp.fromDate(newDate),
      });
      toast({
        title: "Fecha actualizada",
        description:
          "La fecha de inicio del préstamo ha sido actualizada correctamente.",
      });
      setIsDateChangeOpen(false);
      setSelectedLoan(null);
      triggerRef.current?.focus();
    } catch {
      toast({
        title: "Error",
        description: "No se pudo actualizar la fecha del préstamo.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateReceipt = (loan: Loan) => {
    const partner = partners.find((p) => p.id === loan.partnerId);
    if (!partner) {
      toast({
        title: "Error",
        description: "Socio no encontrado para generar el recibo.",
        variant: "destructive",
      });
      return;
    }
    generateLoanReceipt(loan, partner, companySettings);
  };

  const handleDeleteLoan = async () => {
    if (!loanToDelete || !firestore) return;
    try {
      await deleteDoc(doc(firestore, "loans", loanToDelete));
      toast({
        title: "Préstamo eliminado",
        description: "El préstamo ha sido eliminado correctamente.",
      });
      setLoanToDelete(null);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo eliminar el préstamo.",
        variant: "destructive",
      });
      setLoanToDelete(null);
    }
  };

  const getStatusBadge = (status: Loan["status"]) => {
    switch (status) {
      case "Aprobado":
        return <Badge className="bg-green-600/80 text-white">Activo</Badge>;
      case "Pagado":
        return <Badge className="bg-blue-500/80 text-white">Finalizado</Badge>;
      case "Pendiente":
        return <Badge variant="secondary">Pendiente</Badge>;
      case "Rechazado":
        return <Badge variant="destructive">Rechazado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Vista: seleccionar socio
  if (!selectedPartner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Buscar socio</CardTitle>
          <CardDescription>
            Seleccione un socio para ver su historial de préstamos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-w-lg mx-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar socio..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {filteredPartners.map((partner) => (
                <Button
                  key={partner.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handlePartnerSelect(partner)}
                >
                  {partner.firstName} {partner.lastName} (
                  {partner.cedula || "Sin Cédula"})
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Vista: historial de préstamos del socio seleccionado
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Historial de préstamos</CardTitle>
            <CardDescription>
              {selectedPartner.firstName} {selectedPartner.lastName} (
              {selectedPartner.cedula || "Sin Cédula"})
            </CardDescription>
          </div>
          <Button variant="ghost" onClick={handleClearPartner}>
            <X className="mr-2 h-4 w-4" />
            Limpiar selección
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loansData.length > 0 ? (
                loansData.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      {loan.createdAt
                        ? formatDate(loan.createdAt as Timestamp)
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {typeof loan.amount === "number"
                        ? formatCurrency(loan.amount)
                        : formatCurrency(parseFloat(String(loan.amount || 0)))}
                    </TableCell>
                    <TableCell>{loan.loanType || "—"}</TableCell>
                    <TableCell>{getStatusBadge(loan.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            ref={triggerRef}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Abrir menú</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => handleOpenPaymentPlan(loan)}
                          >
                            Ver detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenEditDialog(loan)}
                          >
                            Modificar
                          </DropdownMenuItem>
                          {loan.loanType === "personalizado" &&
                            loan.status === "Aprobado" && (
                              <DropdownMenuItem
                                onClick={() => openChangeDateDialog(loan)}
                              >
                                <CalendarClock className="mr-2 h-4 w-4" />
                                Cambiar fecha
                              </DropdownMenuItem>
                            )}
                          <DropdownMenuItem
                            onClick={() => handleGenerateReceipt(loan)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Generar recibo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setLoanToDelete(loan.id)}
                          >
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Este socio no tiene préstamos registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="pt-6">
          <div className="text-xs text-muted-foreground">
            Mostrando <strong>{loansData.length}</strong> de{" "}
            <strong>{loansData.length}</strong> préstamos
          </div>
        </CardFooter>
      </Card>

      {/* Diálogo: Modificar préstamo */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open: boolean) => {
          setIsDialogOpen(open);
          if (!open) triggerRef.current?.focus();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modificar préstamo</DialogTitle>
            <DialogDescription>
              {`Editando el préstamo de ${selectedLoan?.partnerName || ""}.`}
            </DialogDescription>
          </DialogHeader>
          <AddLoanFlow
            partners={selectedPartner ? [selectedPartner] : partners}
            onSubmit={handleLoanEditSubmit}
            loan={selectedLoan as any}
            mode="edit"
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo: Plan de pagos / detalles */}
      {selectedLoan && (
        <PaymentPlanDialog
          isOpen={paymentPlanOpen}
          onOpenChange={(open: boolean) => {
            setPaymentPlanOpen(open);
            if (!open) triggerRef.current?.focus();
          }}
          loan={selectedLoan}
          payments={payments.filter((p) => p.loanId === selectedLoan.id)}
        />
      )}

      {/* Diálogo: Cambiar fecha de inicio */}
      {selectedLoan && (
        <ChangeStartDateDialog
          isOpen={isDateChangeOpen}
          onOpenChange={(open: boolean) => {
            setIsDateChangeOpen(open);
            if (!open) triggerRef.current?.focus();
          }}
          loan={selectedLoan}
          onSubmit={handleChangeDateSubmit}
        />
      )}

      {/* Confirmación: Eliminar préstamo */}
      <AlertDialog
        open={!!loanToDelete}
        onOpenChange={(open: boolean) => {
          if (!open) setLoanToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Está seguro de eliminar el préstamo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El préstamo se eliminará
              permanentemente de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLoanToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLoan}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
