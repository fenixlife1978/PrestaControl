
"use client";

import { useState } from "react";
import {
  MoreHorizontal,
  PlusCircle,
  File,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { AddLoanForm } from "./_components/add-loan-form";
import { useToast } from "@/hooks/use-toast";

type Loan = {
  id: string;
  partnerName: string;
  partnerId: string;
  amount: number;
  status: "Aprobado" | "Pendiente" | "Rechazado" | "Pagado";
  applicationDate: {
    seconds: number;
    nanoseconds: number;
  };
};

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
}

export default function LoansPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const [loans, loading, error] = useCollection(collection(firestore, 'loans'));
  const [partnersCol] = useCollection(collection(firestore, 'partners'));
  
  const partners: Partner[] = partnersCol ? partnersCol.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) : [];
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };
  
  const formatDate = (timestamp: { seconds: number, nanoseconds: number }) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp.seconds * 1000).toLocaleDateString("es-ES");
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

  const handleAddLoan = async (values: { partnerId: string; amount: string; applicationDate: Date }) => {
     try {
       await addDoc(collection(firestore, 'loans'), {
         ...values,
         amount: parseFloat(values.amount),
         status: 'Aprobado',
         createdAt: serverTimestamp(),
       });
       toast({
         title: "Préstamo añadido",
         description: "El nuevo préstamo ha sido registrado exitosamente.",
       });
       setOpen(false);
     } catch (e) {
       console.error("Error adding document: ", e);
       toast({
         title: "Error",
         description: "No se pudo añadir el préstamo.",
         variant: "destructive",
       });
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
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-7 gap-1">
                      <PlusCircle className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Añadir Préstamo
                      </span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Añadir Nuevo Préstamo</DialogTitle>
                        <DialogDescription>
                            Complete el formulario para registrar un nuevo préstamo.
                        </DialogDescription>
                    </DialogHeader>
                    <AddLoanForm partners={partners} onSubmit={handleAddLoan} />
                </DialogContent>
              </Dialog>
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
                    <TableHead>Fecha de Solicitud</TableHead>
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
                      <TableCell>{formatCurrency(loan.amount)}</TableCell>
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
                      <TableCell>{formatDate(loan.applicationDate)}</TableCell>
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
                            <DropdownMenuItem>Ver Detalles</DropdownMenuItem>
                            {loan.status === "Pendiente" && (
                              <>
                                <DropdownMenuItem>Aprobar</DropdownMenuItem>
                                <DropdownMenuItem>Rechazar</DropdownMenuItem>
                              </>
                            )}
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
    </>
  );
}
