

"use client";
import {
  Bell,
  CircleUser,
  Home,
  LineChart,
  Package,
  Package2,
  ShoppingCart,
  Users,
  CreditCard,
  Settings,
  BarChart2,
  ShieldCheck, // Icon for validation
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import NavLink from "./_components/nav-link";
import { Menu, Search } from "lucide-react";
import { signOut } from "firebase/auth";
import { DollarSign } from 'lucide-react';
import { Logo } from "@/components/logo";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    const auth = useAuth().auth; // Get the auth instance
    if (!auth) {
      console.error("Authentication not initialized!");
      return;
    }
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-gray-100/40 md:block dark:bg-gray-800/40">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Logo className="h-6 w-6" />
              <span className="">Financiera</span>
            </Link>
            <Button variant="outline" size="icon" className="ml-auto h-8 w-8">
              <Bell className="h-4 w-4" />
              <span className="sr-only">Toggle notifications</span>
            </Button>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <NavLink href="/dashboard">
                <Home className="h-4 w-4" />
                Inicio
              </NavLink>
              <NavLink href="/dashboard/loans">
                <CreditCard className="h-4 w-4" />
                Préstamos
              </NavLink>
              <NavLink href="/dashboard/customers">
                <Users className="h-4 w-4" />
                Clientes
              </NavLink>
              <NavLink href="/dashboard/payments">
                <DollarSign className="h-4 w-4" />
                Pagos
              </NavLink>
              <NavLink href="/dashboard/reports">
                <BarChart2 className="h-4 w-4" />
                Reportes
              </NavLink>
               <NavLink href="/dashboard/validation">
                <ShieldCheck className="h-4 w-4" />
                Validación
              </NavLink>
            </nav>
          </div>
          <div className="mt-auto p-4">
            <NavLink href="/dashboard/settings">
              <Settings className="h-4 w-4" />
              Configuración
            </NavLink>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <nav className="grid gap-2 text-lg font-medium">
                <Link
                  href="#"
                  className="flex items-center gap-2 text-lg font-semibold"
                >
                  <Package2 className="h-6 w-6" />
                  <span className="sr-only">Financiera</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <Home className="h-5 w-5" />
                  Inicio
                </Link>
                <Link
                  href="/dashboard/loans"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <CreditCard className="h-5 w-5" />
                  Préstamos
                </Link>
                <Link
                  href="/dashboard/customers"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <Users className="h-5 w-5" />
                  Clientes
                </Link>
                <Link
                  href="/dashboard/payments"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <DollarSign className="h-5 w-5" />
                  Pagos
                </Link>
                <Link
                  href="/dashboard/reports"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <BarChart2 className="h-5 w-5" />
                  Reportes
                </Link>
                 <Link
                  href="/dashboard/validation"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <ShieldCheck className="h-5 w-5" />
                  Validación
                </Link>
              </nav>
            </SheetContent>
          </Sheet>

          <div className="w-full flex-1">
            {/* Search form can go here if needed */}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <CircleUser className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>Configuración</DropdownMenuItem>
              <DropdownMenuItem>Soporte</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>Cerrar sesión</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

    