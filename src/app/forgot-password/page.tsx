'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useFirebase } from '@/firebase/provider';
import { Logo } from '@/components/logo';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { auth } = useFirebase();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: 'Correo requerido',
        description: 'Por favor, ingrese su correo electrónico.',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Correo Enviado',
        description:
          'Se ha enviado un enlace a su correo para restablecer la contraseña. Revise su bandeja de entrada (y la carpeta de spam).',
      });
      router.push('/login');
    } catch (error: any) {
      console.error(error);
      let errorMessage =
        'Ocurrió un error. Por favor, inténtelo de nuevo más tarde.';
      if (error.code === 'auth/user-not-found') {
        errorMessage =
          'No se encontró ningún usuario con ese correo electrónico.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'El correo electrónico no tiene un formato válido.';
      }
      toast({
        title: 'Error al enviar correo',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <Logo className="mx-auto h-24 w-auto" />
            <h1 className="text-3xl font-bold">Recuperar Contraseña</h1>
            <p className="text-balance text-muted-foreground">
              Ingresa tu correo electrónico y te enviaremos un enlace para
              restablecer tu contraseña.
            </p>
          </div>
          <form onSubmit={handleResetPassword} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="nombre@ejemplo.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Enviando correo...'
                : 'Enviar Correo de Recuperación'}
            </Button>
            <div className="mt-4 text-center text-sm">
              <Link href="/login" className="underline">
                Volver a Iniciar Sesión
              </Link>
            </div>
          </form>
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        <Image
          src="https://picsum.photos/seed/forgotpassword/1920/1080"
          alt="Image"
          width="1920"
          height="1080"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          data-ai-hint="road perspective"
        />
      </div>
    </div>
  );
}
