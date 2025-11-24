
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
import { CapitalRecuperadoReport } from "./_components/capital-recuperado-report";
import { CuotasVencidasReport } from "./_components/cuotas-vencidas-report";
import { PrestamosOtorgadosReport } from "./_components/prestamos-otorgados-report";

export default function ReportsPage() {
  return (
    <Tabs defaultValue="otorgados">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="otorgados">Préstamos Otorgados</TabsTrigger>
        <TabsTrigger value="capital-recuperado">Capital Recuperado</TabsTrigger>
        <TabsTrigger value="no-pagadas">Cuotas no Pagadas</TabsTrigger>
      </TabsList>
      <TabsContent value="otorgados">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Préstamos Otorgados</CardTitle>
            <CardDescription>
              Seleccione un rango de fechas para ver los préstamos otorgados en ese período, agrupados por mes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PrestamosOtorgadosReport />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="capital-recuperado">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Capital Recuperado e Intereses</CardTitle>
            <CardDescription>
              Analice los pagos recibidos en un período, desglosados por capital e intereses y agrupados mensualmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CapitalRecuperadoReport />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="no-pagadas">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Cuotas no Pagadas</CardTitle>
            <CardDescription>
              Muestra todas las cuotas pendientes de pago para el mes y año seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CuotasVencidasReport />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
