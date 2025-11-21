import { cn } from "@/lib/utils";
import { Landmark } from "lucide-react";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Landmark className="h-6 w-6 text-primary" />
      <h1 className="text-xl font-bold text-primary">PrestaControl</h1>
    </div>
  );
}
