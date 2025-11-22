
"use client";

import { useState } from "react";
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

type Partner = {
  id: string;
  name: string;
  cedula?: string;
};

// Mock data for partners
const initialPartners: Partner[] = [
  { id: "S001", name: "Ana Torres", cedula: "12345678-9" },
  { id: "S002", name: "Luis Morales", cedula: "98765432-1" },
  { id: "S003", name: "Carla Rivas" },
];

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>(initialPartners);
  const [fullName, setFullName] = useState("");
  const [cedula, setCedula] = useState("");

  const handleAddPartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim()) {
      const newPartner: Partner = {
        id: `S${(partners.length + 1).toString().padStart(3, '0')}`,
        name: fullName.trim(),
        cedula: cedula.trim() || undefined,
      };
      setPartners([...partners, newPartner]);
      setFullName("");
      setCedula("");
    }
  };
  
  const handleDeleteAll = () => {
    setPartners([]);
  }

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
                <Label htmlFor="fullName">Nombre Completo</Label>
                <Input
                  id="fullName"
                  placeholder="Ej: Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
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
                <Button size="sm" variant="outline" className="h-8 gap-1">
                    <FileUp className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">Cargar Lista</span>
                </Button>
                 <Button size="sm" variant="destructive" className="h-8 gap-1" onClick={handleDeleteAll}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">Borrar Lista</span>
                </Button>
            </div>
          </CardHeader>
          <CardContent>
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
                            <DropdownMenuItem className="text-destructive">
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
