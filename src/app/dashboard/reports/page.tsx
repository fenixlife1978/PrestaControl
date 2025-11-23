
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
import { ReporteIntegral } from "./_components/reporte-integral";

export default function ReportsPage() {
  return (
    <Tabs defaultValue="integral-mensual">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="integral-mensual">Reporte Integral Mensual</TabsTrigger>
        <TabsTrigger value="pagadas">Cuotas Pagadas</TabsTrigger>
        <TabsTrigger value="no-pagadas">Cuotas no Pagadas</TabsTrigger>
      </TabsList>
      <TabsContent value="integral-mensual">
        <Card>
          <CardHeader>
            <CardTitle>Reporte Integral Mensual</CardTitle>
            <CardDescription>
              Resumen financiero anual que desglosa por meses el capital e interés que se espera recaudar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ReporteIntegral />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="pagadas">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Cuotas Pagadas</CardTitle>
            <CardDescription>
              Filtre por mes y año para ver todas las cuotas que han sido pagadas en ese período.
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
