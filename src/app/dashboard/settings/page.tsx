
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
import { ProfileTab } from "./_components/profile-tab";

export default function SettingsPage() {
  return (
    <Tabs defaultValue="company">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="company">Datos de la Empresa</TabsTrigger>
        <TabsTrigger value="profile">Mi Perfil</TabsTrigger>
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
      <TabsContent value="profile">
        <Card>
            <CardHeader>
                <CardTitle>Mi Perfil</CardTitle>
                <CardDescription>
                    Actualice su información personal y foto de perfil.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ProfileTab />
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
