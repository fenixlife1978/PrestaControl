
"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CompanySettingsTab } from "./_components/company-settings-tab";
import { AdminsTab } from "./_components/admins-tab";

export default function SettingsPage() {
  return (
    <Tabs defaultValue="company">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="company">Datos de la Empresa</TabsTrigger>
        <TabsTrigger value="admins">Administradores</TabsTrigger>
      </TabsList>
      <TabsContent value="company">
        <Card>
          <CardHeader>
            <CardTitle>Información de la Empresa</CardTitle>
            <CardDescription>
              Actualice los datos de su empresa que aparecerán en los reportes y documentos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CompanySettingsTab />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="admins">
        <Card>
            <CardHeader>
                <CardTitle>Gestionar Administradores</CardTitle>
                <CardDescription>
                    Añada o elimine usuarios con permisos de administrador en el sistema.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <AdminsTab />
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
