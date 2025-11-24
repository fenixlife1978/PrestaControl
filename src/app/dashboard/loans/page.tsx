
"use client";

import { useState, useRef } from "react";
import {
  MoreHorizontal,
  PlusCircle,
  File,
  FileUp,
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
import { AddLoanFlow } from "./_components/add-loan-flow";
import { useToast } from "@/hooks/use-toast";
import { PaymentPlanDialog } from "./_components/payment-plan-dialog";
import Papa from "papaparse";

export type Loan = {
  id: string;
  partnerName: string;
  partnerId: string;
  amount: number;
  status: "Aprobado" | "Pendiente" | "Rechazado" | "Pagado";
  createdAt: Timestamp;
  loanType: "estandar" | "personalizado";
  interestRate?: string;
  installments?: string;
  startDate: Timestamp;
  hasInterest?: boolean;
  paymentType?: 'cuotas' | 'libre';
  interestType?: 'porcentaje' | 'fijo';
  customInterest?: string;
  customInstallments?: string;
};

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
  cedula?: string;
}

export default function LoansPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentPlanOpen, setPaymentPlanOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  
  const loansData: Loan[] = loans ? loans.docs.map(doc => {
      const data = doc.data();
      const partner = partners.find(p => p.id === data.partnerId);
      return { 
        id: doc.id, 
        ...data,
        partnerName: partner ? `${partner.firstName} ${partner.lastName}` : "Desconocido"
      } as Loan
  }) : [];

  const handleLoanSubmit = async (values: any) => {
     try {
       if (!firestore) {
         throw new Error("Firestore is not initialized");
       }
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
       
       if (dialogMode === "add") {
         await addDoc(collection(firestore, 'loans'), {
           ...loanData,
           status: 'Aprobado',
           createdAt: serverTimestamp(),
         });
         toast({
           title: "Préstamo añadido",
           description: "El nuevo préstamo ha sido registrado exitosamente.",
         });
       } else if (dialogMode === "edit" && selectedLoan) {
         const loanRef = doc(firestore, "loans", selectedLoan.id);
         // Filter out undefined values before updating
         const updateData = Object.entries(loanData).reduce((acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = value;
            }
            return acc;
         }, {} as any);
         await updateDoc(loanRef, updateData);
         toast({
           title: "Préstamo modificado",
           description: "El préstamo ha sido actualizado exitosamente.",
         });
       }

       setIsDialogOpen(false);
       setSelectedLoan(null);
     } catch (e) {
       console.error("Error with document: ", e);
       toast({
         title: "Error",
         description: dialogMode === "add" ? "No se pudo añadir el préstamo." : "No se pudo modificar el préstamo.",
         variant: "destructive",
       });
     }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && firestore) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: header => header.trim().toLowerCase().replace(/_/g, ''),
        complete: async (results) => {
          const newLoans = results.data as Array<any>;
          
          if (newLoans.length > 0) {
            try {
              const batch = writeBatch(firestore);
              let processedCount = 0;

              for (const row of newLoans) {
                 const socioName = row.socio;
                 const monto = row.monto;
                 const fechaInicio = row.fechainicio;
                 const tipoPrestamo = row.tipoprestamo;
                 
                if (!socioName || !monto || !fechaInicio || !tipoPrestamo) {
                  console.warn("Fila ignorada por datos incompletos:", row);
                  continue;
                }
                
                const partnerDoc = partners.find(p => `${p.firstName} ${p.lastName}`.trim().toLowerCase() === String(socioName).trim().toLowerCase());

                if (!partnerDoc) {
                  console.warn(`Socio con nombre "${socioName}" no encontrado. Préstamo ignorado.`);
                  continue;
                }
                
                const partnerId = partnerDoc.id;

                let startDate;
                if (String(fechaInicio).includes('/')) {
                    const parts = String(fechaInicio).split('/');
                    startDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    startDate = new Date(String(fechaInicio));
                }
                if (isNaN(startDate.getTime())) {
                    console.warn(`Fecha de inicio inválida: ${fechaInicio}. Préstamo ignorado.`);
                    continue;
                }

                const loanDocRef = doc(collection(firestore, 'loans'));
                
                const loanData: any = {
                    partnerId: partnerId,
                    amount: parseFloat(monto),
                    startDate: Timestamp.fromDate(startDate),
                    loanType: tipoPrestamo as 'estandar' | 'personalizado',
                    status: 'Aprobado' as const,
                    createdAt: serverTimestamp(),
                };

                if (loanData.loanType === 'estandar') {
                    loanData.interestRate = row.tasainteresmensual || '5';
                    loanData.installments = row.numerocuotas || '12';
                } else { // personalizado
                    const interesPersonalizado = row.interespersonalizado;
                    loanData.hasInterest = !!interesPersonalizado && parseFloat(interesPersonalizado) > 0;
                    loanData.paymentType = row.modalidadpago || 'cuotas';
                    if (loanData.hasInterest) {
                        loanData.interestType = row.tipointeres || 'porcentaje';
                        loanData.customInterest = interesPersonalizado;
                    }
                    if (loanData.paymentType === 'cuotas') {
                        loanData.customInstallments = row.cuotaspersonalizadas;
                    }
                }

                batch.set(loanDocRef, loanData);
                processedCount++;
              }
              await batch.commit();
              toast({
                title: "Carga masiva completada",
                description: `Se procesaron ${processedCount} de ${newLoans.length} préstamos.`
              });
            } catch (e) {
                console.error("Error adding documents from file: ", e);
                toast({
                    title: "Error",
                    description: "No se pudieron añadir los préstamos desde el archivo.",
                    variant: "destructive",
                });
            }
          }
        },
        error: (error) => {
            console.error("Error parsing CSV:", error);
            toast({
                title: "Error de formato",
                description: "No se pudo procesar el archivo CSV.",
                variant: "destructive",
            });
        }
      });
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const openAddDialog = () => {
    setDialogMode("add");
    setSelectedLoan(null);
    setIsDialogOpen(true);
  }

  const openEditDialog = (loan: Loan) => {
    setDialogMode("edit");
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Préstamos</CardTitle>
            <CardDescription>
              Gestionar y revisar todas las solicitudes de préstamos.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1">
                <File className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Exportar
                </span>
              </Button>
               <Button asChild size="sm" variant="outline" className="h-7 gap-1 cursor-pointer">
                  <Label htmlFor="file-upload" className="cursor-pointer flex items-center gap-1">
                      <FileUp className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Cargar Lista</span>
                  </Label>
              </Button>
              <Input 
                  id="file-upload"
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".csv"
              />
              <Button size="sm" className="h-7 gap-1" onClick={openAddDialog}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Añadir Préstamo
                  </span>
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
                    <TableHead>Socio</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha de Inicio</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loansData.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <div className="font-medium">{loan.partnerName}</div>
                      </TableCell>
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
                             {loan.status === "Pendiente" && (
                              <>
                                <DropdownMenuItem>Aprobar</DropdownMenuItem>
                                <DropdownMenuItem>Rechazar</DropdownMenuItem>
                              </>
                            )}
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
                  ))}
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
                <DialogTitle>{dialogMode === 'add' ? 'Añadir Nuevo Préstamo' : 'Modificar Préstamo'}</DialogTitle>
                <DialogDescription>
                  {dialogMode === 'add' ? 'Busque un socio para iniciar el proceso de registro de un nuevo préstamo.' : `Editando el préstamo de ${selectedLoan?.partnerName}.`}
                </DialogDescription>
            </DialogHeader>
            <AddLoanFlow 
                partners={partners} 
                onSubmit={handleLoanSubmit} 
                loan={selectedLoan}
                mode={dialogMode}
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
