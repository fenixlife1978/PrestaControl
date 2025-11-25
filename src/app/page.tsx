"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase"; // Asegúrate de que auth esté exportado en @/firebase
import Image from "next/image";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Intento de inicio de sesión
      await signInWithEmailAndPassword(auth, email, password);
      
      // 2. Redirección al éxito
      // Nota: Si esto falla, el error está fuera de este componente (Proveedor/Layout).
      router.push("/dashboard"); 
      
      // No hacemos setLoading(false) aquí porque el router.push() recarga la página.

    } catch (error: any) {
      console.error(error);
      let errorMessage = "Ocurrió un error. Por favor, inténtelo de nuevo.";
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "Correo electrónico o contraseña incorrectos.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "El correo electrónico no tiene un formato válido.";
      }
      
      toast({
        title: "Error de inicio de sesión",
        description: errorMessage,
        variant: "destructive",
      });
      
      // 3. Desactivar el estado de carga en caso de error
      setLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:grid-cols-5">
      <div className="hidden bg-muted lg:col-span-2 lg:block">
        <Image
          src="/placeholder.svg"
          alt="Image"
          width="1920"
          height="1080"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
      <div className="flex items-center justify-center py-12 lg:col-span-3">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Iniciar Sesión</h1>
            <p className="text-balance text-muted-foreground">
              Ingresa tu correo electrónico para iniciar sesión
            </p>
          </div>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Contraseña</Label>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Iniciando..." : "Iniciar Sesión"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}