
'use client';

import { useMemo } from 'react';
import { useDocument } from 'react-firebase-hooks/firestore';
import { doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type CompanySettings = {
  logoUrl?: string;
};

export function Logo({ className }: { className?: string }) {
  const firestore = useFirestore();
  const settingsRef = firestore ? doc(firestore, 'company_settings', 'main') : null;
  const [settingsDoc, loading, error] = useDocument(settingsRef);

  const logoUrl = useMemo(() => {
    if (settingsDoc?.exists()) {
      const data = settingsDoc.data() as CompanySettings;
      return data.logoUrl;
    }
    return null;
  }, [settingsDoc]);

  const finalSrc = logoUrl || "https://i.ibb.co/L6fK5bC/bus-image.png";

  if (loading) {
    return <Skeleton className={cn("h-24 w-24", className)} />;
  }
  
  if (error) {
    console.error("Error loading logo:", error);
    // Fallback to default logo on error
    return (
       <img
        src="https://i.ibb.co/L6fK5bC/bus-image.png"
        alt="Logo"
        className={cn("h-24 w-auto", className)}
      />
    )
  }

  return (
    <img
      src={finalSrc}
      alt="Logo"
      className={cn("h-24 w-auto", className)}
    />
  );
}
