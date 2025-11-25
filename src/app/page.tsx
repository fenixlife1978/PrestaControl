
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function WelcomePage() {
  const router = useRouter();

  const handleRedirect = () => {
    router.push("/login");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
      <div className="mb-8">
        <Logo className="h-32 w-auto" />
      </div>
      <h1 className="text-3xl md:text-4xl font-bold text-foreground">
        Bienvenid@ a la Coop. de Transp. La Candelaria
      </h1>
      <p className="mt-4 text-lg md:text-xl text-muted-foreground max-w-2xl">
        Inicia Sesión para gestionar Préstamos y Cobranzas
      </p>
      <div className="mt-8">
        <Button size="lg" onClick={handleRedirect}>
          Ingresar
        </Button>
      </div>
    </div>
  );
}
