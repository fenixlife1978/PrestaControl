

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
import { EstadoPrestamosReport } from "./_components/estado-prestamos-report";

export default function ReportsPage() {
  return (
    <Tabs defaultValue="estado">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="estado">Estado de Préstamos</TabsTrigger>
        <TabsTrigger value="otorgados">Préstamos Otorgados</TabsTrigger>
        <TabsTrigger value="capital-recuperado">Capital Recuperado</TabsTrigger>
        <TabsTrigger value="vencidas">Cuotas Vencidas</TabsTrigger>
      </TabsList>
      <TabsContent value="estado">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Estado de Préstamos</CardTitle>
            <CardDescription>
              Consulte la lista de préstamos activos y finalizados. Puede exportar cada lista a PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <EstadoPrestamosReport />
          </CardContent>
        </Card>
      </TabsContent>
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
      <TabsContent value="vencidas">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Cuotas Vencidas</CardTitle>
            <CardDescription>
              Muestra todas las cuotas con pagos atrasados para el mes y año seleccionado.
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
