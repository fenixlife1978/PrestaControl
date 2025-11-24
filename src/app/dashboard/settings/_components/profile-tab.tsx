
"use client";

import { useEffect, useState } from "react";
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
import { useFirestore, useAuth } from "@/firebase";
import { useUser } from "@/hooks/use-user";
import { doc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";

const profileSchema = z.object({
  displayName: z.string().min(1, "El nombre es requerido."),
  photoURL: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileTab() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, loading } = useUser();
  const { toast } = useToast();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
      photoURL: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
      });
      setPhotoPreview(user.photoURL);
    }
  }, [user, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        form.setValue("photoURL", dataUrl);
        setPhotoPreview(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  async function onSubmit(data: ProfileFormValues) {
    if (!auth?.currentUser) {
      toast({ title: "Error", description: "No hay un usuario autenticado.", variant: "destructive" });
      return;
    }

    try {
      await updateProfile(auth.currentUser, {
        displayName: data.displayName,
        photoURL: data.photoURL,
      });

      // Also update firestore user doc if you have one, e.g., in 'admins'
      if (firestore) {
          const adminRef = doc(firestore, 'admins', auth.currentUser.uid);
          await setDoc(adminRef, { name: data.displayName }, { merge: true });
      }

      toast({
        title: "Perfil Actualizado",
        description: "Su información ha sido guardada exitosamente.",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil.",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return <p>Cargando perfil...</p>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-lg">
        <FormField
          control={form.control}
          name="displayName"
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

        <div className="space-y-2">
          <Label>Foto de Perfil</Label>
          <div className="flex items-center gap-4">
             <Avatar className="h-16 w-16">
                <AvatarImage src={photoPreview || ""} />
                <AvatarFallback>{form.getValues("displayName")?.charAt(0)}</AvatarFallback>
             </Avatar>
             <Input
                id="photo-upload"
                type="file"
                accept="image/png, image/jpeg, image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button asChild variant="outline">
                  <Label htmlFor="photo-upload" className="cursor-pointer">
                      Cambiar Foto
                  </Label>
              </Button>
          </div>
          <FormDescription>
            Seleccione un archivo de imagen (PNG, JPG, etc.).
          </FormDescription>
        </div>

        <Button type="submit">Guardar Cambios</Button>
      </form>
    </Form>
  );
}
