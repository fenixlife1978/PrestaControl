import { cn } from "@/lib/utils";
import { Bus } from "lucide-react";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Bus className="h-6 w-6 text-primary" />
      <h1 className="text-xl font-bold text-primary">PrestaControl</h1>
    </div>
  );
}
