

"use client";

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, PlusCircle, Trash2, XCircle, Loader2, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, deleteDoc, doc, writeBatch, updateDoc } from "firebase/firestore";
import { useCollection } from "react-firebase-hooks/firestore";
import { useFirestore } from "@/firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
  cedula?: string;
  email?: string;
};

export default function PartnersPage() {
  const firestore = useFirestore();
  const [partnersCol, loadingCol, errorCol] = useCollection(firestore ? collection(firestore, 'partners') : null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cedula, setCedula] = useState("");
  const [email, setEmail] = useState("");
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnerToDelete, setPartnerToDelete] = useState<Partner | null>(null);
  const { toast } = useToast();
  
  const cardTitle = editingPartner ? "Modificar Socio" : "Añadir Socio";
  const cardDescription = editingPartner 
    ? `Editando los datos de ${editingPartner.firstName} ${editingPartner.lastName}.` 
    : "Complete el formulario para agregar un nuevo socio.";
  const buttonText = editingPartner ? "Guardar Cambios" : "Añadir Socio";

  const partners: Partner[] = partnersCol ? partnersCol.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)).sort((a, b) => a.firstName.localeCompare(b.firstName)) : [];

  // Lógica para sincronizar el formulario al editar
  useEffect(() => {
    if (editingPartner) {
        setFirstName(editingPartner.firstName);
        setLastName(editingPartner.lastName);
        setCedula(editingPartner.cedula || "");
        setEmail(editingPartner.email || "");
    } else {
        // Solo resetear si no estamos en modo edición o si acabamos de salir
        setFirstName("");
        setLastName("");
        setCedula("");
        setEmail("");
    }
  }, [editingPartner]);

  // Manejador para añadir/modificar socio
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !firstName.trim() || !lastName.trim()) return;

    const partnerData: { firstName: string; lastName: string; cedula?: string; email?: string } = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
    };
    const cedulaValue = cedula.trim();
    if (cedulaValue) {
        partnerData.cedula = cedulaValue;
    }
    const emailValue = email.trim();
    if (emailValue) {
        partnerData.email = emailValue;
    }

    try {
        if (editingPartner) {
            // Update existing partner
            await updateDoc(doc(firestore, 'partners', editingPartner.id), partnerData);
            toast({
                title: "Socio modificado",
                description: `Los datos de ${partnerData.firstName} ${partnerData.lastName} han sido actualizados.`,
            });
            setEditingPartner(null);
        } else {
            // Add new partner
            await addDoc(collection(firestore, 'partners'), partnerData);
            toast({
                title: "Socio añadido",
                description: `${partnerData.firstName} ${partnerData.lastName} ha sido añadido a la lista.`,
            });
        }
        // Reset form fields
        setFirstName("");
        setLastName("");
        setCedula("");
        setEmail("");
    } catch (e) {
        console.error("Error with document: ", e);
        toast({
            title: "Error",
            description: editingPartner ? "No se pudo modificar el socio." : "No se pudo añadir el socio.",
            variant: "destructive",
        });
    }
  };

  const handleStartEditing = (partner: Partner) => {
    setEditingPartner(partner);
  };

  const handleCancelEditing = () => {
    setEditingPartner(null);
  }
  
  // Manejador para eliminar todos los socios
  const handleDeleteAll = async () => {
    if (!firestore) return;
    try {
      const batch = writeBatch(firestore);
      partnersCol?.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast({
          title: "Lista de socios eliminada",
          description: "Todos los socios han sido eliminados.",
      });
    } catch (e) {
       console.error("Error deleting documents: ", e);
       toast({
           title: "Error",
           description: "No se pudo eliminar la lista de socios.",
           variant: "destructive",
        });
    }
  }

  // Manejador para eliminar un socio individual
  const handleDeletePartner = async () => {
    if (!firestore || !partnerToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'partners', partnerToDelete.id));
      toast({
          title: "Socio eliminado",
          description: `El socio ${partnerToDelete.firstName} ${partnerToDelete.lastName} ha sido eliminado.`,
      });
      setPartnerToDelete(null); // Cerrar el diálogo
    } catch(e) {
      console.error("Error deleting document: ", e);
      toast({
          title: "Error",
          description: "No se pudo eliminar el socio.",
          variant: "destructive",
      });
      setPartnerToDelete(null); // Cerrar el diálogo
    }
  };
  
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Lista de Socios", 14, 15);
    
    const tableColumn = ["Nombre", "Apellido", "Cédula", "Email"];
    const tableRows: any[][] = [];

    partners.forEach(partner => {
        const partnerData = [
            partner.firstName,
            partner.lastName,
            partner.cedula || "N/A",
            partner.email || "N/A"
        ];
        tableRows.push(partnerData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20
    });
    
    doc.save("lista_de_socios.pdf");
  };

  // Lógica para mostrar los estados de la tabla
  let tableContent;
  if (loadingCol) {
    tableContent = (
      <TableRow>
        <TableCell colSpan={5} className="text-center py-8">
          <Loader2 className="mr-2 h-4 w-4 animate-spin inline-block" /> Cargando socios...
        </TableCell>
      </TableRow>
    );
  } else if (errorCol) {
    tableContent = (
      <TableRow>
        <TableCell colSpan={5} className="text-center text-red-500 py-8">
          Error al cargar socios: {errorCol.message}
        </TableCell>
      </TableRow>
    );
  } else if (partners.length === 0) {
    tableContent = (
      <TableRow>
        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
          No hay socios registrados. Utilice el formulario para agregar el primero.
        </TableCell>
      </TableRow>
    );
  } else {
    tableContent = (
      partners.map((partner) => (
        <TableRow key={partner.id}>
          <TableCell className="font-medium">{partner.firstName}</TableCell>
          <TableCell>{partner.lastName}</TableCell>
          <TableCell>{partner.cedula || "N/A"}</TableCell>
          <TableCell>{partner.email || "N/A"}</TableCell>
          <TableCell className="w-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-haspopup="true"
                  size="icon"
                  variant="ghost"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Alternar menú</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => handleStartEditing(partner)}>
                      Modificar
                  </DropdownMenuItem>
                <DropdownMenuItem 
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    onSelect={() => setPartnerToDelete(partner)}>
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      ))
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-1">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{cardTitle}</CardTitle>
              {editingPartner && (
                  <Button variant="ghost" size="icon" onClick={handleCancelEditing} className="h-8 w-8">
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                      <span className="sr-only">Cancelar edición</span>
                  </Button>
              )}
            </div>
            <CardDescription>{cardDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  placeholder="Ej: Juan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  placeholder="Ej: Pérez"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cedula">Cédula (Opcional)</Label>
                <Input
                  id="cedula"
                  placeholder="Ej: 12345678-9"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico (Opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Ej: juan.perez@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                {editingPartner ? null : <PlusCircle className="mr-2 h-4 w-4" />}
                {buttonText}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Lista de Socios</CardTitle>
              <CardDescription>
                Aquí puede gestionar la información de los socios.
              </CardDescription>
            </div>
             <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 gap-1" 
                  disabled={partners.length === 0}
                  onClick={handleExportPDF}
                >
                  <FileDown className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only">
                    Exportar a PDF
                  </span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="h-8 gap-1" disabled={!partnersCol || partnersCol.empty || loadingCol}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only">Borrar Lista</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminarán permanentemente todos los socios de la base de datos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">
                        Eliminar Todo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Apellido</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableContent}
              </TableBody>
            </Table>
          </CardContent>
           <CardFooter>
            <div className="text-xs text-muted-foreground">
              Mostrando <strong>{partners.length}</strong> de <strong>{partners.length}</strong> socios
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>

    {/* Diálogo de confirmación para eliminar socio individual */}
    <AlertDialog open={!!partnerToDelete} onOpenChange={(open) => {
        if (!open) {
            setPartnerToDelete(null);
        }
    }}>
        <AlertDialogContent>
        <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de eliminar a este socio?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente a 
                <strong> {partnerToDelete?.firstName} {partnerToDelete?.lastName}</strong>.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePartner} className="bg-destructive hover:bg-destructive/90">
                Eliminar
            </AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
