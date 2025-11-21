export type Loan = {
  id: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  purpose: string;
  repaymentTerm: string;
  status: "Pendiente" | "Aprobado" | "Rechazado" | "Pagado";
  applicationDate: string;
  avatar: string;
};

export const loans: Loan[] = [
  {
    id: "LN001",
    customerName: "Alicia Johnson",
    customerEmail: "alice.j@email.com",
    amount: 5000,
    purpose: "Mejoras en el hogar",
    repaymentTerm: "12 Meses",
    status: "Aprobado",
    applicationDate: "2023-10-26",
    avatar: "https://picsum.photos/seed/1/40/40",
  },
  {
    id: "LN002",
    customerName: "Roberto Smith",
    customerEmail: "bob.s@email.com",
    amount: 15000,
    purpose: "Compra de coche",
    repaymentTerm: "36 Meses",
    status: "Pendiente",
    applicationDate: "2023-10-28",
    avatar: "https://picsum.photos/seed/2/40/40",
  },
  {
    id: "LN003",
    customerName: "Carlos Brown",
    customerEmail: "charlie.b@email.com",
    amount: 2000,
    purpose: "Consolidación de deuda",
    repaymentTerm: "6 Meses",
    status: "Rechazado",
    applicationDate: "2023-10-29",
    avatar: "https://picsum.photos/seed/3/40/40",
  },
  {
    id: "LN004",
    customerName: "Diana Prince",
    customerEmail: "diana.p@email.com",
    amount: 25000,
    purpose: "Inicio de negocio",
    repaymentTerm: "48 Meses",
    status: "Aprobado",
    applicationDate: "2023-11-01",
    avatar: "https://picsum.photos/seed/4/40/40",
  },
  {
    id: "LN005",
    customerName: "Ethan Hunt",
    customerEmail: "ethan.h@email.com",
    amount: 7500,
    purpose: "Vacaciones",
    repaymentTerm: "24 Meses",
    status: "Pagado",
    applicationDate: "2023-09-15",
    avatar: "https://picsum.photos/seed/5/40/40",
  },
  {
    id: "LN006",
    customerName: "Fiona Glenanne",
    customerEmail: "fiona.g@email.com",
    amount: 10000,
    purpose: "Gastos médicos",
    repaymentTerm: "36 Meses",
    status: "Pendiente",
    applicationDate: "2023-11-05",
    avatar: "https://picsum.photos/seed/6/40/40",
  },
  {
    id: "LN007",
    customerName: "Jorge Costanza",
    customerEmail: "george.c@email.com",
    amount: 1200,
    purpose: "Compra pequeña",
    repaymentTerm: "3 Meses",
    status: "Aprobado",
    applicationDate: "2023-11-06",
    avatar: "https://picsum.photos/seed/7/40/40",
  },
];

export const analytics = {
  totalLoans: loans.length,
  outstandingBalance: loans
    .filter((l) => l.status === "Aprobado")
    .reduce((acc, loan) => acc + loan.amount, 0),
  delinquencyRate: 12.5,
};

export const chartData = [
  { month: "Ene", approved: 4000, paid: 2400 },
  { month: "Feb", approved: 3000, paid: 1398 },
  { month: "Mar", approved: 2000, paid: 9800 },
  { month: "Abr", approved: 2780, paid: 3908 },
  { month: "May", approved: 1890, paid: 4800 },
  { month: "Jun", approved: 2390, paid: 3800 },
  { month: "Jul", approved: 3490, paid: 4300 },
];

export type Repayment = {
  dueDate: string;
  amountDue: number;
  status: "Pagado" | "Pendiente" | "Atrasado";
};

export const repaymentSchedule: Repayment[] = [
  { dueDate: "2023-11-26", amountDue: 431.8, status: "Pagado" },
  { dueDate: "2023-12-26", amountDue: 431.8, status: "Pendiente" },
  { dueDate: "2024-01-26", amountDue: 431.8, status: "Pendiente" },
  { dueDate: "2024-02-26", amountDue: 431.8, status: "Pendiente" },
  { dueDate: "2024-03-26", amountDue: 431.8, status: "Pendiente" },
];

export const user = {
  name: "Usuario Admin",
  email: "admin@prestacontrol.com",
  avatar: "https://picsum.photos/seed/100/40/40",
};
