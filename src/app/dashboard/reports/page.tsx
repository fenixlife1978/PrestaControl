
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
    <Tabs defaultValue="integral">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="integral">Reporte Integral</TabsTrigger>
        <TabsTrigger value="pagadas">Cuotas Pagadas</TabsTrigger>
        <TabsTrigger value="vencidas">Cuotas Vencidas</TabsTrigger>
      </TabsList>
      <TabsContent value="integral">
        <Card>
          <CardHeader>
            <CardTitle>Reporte Integral del Período</CardTitle>
            <CardDescription>
              Aquí puede ver el resumen financiero para el período seleccionado, incluyendo todo el capital e interés que se esperaba recaudar.
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
      <TabsContent value="vencidas">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Cuotas Vencidas</CardTitle>
            <CardDescription>
              Muestra todas las cuotas pendientes cuya fecha de vencimiento ya ha pasado.
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
