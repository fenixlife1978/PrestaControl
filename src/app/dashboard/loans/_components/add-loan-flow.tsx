
"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import type { Loan } from "../page";

const loanFormSchema = z.object({
  partnerId: z.string().min(1, "Debe seleccionar un socio."),
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "El monto debe ser un número positivo.",
  }),
  startDate: z.date({
    required_error: "La fecha de inicio es requerida.",
  }),
  loanType: z.enum(["estandar", "personalizado"]),
  
  // Estandar
  interestRate: z.string().optional(),
  installments: z.string().optional(),
  
  // Personalizado
  hasInterest: z.boolean().optional(),
  interestType: z.enum(["porcentaje", "fijo"]).optional(),
  customInterest: z.string().optional(),
  paymentType: z.enum(["cuotas", "libre"]).optional(),
  customInstallments: z.string().optional(),
});

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
  cedula?: string;
};

type AddLoanFlowProps = {
  partners: Partner[];
  onSubmit: (values: z.infer<typeof loanFormSchema>) => void;
  loan?: Loan | null;
  mode: "add" | "edit";
};

export function AddLoanFlow({ partners, onSubmit, loan, mode }: AddLoanFlowProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const form = useForm<z.infer<typeof loanFormSchema>>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      partnerId: "",
      amount: "",
      startDate: new Date(),
      loanType: "estandar",
      interestRate: "5", // Default 5%
      installments: "12", // Default 12 cuotas
      hasInterest: true,
      interestType: "porcentaje",
      paymentType: "cuotas"
    },
  });

  useEffect(() => {
    if (mode === 'edit' && loan) {
        const partner = partners.find(p => p.id === loan.partnerId);
        if (partner) {
            setSelectedPartner(partner);
        }
        form.reset({
            partnerId: loan.partnerId,
            amount: String(loan.amount),
            startDate: loan.startDate.toDate(),
            loanType: loan.loanType,
            interestRate: loan.interestRate || "5",
            installments: loan.installments || "12",
            // TODO: Populate custom fields when available in Loan type
        });
    } else {
        const defaultPartner = partners.find(p => p.id === form.getValues("partnerId"));
        if(defaultPartner) {
            setSelectedPartner(defaultPartner);
        }
    }
  }, [mode, loan, form, partners]);
  
  const loanType = useWatch({ control: form.control, name: "loanType" });
  const hasInterest = useWatch({ control: form.control, name: "hasInterest" });
  const paymentType = useWatch({ control: form.control, name: "paymentType" });


  const handlePartnerSelect = (partner: Partner) => {
    setSelectedPartner(partner);
    form.setValue("partnerId", partner.id);
  };
  
  const clearSelectedPartner = () => {
      setSelectedPartner(null);
      form.setValue("partnerId", "");
  }

  const filteredPartners = partners.filter(partner =>
    `${partner.firstName} ${partner.lastName} ${partner.cedula || ''}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  if (!selectedPartner) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar socio por nombre, apellido o cédula..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-2">
            {partners.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">No hay socios registrados. Añada socios primero.</p>
            )}
            {partners.length > 0 && filteredPartners.length === 0 && (
                 <p className="text-center text-sm text-muted-foreground">No se encontraron socios.</p>
            )}
            {filteredPartners.map(partner => (
                <Button variant="outline" key={partner.id} className="w-full justify-start" onClick={() => handlePartnerSelect(partner)}>
                    {partner.firstName} {partner.lastName} ({partner.cedula || 'Sin Cédula'})
                </Button>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="font-semibold text-lg">{selectedPartner.firstName} {selectedPartner.lastName}</p>
              <p className="text-sm text-muted-foreground">{selectedPartner.cedula || 'Sin Cédula'}</p>
            </div>
            {mode === "add" && <Button variant="link" onClick={clearSelectedPartner}>Cambiar Socio</Button>}
        </CardContent>
      </Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto del Préstamo (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ej: 5000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de Inicio</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Seleccione una fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="loanType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Préstamo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un tipo de préstamo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="estandar">Estándar (Sistema Alemán)</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {loanType === 'estandar' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/20">
               <FormField
                  control={form.control}
                  name="interestRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interés Mensual (%)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                       <p className="text-xs text-muted-foreground">Sistema Alemán sobre saldo.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="installments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Cuotas</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
          )}

          {loanType === 'personalizado' && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/20">
                <FormField
                  control={form.control}
                  name="hasInterest"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>¿Aplica Interés?</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {hasInterest && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="interestType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Interés</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="porcentaje">Porcentaje (%)</SelectItem>
                                        <SelectItem value="fijo">Monto Fijo (USD)</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="customInterest"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valor del Interés</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                )}

                <FormField
                    control={form.control}
                    name="paymentType"
                    render={({ field }) => (
                        <FormItem>
                             <FormLabel>Modalidad de Pago</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="cuotas">Cuotas Fijas</SelectItem>
                                <SelectItem value="libre">Abono Libre</SelectItem>
                            </SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />

                {paymentType === "cuotas" && (
                     <FormField
                        control={form.control}
                        name="customInstallments"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Número de Cuotas</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="Ej: 12" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>
          )}
          <FormField
            control={form.control}
            name="partnerId"
            render={({ field }) => (
                <FormItem>
                    <FormControl>
                        <Input type="hidden" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
           />

          <Button type="submit" className="w-full">
            {mode === 'add' ? 'Registrar Préstamo' : 'Guardar Cambios'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
