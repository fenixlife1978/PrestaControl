
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  FilePlus2,
  HandCoins,
  Home,
  LayoutDashboard,
  LineChart,
  Package,
  Package2,
  PanelLeft,
  Search,
  Settings,
  ShoppingCart,
  Users,
  Users2,
  CreditCard,
  CalendarCheck,
  BarChart3,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import NavLink from "./_components/nav-link";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useUser } from "@/hooks/use-user";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);
  
  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-900">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r bg-card sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          <Link
            href="/dashboard"
            className="group flex h-9 w-full shrink-0 items-center justify-start gap-2 rounded-full text-lg font-semibold text-primary-foreground md:h-8 md:text-base"
          >
            <Logo className="pl-2" />
            <span className="sr-only">PrestaControl</span>
          </Link>
          <div className="w-full flex-1 overflow-auto">
            <nav className="grid items-start px-2 text-sm font-medium">
              <NavLink href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Panel
              </NavLink>
              <NavLink href="/dashboard/partners">
                <Users2 className="h-4 w-4" />
                Socios
              </NavLink>
              <NavLink href="/dashboard/loans">
                <HandCoins className="h-4 w-4" />
                Préstamos
              </NavLink>
              <NavLink href="/dashboard/payments">
                <CreditCard className="h-4 w-4" />
                Pagos
              </NavLink>
              <NavLink href="/dashboard/reports">
                <BarChart3 className="h-4 w-4" />
                Reportes
              </NavLink>
              <NavLink href="/dashboard/validation">
                <ShieldCheck className="h-4 w-4" />
                Validación
              </NavLink>
               <NavLink href="/dashboard/settings">
                <Settings className="h-4 w-4" />
                Configuración
              </NavLink>
            </nav>
          </div>
        </nav>
      </aside>
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-slate-900 px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Alternar Menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs bg-card">
            <SheetTitle>Menú Principal</SheetTitle>
              <nav className="grid gap-6 text-lg font-medium mt-8">
                <Logo />
                 <NavLink href="/dashboard">
                    <LayoutDashboard className="h-5 w-5" />
                    Panel
                 </NavLink>
                 <NavLink href="/dashboard/partners">
                    <Users2 className="h-5 w-5" />
                    Socios
                 </NavLink>
                 <NavLink href="/dashboard/loans">
                    <HandCoins className="h-5 w-5" />
                    Préstamos
                 </NavLink>
                 <NavLink href="/dashboard/payments">
                    <CreditCard className="h-5 w-5" />
                    Pagos
                  </NavLink>
                  <NavLink href="/dashboard/reports">
                    <BarChart3 className="h-5 w-5" />
                    Reportes
                  </NavLink>
                  <NavLink href="/dashboard/validation">
                    <ShieldCheck className="h-5 w-5" />
                    Validación
                  </NavLink>
                  <NavLink href="/dashboard/settings">
                    <Settings className="h-5 w-5" />
                    Configuración
                  </NavLink>
              </nav>
            </SheetContent>
          </Sheet>

          {pathname !== '/dashboard' && (
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Atrás</span>
            </Button>
          )}

          <div className="relative ml-auto flex-1 md:grow-0">
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="overflow-hidden rounded-full"
              >
                <Avatar>
                  <AvatarImage src={user?.photoURL || PlaceHolderImages.find(p => p.id === 'user-avatar')?.imageUrl} alt={user?.displayName || "Admin"} />
                  <AvatarFallback>{user?.displayName?.charAt(0) || 'A'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.displayName || "Mi Cuenta"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">Configuración</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Soporte</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:px-6 sm:py-0">
            <div className="grid items-start gap-4 md:gap-8">
                {children}
            </div>
        </main>
      </div>
    </div>
  );
}
