"use client";

import { useState, useRef } from "react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, FileUp, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, deleteDoc, doc, runTransaction } from "firebase/firestore";
import { useCollection } from "react-firebase-hooks/firestore";
import { useFirestore } from "@/firebase/provider";

type Partner = {
  id: string;
  name: string;
  cedula?: string;
};

export default function PartnersPage() {
  const firestore = useFirestore();
  const [partnersCol, loading, error] = useCollection(collection(firestore, 'partners'));
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cedula, setCedula] = useState("");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const partners: Partner[] = partnersCol ? partnersCol.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) : [];

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (firstName.trim() && lastName.trim()) {
      try {
        const newPartner = {
          name: `${firstName.trim()} ${lastName.trim()}`,
          cedula: cedula.trim() || undefined,
        };
        const docRef = await addDoc(collection(firestore, 'partners'), newPartner);
        setFirstName("");
        setLastName("");
        setCedula("");
        toast({
            title: "Socio añadido",
            description: `${newPartner.name} ha sido añadido a la lista.`,
        });
      } catch (e) {
        console.error("Error adding document: ", e);
        toast({
            title: "Error",
            description: "No se pudo añadir el socio.",
            variant: "destructive",
        });
      }
    }
  };
  
  const handleDeleteAll = async () => {
    try {
      await runTransaction(firestore, async (transaction) => {
        partnersCol?.docs.forEach(doc => {
          transaction.delete(doc.ref);
        });
      });
      toast({
          title: "Lista de socios eliminada",
          description: "Todos los socios han sido eliminados.",
          variant: "destructive",
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

  const handleDeletePartner = async (partnerId: string) => {
    try {
      await deleteDoc(doc(firestore, 'partners', partnerId));
      toast({
          title: "Socio eliminado",
          description: `El socio ha sido eliminado.`,
      });
    } catch(e) {
      console.error("Error deleting document: ", e);
       toast({
            title: "Error",
            description: "No se pudo eliminar el socio.",
            variant: "destructive",
        });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Aquí puedes añadir la lógica para procesar el archivo (ej. CSV o Excel)
      console.log("Archivo seleccionado:", file.name);
      toast({
          title: "Archivo cargado",
          description: `El archivo ${file.name} ha sido seleccionado.`,
      })
      // Reset file input para permitir cargar el mismo archivo de nuevo
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Añadir Socio</CardTitle>
            <CardDescription>
              Complete el formulario para agregar un nuevo socio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddPartner} className="space-y-4">
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
              <Button type="submit" className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Socio
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
                <Button asChild size="sm" variant="outline" className="h-8 gap-1 cursor-pointer">
                    <Label htmlFor="file-upload" className="cursor-pointer flex items-center gap-1">
                        <FileUp className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only">Cargar Lista</span>
                    </Label>
                </Button>
                <Input 
                    id="file-upload"
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                />
                 <Button size="sm" variant="destructive" className="h-8 gap-1" onClick={handleDeleteAll} disabled={!partnersCol || partnersCol.empty}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">Borrar Lista</span>
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && <p>Cargando socios...</p>}
            {error && <p>Error al cargar socios: {error.message}</p>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Completo</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.length > 0 ? (
                  partners.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">{partner.name}</TableCell>
                      <TableCell>{partner.cedula || "N/A"}</TableCell>
                      <TableCell>
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
                             <DropdownMenuItem>Modificar</DropdownMenuItem>
                            <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => handleDeletePartner(partner.id)}>
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      No hay socios registrados.
                    </TableCell>
                  </TableRow>
                )}
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
  );
}
