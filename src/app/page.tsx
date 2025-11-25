

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-10 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo className="h-24 w-auto" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Bienvenido a la Coop. de Transp. La Candelaria
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Inicia Sesión Para Gestionar Préstamos y Cobranzas de la Empresa.
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <Link href="/login" passHref legacyBehavior>
            <a className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Iniciar Sesión
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}

    