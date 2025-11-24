
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
import { CuotasPagadasReport } from "./_components/cuotas-pagadas-report";
import { CuotasVencidasReport } from "./_components/cuotas-vencidas-report";
import { PrestamosOtorgadosReport } from "./_components/prestamos-otorgados-report";

export default function ReportsPage() {
  return (
    <Tabs defaultValue="pagadas">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="otorgados">Préstamos Otorgados</TabsTrigger>
        <TabsTrigger value="pagadas">Pagos Recibidos</TabsTrigger>
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
      <TabsContent value="pagadas">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Pagos Recibidos</CardTitle>
            <CardDescription>
              Filtre por mes y año para ver todos los pagos (cuotas y abonos libres) recibidos en ese período.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CuotasPagadasReport />
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

