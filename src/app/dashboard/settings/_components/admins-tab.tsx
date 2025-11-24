
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { collection, addDoc, doc, deleteDoc } from "firebase/firestore";
import { useCollection } from "react-firebase-hooks/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const adminSchema = z.object({
  name: z.string().min(1, "El nombre es requerido."),
  cedula: z.string().min(1, "La cédula es requerida."),
  email: z.string().email("Correo electrónico inválido."),
  password: z.string().min(6, "La clave debe tener al menos 6 caracteres."),
});

type AdminFormValues = z.infer<typeof adminSchema>;

type Admin = {
    id: string;
    name: string;
    cedula: string;
    email: string;
}

export function AdminsTab() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);

  const [adminsCol, loading, error] = useCollection(firestore ? collection(firestore, 'admins') : null);
  const admins: Admin[] = adminsCol ? adminsCol.docs.map(doc => ({ id: doc.id, ...doc.data() } as Admin)) : [];

  const form = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: { name: "", cedula: "", email: "", password: "" },
  });

  async function onSubmit(data: AdminFormValues) {
    if (!firestore) return;
    try {
      // NOTE: In a real app, you would use Firebase Auth to create a user.
      // For this prototype, we're just saving the info to a collection.
      const { password, ...adminData } = data;
      await addDoc(collection(firestore, "admins"), adminData);
      toast({
        title: "Administrador Añadido",
        description: `El usuario ${data.name} ha sido añadido.`,
      });
      form.reset();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "No se pudo añadir el administrador.",
        variant: "destructive",
      });
    }
  }

  const handleDeleteAdmin = async () => {
    if (!firestore || !adminToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'admins', adminToDelete.id));
      toast({
        title: "Administrador Eliminado",
        description: `El usuario ${adminToDelete.name} ha sido eliminado.`,
      });
    } catch(e) {
      console.error(e);
      toast({
        title: "Error",
        description: "No se pudo eliminar al administrador.",
        variant: "destructive",
      });
    } finally {
        setAdminToDelete(null);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-1">
        <h3 className="text-lg font-medium mb-4">Añadir Nuevo Administrador</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cedula"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cédula</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clave Asignada</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Añadir Administrador</Button>
          </form>
        </Form>
      </div>
      <div className="md:col-span-2">
        <h3 className="text-lg font-medium mb-4">Lista de Administradores</h3>
        {loading && <p>Cargando...</p>}
        {error && <p className="text-destructive">Error: {error.message}</p>}
        {!loading && (
          <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Cédula</TableHead>
                        <TableHead>Correo</TableHead>
                        <TableHead><span className="sr-only">Acciones</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {admins.length > 0 ? (
                        admins.map(admin => (
                            <TableRow key={admin.id}>
                                <TableCell className="font-medium">{admin.name}</TableCell>
                                <TableCell>{admin.cedula}</TableCell>
                                <TableCell>{admin.email}</TableCell>
                                <TableCell className="text-right">
                                     <Button variant="ghost" size="icon" onClick={() => setAdminToDelete(admin)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                        <span className="sr-only">Eliminar</span>
                                     </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center">No hay administradores registrados.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
          </div>
        )}
      </div>

       <AlertDialog open={!!adminToDelete} onOpenChange={() => setAdminToDelete(null)}>
        <AlertDialogContent>
        <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de eliminar a este administrador?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta acción no se puede deshacer. Se revocará el acceso de <strong>{adminToDelete?.name}</strong>.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAdminToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAdmin} className="bg-destructive hover:bg-destructive/90">
                Eliminar
            </AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}
