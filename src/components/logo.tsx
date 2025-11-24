import { cn } from "@/lib/utils";
import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <Image 
        src="https://i.ibb.co/7v3MXTf/bus-image.png" 
        alt="Coop. de Transp. La Candelaria Logo"
        width={150}
        height={150}
        className="object-contain"
      />
      <h1 className="text-xl font-bold text-primary">PrestaControl</h1>
    </div>
  );
}
