

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="https://i.ibb.co/L6fK5bC/bus-image.png"
      alt="Logo"
      className={cn("h-24 w-auto", className)}
    />
  );
}
    