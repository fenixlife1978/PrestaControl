export type Loan = {
  id: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  purpose: string;
  repaymentTerm: string;
  status: "Pending" | "Approved" | "Rejected" | "Paid";
  applicationDate: string;
  avatar: string;
};

export const loans: Loan[] = [
  {
    id: "LN001",
    customerName: "Alice Johnson",
    customerEmail: "alice.j@email.com",
    amount: 5000,
    purpose: "Home Improvement",
    repaymentTerm: "12 Months",
    status: "Approved",
    applicationDate: "2023-10-26",
    avatar: "https://picsum.photos/seed/1/40/40",
  },
  {
    id: "LN002",
    customerName: "Bob Smith",
    customerEmail: "bob.s@email.com",
    amount: 15000,
    purpose: "Car Purchase",
    repaymentTerm: "36 Months",
    status: "Pending",
    applicationDate: "2023-10-28",
    avatar: "https://picsum.photos/seed/2/40/40",
  },
  {
    id: "LN003",
    customerName: "Charlie Brown",
    customerEmail: "charlie.b@email.com",
    amount: 2000,
    purpose: "Debt Consolidation",
    repaymentTerm: "6 Months",
    status: "Rejected",
    applicationDate: "2023-10-29",
    avatar: "https://picsum.photos/seed/3/40/40",
  },
  {
    id: "LN004",
    customerName: "Diana Prince",
    customerEmail: "diana.p@email.com",
    amount: 25000,
    purpose: "Business Startup",
    repaymentTerm: "48 Months",
    status: "Approved",
    applicationDate: "2023-11-01",
    avatar: "https://picsum.photos/seed/4/40/40",
  },
  {
    id: "LN005",
    customerName: "Ethan Hunt",
    customerEmail: "ethan.h@email.com",
    amount: 7500,
    purpose: "Vacation",
    repaymentTerm: "24 Months",
    status: "Paid",
    applicationDate: "2023-09-15",
    avatar: "https://picsum.photos/seed/5/40/40",
  },
  {
    id: "LN006",
    customerName: "Fiona Glenanne",
    customerEmail: "fiona.g@email.com",
    amount: 10000,
    purpose: "Medical Expenses",
    repaymentTerm: "36 Months",
    status: "Pending",
    applicationDate: "2023-11-05",
    avatar: "https://picsum.photos/seed/6/40/40",
  },
  {
    id: "LN007",
    customerName: "George Costanza",
    customerEmail: "george.c@email.com",
    amount: 1200,
    purpose: "Small Purchase",
    repaymentTerm: "3 Months",
    status: "Approved",
    applicationDate: "2023-11-06",
    avatar: "https://picsum.photos/seed/7/40/40",
  },
];

export const analytics = {
  totalLoans: loans.length,
  outstandingBalance: loans
    .filter((l) => l.status === "Approved")
    .reduce((acc, loan) => acc + loan.amount, 0),
  delinquencyRate: 12.5,
};

export const chartData = [
  { month: "Jan", approved: 4000, paid: 2400 },
  { month: "Feb", approved: 3000, paid: 1398 },
  { month: "Mar", approved: 2000, paid: 9800 },
  { month: "Apr", approved: 2780, paid: 3908 },
  { month: "May", approved: 1890, paid: 4800 },
  { month: "Jun", approved: 2390, paid: 3800 },
  { month: "Jul", approved: 3490, paid: 4300 },
];

export type Repayment = {
  dueDate: string;
  amountDue: number;
  status: "Paid" | "Due" | "Late";
};

export const repaymentSchedule: Repayment[] = [
  { dueDate: "2023-11-26", amountDue: 431.8, status: "Paid" },
  { dueDate: "2023-12-26", amountDue: 431.8, status: "Due" },
  { dueDate: "2024-01-26", amountDue: 431.8, status: "Due" },
  { dueDate: "2024-02-26", amountDue: 431.8, status: "Due" },
  { dueDate: "2024-03-26", amountDue: 431.8, status: "Due" },
];

export const user = {
  name: "Admin User",
  email: "admin@prestacontrol.com",
  avatar: "https://picsum.photos/seed/100/40/40",
};
