
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useDocument } from "react-firebase-hooks/firestore";
import { Label } from "@/components/ui/label";

const companySettingsSchema = z.object({
  name: z.string().min(1, "El nombre de la empresa es requerido."),
  address: z.string().optional(),
  phone: z.string().optional(),
  rif: z.string().optional(),
  email: z.string().email("Correo electrónico inválido.").optional(),
  logoUrl: z.string().url("URL del logo inválida.").optional(),
});

type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>;

export function CompanySettingsTab() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const settingsRef = firestore ? doc(firestore, 'company_settings', 'main') : null;
  const [settingsDoc, loading, error] = useDocument(settingsRef);

  const form = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      rif: "",
      email: "",
      logoUrl: "",
    },
  });

  useEffect(() => {
    if (settingsDoc?.exists()) {
      form.reset(settingsDoc.data() as CompanySettingsFormValues);
    }
  }, [settingsDoc, form]);

  async function onSubmit(data: CompanySettingsFormValues) {
    if (!firestore) {
      toast({
        title: "Error",
        description: "No se pudo conectar a la base de datos.",
        variant: "destructive",
      });
      return;
    }
    try {
      await setDoc(doc(firestore, "company_settings", "main"), data, { merge: true });
      toast({
        title: "Información Guardada",
        description: "Los datos de la empresa han sido actualizados.",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "No se pudo guardar la información.",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return <p>Cargando configuración...</p>
  }

  if (error) {
    return <p className="text-destructive">Error: {error.message}</p>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Nombre de la Empresa</FormLabel>
                <FormControl>
                    <Input placeholder="Mi Empresa C.A." {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="rif"
            render={({ field }) => (
                <FormItem>
                <FormLabel>RIF (Opcional)</FormLabel>
                <FormControl>
                    <Input placeholder="J-12345678-9" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
                <FormItem className="md:col-span-2">
                <FormLabel>Dirección (Opcional)</FormLabel>
                <FormControl>
                    <Input placeholder="Av. Principal, Edificio Central, Piso 1, Oficina 1A" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Teléfono (Opcional)</FormLabel>
                <FormControl>
                    <Input placeholder="+58 412-1234567" {...field} />
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
                <FormLabel>Correo Electrónico (Opcional)</FormLabel>
                <FormControl>
                    <Input placeholder="contacto@miempresa.com" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <div className="md:col-span-2 space-y-2">
                 <Label>Logo (Opcional)</Label>
                 <div className="flex items-center gap-4">
                     <FormField
                        control={form.control}
                        name="logoUrl"
                        render={({ field }) => (
                            <FormItem className="flex-grow">
                                <FormControl>
                                    <Input placeholder="https://example.com/logo.png" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                    {form.getValues("logoUrl") && (
                        <img src={form.getValues("logoUrl")} alt="Logo Preview" className="h-12 w-auto rounded-md bg-muted object-contain" />
                    )}
                 </div>
                 <FormDescription>
                    Pega la URL de una imagen alojada en la web.
                </FormDescription>
            </div>
        </div>

        <Button type="submit">Guardar Cambios</Button>
      </form>
    </Form>
  );
}
