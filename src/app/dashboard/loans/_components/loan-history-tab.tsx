
"use client";

import { useState, useRef, useMemo } from "react";
import {
  MoreHorizontal,
  PlusCircle,
  File,
  FileUp,
  Search,
  X,
  History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, addDoc, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { AddLoanFlow } from "./add-loan-flow";
import { useToast } from "@/hooks/use-toast";
import { PaymentPlanDialog } from "./payment-plan-dialog";
import Papa from "papaparse";
import type { Loan } from "../types";


type Partner = {
  id: string;
  firstName: string;
  lastName: string;
  cedula?: string;
}

export function LoanHistoryTab() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentPlanOpen, setPaymentPlanOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);


  const [loans, loading, error] = useCollection(firestore ? collection(firestore, 'loans') : null);
  const [partnersCol] = useCollection(firestore ? collection(firestore, 'partners') : null);
  
  const partners: Partner[] = partnersCol ? partnersCol.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) : [];
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };
  
  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp.seconds * 1000).toLocaleDateString("es-ES");
    } catch(e) {
      console.error("Invalid timestamp:", timestamp);
      return 'Fecha inválida';
    }
  };
  
  const loansData: Loan[] = useMemo(() => {
    if (!loans || !selectedPartner) return [];
    return loans.docs
      .map(doc => {
        const data = doc.data();
        const partner = partners.find(p => p.id === data.partnerId);
        return { 
          id: doc.id, 
          ...data,
          partnerName: partner ? `${partner.firstName} ${partner.lastName}` : "Desconocido"
        } as Loan;
      })
      .filter(loan => loan.partnerId === selectedPartner.id)
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  }, [loans, partners, selectedPartner]);

  const filteredPartners = useMemo(() => partners.filter(partner =>
    `${partner.firstName} ${partner.lastName} ${partner.cedula || ''}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  ), [partners, searchQuery]);

  const handleLoanEditSubmit = async (values: any) => {
     try {
       if (!firestore) throw new Error("Firestore is not initialized");
       if (!selectedLoan) throw new Error("No loan selected for editing");

       const loanData = {
         partnerId: values.partnerId,
         amount: parseFloat(values.amount || "0"),
         startDate: Timestamp.fromDate(values.startDate),
         loanType: values.loanType,
         interestRate: values.interestRate,
         installments: values.installments,
         hasInterest: values.hasInterest,
         interestType: values.interestType,
         customInterest: values.customInterest,
         paymentType: values.paymentType,
         customInstallments: values.customInstallments,
       };
       
       const loanRef = doc(firestore, "loans", selectedLoan.id);
       const updateData = Object.entries(loanData).reduce((acc, [key, value]) => {
          if (value !== undefined) acc[key] = value;
          return acc;
       }, {} as any);

       await updateDoc(loanRef, updateData);
       
       toast({
         title: "Préstamo modificado",
         description: "El préstamo ha sido actualizado exitosamente.",
       });

       setIsDialogOpen(false);
       setSelectedLoan(null);
     } catch (e) {
       console.error("Error updating document: ", e);
       toast({
         title: "Error",
         description: "No se pudo modificar el préstamo.",
         variant: "destructive",
       });
     }
  };

  const openEditDialog = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsDialogOpen(true);
  }

  const handleViewPaymentPlan = (loan: Loan) => {
    setSelectedLoan(loan);
    setPaymentPlanOpen(true);
  }

  const handleDeleteLoan = async () => {
    if (!loanToDelete || !firestore) return;
    try {
      await deleteDoc(doc(firestore, "loans", loanToDelete));
      toast({
        title: "Préstamo eliminado",
        description: "El préstamo ha sido eliminado correctamente.",
      });
      setLoanToDelete(null);
    } catch (e) {
      console.error("Error deleting document: ", e);
      toast({
        title: "Error",
        description: "No se pudo eliminar el préstamo.",
        variant: "destructive",
      });
      setLoanToDelete(null);
    }
  };
  
  const handlePartnerSelect = (partner: Partner) => {
    setSelectedPartner(partner);
    setSearchQuery("");
  };

  const handleClearPartner = () => {
    setSelectedPartner(null);
  };
  
  if (!selectedPartner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Buscar Socio</CardTitle>
          <CardDescription>Seleccione un socio para ver su historial de préstamos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-w-lg mx-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar socio por nombre, apellido o cédula..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
                {partners.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground">No hay socios registrados.</p>
                )}
                {partners.length > 0 && filteredPartners.length === 0 && (
                     <p className="text-center text-sm text-muted-foreground">No se encontraron socios.</p>
                )}
                {filteredPartners.map(partner => (
                    <Button variant="outline" key={partner.id} className="w-full justify-start" onClick={() => handlePartnerSelect(partner)}>
                        {partner.firstName} {partner.lastName} ({partner.cedula || 'Sin Cédula'})
                    </Button>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Historial de Préstamos de {selectedPartner.firstName} {selectedPartner.lastName}</CardTitle>
            <CardDescription>
              Revise y gestione todos los préstamos del socio seleccionado.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleClearPartner} className="h-7 gap-1">
                  <X className="h-3.5 w-3.5" />
                  <span>Cambiar Socio</span>
              </Button>
            </div>
        </CardHeader>
        <CardContent>
          {loading && <p>Cargando préstamos...</p>}
          {error && <p>Error al cargar los préstamos: {error.message}</p>}
          {loansData && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha de Inicio</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loansData.length > 0 ? loansData.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>{formatCurrency(Math.round(loan.amount))}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            loan.status === "Aprobado"
                              ? "default"
                              : loan.status === "Pendiente"
                              ? "secondary"
                              : loan.status === "Pagado"
                              ? "outline"
                              : "destructive"
                          }
                          className={cn(
                              loan.status === "Aprobado" && "bg-green-600/80 text-white",
                              loan.status === "Pagado" && "bg-blue-500/80 text-white"
                          )}
                        >
                          {loan.status}
                        </Badge>
                      </TableCell>
                       <TableCell className="capitalize">{loan.loanType}</TableCell>
                      <TableCell>{formatDate(loan.startDate)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Alternar menú</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleViewPaymentPlan(loan)}>
                                Ver Detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(loan)}>
                                Modificar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => setLoanToDelete(loan.id)}>
                                Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )) : (
                     <TableRow>
                        <TableCell colSpan={5} className="text-center">
                            Este socio no tiene préstamos registrados.
                        </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
              <CardFooter className="pt-6">
                <div className="text-xs text-muted-foreground">
                  Mostrando <strong>{loansData.length}</strong> de <strong>{loansData.length}</strong> préstamos
                </div>
              </CardFooter>
            </>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Modificar Préstamo</DialogTitle>
                <DialogDescription>
                  {`Editando el préstamo de ${selectedLoan?.partnerName}.`}
                </DialogDescription>
            </DialogHeader>
            <AddLoanFlow 
                partners={selectedPartner ? [selectedPartner] : partners} 
                onSubmit={handleLoanEditSubmit} 
                loan={selectedLoan}
                mode="edit"
             />
        </DialogContent>
      </Dialog>
      
      {selectedLoan && (
        <PaymentPlanDialog 
          isOpen={paymentPlanOpen}
          onOpenChange={setPaymentPlanOpen}
          loan={selectedLoan}
        />
      )}

      <AlertDialog open={!!loanToDelete} onOpenChange={() => setLoanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de eliminar el préstamo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El préstamo se eliminará permanentemente de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLoanToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLoan} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

