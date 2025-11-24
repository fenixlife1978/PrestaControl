
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="flex flex-col items-center gap-4">
        <Logo className="w-48" />
        <h1 className="text-3xl font-bold text-primary">Coop. de Transp. La Candelaria</h1>
      </div>
      <p className="mt-4 max-w-lg text-lg text-muted-foreground">
        Bienvenid@ a la "Coop. de Transp. La Candelaria". Inicia Sesión Para Gestionar Prestamos y Cobranzas de la Empresa.
      </p>
      <Button
        size="lg"
        className="mt-8"
        onClick={() => router.push('/login')}
      >
        Iniciar Sesión
      </Button>
    </div>
  );
}
