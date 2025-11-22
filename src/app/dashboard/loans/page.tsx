"use client";

import Image from "next/image";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, getFirestore } from "firebase/firestore";
import { app } from "@/firebase/config";

type Loan = {
  id: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  status: "Aprobado" | "Pendiente" | "Rechazado" | "Pagado";
  applicationDate: string;
};

export default function LoansPage() {
  const [loans, loading, error] = useCollection(collection(getFirestore(app), 'loans'));
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };
  
  const loansData: Loan[] = loans ? loans.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)) : [];

  return (
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
            <Button size="sm" className="h-7 gap-1">
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
                  <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loansData.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="hidden sm:table-cell">
                      <div className="font-medium">{loan.customerName}</div>
                      <div className="hidden text-sm text-muted-foreground md:inline">
                        {loan.customerEmail}
                      </div>
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
                    <TableCell>{loan.applicationDate}</TableCell>
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
             <CardFooter>
              <div className="text-xs text-muted-foreground">
                Mostrando <strong>{loansData.length}</strong> de <strong>{loansData.length}</strong> préstamos
              </div>
            </CardFooter>
          </>
        )}
      </CardContent>
    </Card>
  );
}
